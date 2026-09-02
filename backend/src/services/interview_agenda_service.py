"""Tầng I/O cho agenda phỏng vấn: gọi LLM sinh câu hỏi và đọc/ghi database.

Phần logic thuần (phân bổ hạn ngạch, kiểm chứng evidence, làm sạch kết quả)
nằm ở `services/interview_agenda.py` và được import vào đây. Tách đôi như vậy
để toàn bộ quy tắc nghiệp vụ test được không cần DB lẫn API key, còn module
này chỉ lo phần không thể test thuần.

Điểm quan trọng về chi phí: agenda được khoá theo cặp (cv_snapshot, jd_snapshot)
nên mỗi cặp CV+JD chỉ tốn ĐÚNG MỘT lời gọi LLM, dù ứng viên luyện bao nhiêu
phiên. Quota Gemini free-tier là 20 request/ngày nên khác biệt này rất đáng kể.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.models import CV, InterviewAgenda, JobDescription, User, generate_uuid
from src.services.interview_agenda import (
    DEFAULT_NUM_QUESTIONS,
    AgendaQuestion,
    build_generation_spec,
    compute_quotas,
    sanitize_agenda,
)
from src.services.pipeline_context import (
    get_or_create_cv_snapshot,
    get_or_create_jd_snapshot,
    insert_ignoring_conflict,
)

logger = logging.getLogger(__name__)

# Cắt bớt đầu vào để prompt không phình. Cùng ngưỡng với
# services/voice/voice_orchestrator.py::_build_system_prompt().
_CV_CHAR_LIMIT = 3000
_JD_CHAR_LIMIT = 2000

_SYSTEM_PROMPT = """Bạn là chuyên gia thiết kế câu hỏi phỏng vấn. Nhiệm vụ: soạn bộ câu hỏi cho một ứng viên cụ thể, dựa trên CV và JD được cung cấp.

## Hạn ngạch BẮT BUỘC theo nhóm năng lực
{quota_lines}
Tổng cộng đúng {total} câu. Không nhiều hơn, không ít hơn.

## Quy tắc về bằng chứng — QUAN TRỌNG NHẤT
Mỗi câu hỏi PHẢI kèm trường "evidence" là một đoạn TRÍCH NGUYÊN VĂN từ CV hoặc JD, sao chép chính xác từng ký tự, dài ít nhất 12 ký tự.
- Nếu câu hỏi bám vào kinh nghiệm/dự án/kỹ năng có trong CV → "source": "cv", "evidence" trích từ CV.
- Nếu câu hỏi bám vào yêu cầu trong JD → "source": "jd", "evidence" trích từ JD.
- Nếu là câu hỏi chung không bám vào tài liệu nào → "source": "generic", "evidence": "".
TUYỆT ĐỐI KHÔNG bịa evidence. Không diễn giải lại, không tóm tắt — phải là đoạn văn bản có thật, sao chép y nguyên. Câu nào có evidence không tìm thấy trong tài liệu gốc sẽ bị hệ thống loại bỏ bằng chứng và mất giá trị.

## Quy tắc nội dung
- Không giả định ứng viên có kinh nghiệm không ghi trong CV.
- Câu hỏi kỹ thuật phải hỏi được chiều sâu, tránh câu chỉ trả lời có/không.
- Mỗi câu kèm 1-3 câu đào sâu (follow_up_prompts), 2-4 dấu hiệu trả lời tốt (good_answer_signals) và 1-3 dấu hiệu đáng lo (red_flags).

## Định dạng trả về
Chỉ trả về DUY NHẤT một JSON array, không thêm chữ nào ngoài JSON, không bọc trong markdown. Mỗi phần tử:
{{"question_vi":"...","question_en":"...","competency":"<một trong: {competencies}>","linked_skills":["..."],"star_dimensions":["<trong: {star_dimensions}>"],"follow_up_prompts":["..."],"good_answer_signals":["..."],"red_flags":["..."],"evidence":"trích nguyên văn","source":"cv|jd|generic"}}"""


def _json_value(content: Any) -> Any:
    """Parse nội dung LLM thành JSON, chịu được markdown fence và content dạng list.

    Sao theo `agents/nodes/interview_nodes.py::_json_value()` để hai chỗ sinh
    câu hỏi hành xử giống nhau trước cùng một kiểu output hỏng.
    """
    if isinstance(content, str):
        text = content.strip()
    elif isinstance(content, list):
        text = "\n".join(
            str(block.get("text", ""))
            for block in content
            if isinstance(block, dict) and block.get("text")
        ).strip()
    else:
        text = str(content or "").strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1)
    return json.loads(text)


def _format_quota_lines(quotas: dict[str, int]) -> str:
    return "\n".join(f"- {name}: {count} câu" for name, count in quotas.items() if count > 0)


async def _call_llm(spec: dict[str, Any], cv_text: str, jd_text: str) -> tuple[Any, str]:
    """Gọi LLM sinh câu hỏi thô. Trả về (dữ liệu thô, nhãn generated_by).

    Không ném exception: mọi lỗi đều trả về (None, "fallback") để tầng trên
    rơi xuống bộ câu hỏi generic thay vì làm hỏng cả request.
    """
    settings = get_settings()
    if not settings.google_genai_api_key:
        logger.warning(
            "Sinh agenda bỏ qua LLM: chưa cấu hình API key Gemini. "
            "Người dùng sẽ nhận bộ câu hỏi generic."
        )
        return None, "fallback"

    prompt = _SYSTEM_PROMPT.format(
        quota_lines=_format_quota_lines(spec["quotas"]),
        total=spec["total"],
        competencies=", ".join(spec["competencies"]),
        star_dimensions=", ".join(spec["star_dimensions"]),
    )
    context = (
        f"Vị trí: {spec['jd_title']}\n"
        f"Nhóm vai trò: {spec['role_family']}\n"
        f"Kỹ năng JD yêu cầu: {', '.join(spec['jd_skills']) or 'không trích được'}\n\n"
        f"=== CV ===\n{cv_text}\n\n=== JD ===\n{jd_text}"
    )

    # JSON hỏng là lỗi ngẫu nhiên của LLM (output bị cắt, thiếu dấu phẩy) và
    # thường không lặp lại, nên thử lại đúng MỘT lần cho riêng loại lỗi này.
    # Các lỗi khác không retry ở đây: ChatGoogleGenerativeAI đã tự retry theo
    # settings.llm_max_retries, và timeout/auth/quota thì thử lại cũng vô ích.
    for attempt in (1, 2):
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            from langchain_google_genai import ChatGoogleGenerativeAI

            llm = ChatGoogleGenerativeAI(
                model=settings.model_name,
                # Thấp hơn 1.0 mà agents/nodes/interview_nodes.py dùng: agenda được
                # lưu và tái dùng cho mọi phiên của cùng cặp CV+JD, nên tính ổn định
                # đáng giá hơn sự đa dạng. Muốn bộ khác thì bấm "Sinh lại".
                temperature=0.7,
                api_key=settings.google_genai_api_key,
                request_timeout=settings.llm_timeout_seconds,
                retries=settings.llm_max_retries,
            )
            response = await llm.ainvoke(
                [SystemMessage(content=prompt), HumanMessage(content=context)]
            )
            return _json_value(response.content), settings.model_name
        except json.JSONDecodeError as exc:
            # Ghi rõ vị trí để biết output bị cắt (pos gần cuối) hay sai cú pháp
            # giữa chừng — hai nguyên nhân cần cách sửa khác nhau.
            logger.warning(
                "Sinh agenda: LLM trả JSON hỏng (lần %d/2) tại char %s: %s",
                attempt,
                exc.pos,
                exc.msg,
            )
        except Exception as exc:
            logger.warning(
                "Sinh agenda thất bại vì %s, dùng bộ câu hỏi generic: %s",
                type(exc).__name__,
                exc,
            )
            return None, "fallback"

    logger.warning("Sinh agenda thất bại sau 2 lần parse JSON, dùng bộ câu hỏi generic.")
    return None, "fallback"


async def generate_questions(
    *,
    cv_text: str,
    jd_title: str,
    jd_requirements: str,
    num_questions: int = DEFAULT_NUM_QUESTIONS,
    competency_focus: str | None = None,
) -> tuple[list[AgendaQuestion], str]:
    """Sinh danh sách câu hỏi đã được làm sạch và kiểm chứng bằng chứng.

    Luôn trả về đủ số câu theo hạn ngạch: phần LLM không sinh được (hoặc sinh
    ra bằng chứng bịa rồi bị hạ cấp) được lấp bằng câu generic.
    """
    quotas = compute_quotas(num_questions, competency_focus)
    spec = build_generation_spec(jd_title=jd_title, jd_requirements=jd_requirements, quotas=quotas)

    cv_excerpt = cv_text[:_CV_CHAR_LIMIT]
    jd_excerpt = jd_requirements[:_JD_CHAR_LIMIT]
    raw, generated_by = await _call_llm(spec, cv_excerpt, jd_excerpt)

    # Kiểm chứng evidence đối chiếu với ĐÚNG đoạn đã đưa cho LLM, không phải
    # toàn văn: nếu đối chiếu với toàn văn thì một trích dẫn nằm ngoài phần bị
    # cắt vẫn được coi là hợp lệ dù LLM không thể nhìn thấy nó.
    questions = sanitize_agenda(raw, cv_text=cv_excerpt, jd_text=jd_excerpt, quotas=quotas)
    return questions, generated_by


async def _find_agenda(
    db: AsyncSession, *, user_id: str, cv_snapshot_id: str, jd_snapshot_id: str
) -> InterviewAgenda | None:
    return await db.scalar(
        select(InterviewAgenda).where(
            InterviewAgenda.user_id == user_id,
            InterviewAgenda.cv_snapshot_id == cv_snapshot_id,
            InterviewAgenda.jd_snapshot_id == jd_snapshot_id,
        )
    )


async def get_existing_agenda(
    db: AsyncSession, *, user: User, cv: CV, jd: JobDescription
) -> InterviewAgenda | None:
    """Tìm agenda đã có cho cặp CV+JD, không sinh mới. None nếu chưa có."""
    cv_snapshot = await get_or_create_cv_snapshot(db, cv)
    jd_snapshot = await get_or_create_jd_snapshot(db, jd)
    return await _find_agenda(
        db,
        user_id=user.id,
        cv_snapshot_id=cv_snapshot.id,
        jd_snapshot_id=jd_snapshot.id,
    )


async def ensure_agenda(
    db: AsyncSession,
    *,
    user: User,
    cv: CV,
    jd: JobDescription,
    num_questions: int = DEFAULT_NUM_QUESTIONS,
    competency_focus: str | None = None,
    force_regenerate: bool = False,
) -> tuple[InterviewAgenda, bool]:
    """Trả về agenda cho cặp CV+JD, sinh mới nếu chưa có.

    Trả về `(agenda, đã_sinh_mới)`. Khi đã tồn tại và `force_regenerate` là
    False thì KHÔNG gọi LLM — đây là cơ chế tiết kiệm quota chính.

    `force_regenerate` ghi đè `questions_json` tại chỗ và tăng `revision_no`,
    cố ý không tạo hàng mới để ràng buộc unique theo cặp snapshot vẫn đúng và
    lịch sử không phình theo mỗi lần bấm "Sinh lại".
    """
    cv_snapshot = await get_or_create_cv_snapshot(db, cv)
    jd_snapshot = await get_or_create_jd_snapshot(db, jd)
    existing = await _find_agenda(
        db,
        user_id=user.id,
        cv_snapshot_id=cv_snapshot.id,
        jd_snapshot_id=jd_snapshot.id,
    )
    if existing is not None and not force_regenerate:
        return existing, False

    questions, generated_by = await generate_questions(
        cv_text=cv.raw_text or "",
        jd_title=jd.title,
        jd_requirements=jd.requirements_text,
        num_questions=num_questions,
        competency_focus=competency_focus,
    )
    payload = [question.to_dict() for question in questions]

    if existing is not None:
        existing.questions_json = payload
        existing.generated_by = generated_by
        existing.revision_no = (existing.revision_no or 1) + 1
        await db.commit()
        await db.refresh(existing)
        return existing, True

    owner_id = user.id
    cv_snapshot_id = cv_snapshot.id
    jd_snapshot_id = jd_snapshot.id
    agenda_id = generate_uuid()

    # Ghi qua insert_ignoring_conflict thay vì db.add() + bắt IntegrityError rồi
    # rollback. Rollback ở đây không an toàn: nó vứt luôn mọi thứ đang treo
    # trong session, kể cả phần chưa commit của request KHÁC khi hai request
    # dùng chung một connection — và đúng ràng buộc mình vừa vi phạm lại là
    # bằng chứng rằng hàng cần tìm đang tồn tại ở đâu đó chưa nhìn thấy được.
    written = await insert_ignoring_conflict(
        db,
        InterviewAgenda.__table__,
        {
            "id": agenda_id,
            "user_id": owner_id,
            "cv_snapshot_id": cv_snapshot_id,
            "jd_snapshot_id": jd_snapshot_id,
            "questions_json": payload,
            "generated_by": generated_by,
            "revision_no": 1,
        },
        index_elements=["user_id", "cv_snapshot_id", "jd_snapshot_id"],
    )
    await db.commit()

    if not written:
        # Hai request song song cùng thấy "chưa có agenda" rồi cùng INSERT.
        # Ràng buộc uq_interview_agenda_pair chặn đúng như thiết kế, nhưng với
        # người dùng đó là kết quả MONG MUỐN chứ không phải lỗi — lấy bản của
        # request thắng cuộc về và trả như một lần dùng lại, đừng ném 500.
        winner = await _find_agenda(
            db,
            user_id=owner_id,
            cv_snapshot_id=cv_snapshot_id,
            jd_snapshot_id=jd_snapshot_id,
        )
        if winner is None:
            raise RuntimeError(
                "INSERT agenda bị bỏ qua vì va chạm uq_interview_agenda_pair "
                "nhưng không đọc lại được hàng của request thắng cuộc."
            )
        logger.info("Agenda cho cặp CV+JD này vừa được request khác tạo, dùng lại bản đó.")
        return winner, False

    agenda = await db.get(InterviewAgenda, agenda_id)
    return agenda, True


async def set_questions_enabled(
    db: AsyncSession, *, agenda: InterviewAgenda, enabled_by_id: dict[str, bool]
) -> InterviewAgenda:
    """Bật/tắt từng câu trong agenda theo id. Id lạ bị bỏ qua trong im lặng.

    Không cho tắt hết: nếu mọi câu đều bị tắt thì phiên phỏng vấn không còn gì
    để hỏi, nên thao tác đó bị từ chối bằng cách giữ nguyên trạng thái cũ.
    """
    questions = list(agenda.questions_json or [])
    updated = [
        {**question, "is_enabled": enabled_by_id.get(str(question.get("id")), question.get("is_enabled", True))}
        for question in questions
    ]
    if not any(question.get("is_enabled") for question in updated):
        return agenda

    agenda.questions_json = updated
    await db.commit()
    await db.refresh(agenda)
    return agenda


def enabled_questions(agenda: InterviewAgenda) -> list[dict[str, Any]]:
    """Các câu đang bật, theo đúng thứ tự lưu — dùng khi bắt đầu phiên phỏng vấn."""
    return [q for q in (agenda.questions_json or []) if q.get("is_enabled", True)]
