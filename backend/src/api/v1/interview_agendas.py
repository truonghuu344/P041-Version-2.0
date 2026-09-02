"""Endpoint REST cho agenda phỏng vấn (bộ câu hỏi sinh sẵn theo cặp CV+JD).

Router này CỐ Ý tách khỏi `interviews.py`: agenda là tài nguyên độc lập, khoá
theo cặp (cv_snapshot, jd_snapshot) và tái dùng giữa nhiều phiên phỏng vấn của
cùng một cặp CV+JD (xem `services/interview_agenda_service.py`). Toàn bộ truy
vấn DB và gọi LLM nằm ở tầng service; router chỉ lo xác thực, phân quyền và
chuyển đổi dữ liệu.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, CVSnapshot, InterviewAgenda, JDSnapshot, JobDescription, User
from src.models.schemas import (
    AgendaQuestionOut,
    InterviewAgendaCreateRequest,
    InterviewAgendaEnabledUpdateRequest,
    InterviewAgendaOut,
    InterviewAgendaRegenerateRequest,
)
from src.services.interview_agenda import COMPETENCIES
from src.services.interview_agenda_service import ensure_agenda, get_existing_agenda, set_questions_enabled

router = APIRouter(prefix="/interviews/agenda", tags=["Interview Agenda"])


async def _load_owned_cv(db: AsyncSession, *, cv_id: str, user: User) -> CV:
    """Nạp CV, xác nhận thuộc về user hiện tại. Sao đúng logic ở
    `interviews.py::start_interview_session` để hai nơi cùng chuẩn phân quyền.
    """
    cv = await db.scalar(select(CV).where(CV.id == cv_id, CV.user_id == user.id))
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bắt buộc phải chọn 1 CV hợp lệ của bạn trước khi tạo agenda phỏng vấn",
        )
    return cv


async def _load_visible_jd(db: AsyncSession, *, jd_id: str, user: User) -> JobDescription:
    """Nạp JD hệ thống/đã xuất bản/hoặc do chính user tạo. Sao đúng logic ở
    `interviews.py::start_interview_session`.
    """
    if jd_id.startswith("catalog:"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "JD trong catalog chưa được import. Hãy gọi POST /api/v1/jds/catalog/{source_id}/select để lấy id thật"
            ),
        )

    jd = await db.scalar(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            or_(
                JobDescription.is_system.is_(True),
                JobDescription.is_published.is_(True),
                JobDescription.created_by_user_id == user.id,
            ),
        )
    )
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bắt buộc phải chọn 1 Job Description hợp lệ trước khi tạo agenda phỏng vấn",
        )
    return jd


def _coverage(questions: list[dict]) -> dict[str, int]:
    """Đếm số câu đang bật theo competency, tính trực tiếp trên payload đã lưu (dict thô)"""
    coverage = dict.fromkeys(COMPETENCIES, 0)
    for question in questions:
        if question.get("is_enabled", True):
            competency = question.get("competency")
            if competency in coverage:
                coverage[competency] += 1
    return coverage


def _to_out(agenda: InterviewAgenda) -> InterviewAgendaOut:
    questions = list(agenda.questions_json or [])
    return InterviewAgendaOut(
        id=agenda.id,
        revision_no=agenda.revision_no,
        generated_by=agenda.generated_by,
        questions=[AgendaQuestionOut(**question) for question in questions],
        coverage=_coverage(questions),
        created_at=agenda.created_at,
        updated_at=agenda.updated_at,
    )


async def _load_owned_agenda(db: AsyncSession, *, agenda_id: str, user: User) -> InterviewAgenda:
    agenda = await db.get(InterviewAgenda, agenda_id)
    if not agenda:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy agenda phỏng vấn.")
    if agenda.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền truy cập agenda này.")
    return agenda


async def _resolve_cv_jd_from_agenda(db: AsyncSession, *, agenda: InterviewAgenda, user: User) -> tuple[CV, JobDescription]:
    """Truy ngược từ agenda ra CV/JD gốc để gọi lại `ensure_agenda(...)`.

    `InterviewAgenda` chỉ lưu `cv_snapshot_id`/`jd_snapshot_id`; phải đi qua `CVSnapshot.cv_id` và `JDSnapshot.jd_id` để lấy bản ghi CV/JD sống hiện tại.
    """
    cv_snapshot = await db.get(CVSnapshot, agenda.cv_snapshot_id)
    jd_snapshot = await db.get(JDSnapshot, agenda.jd_snapshot_id)
    if not cv_snapshot or not jd_snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy CV hoặc JD gốc của agenda này.",
        )

    cv = await _load_owned_cv(db, cv_id=cv_snapshot.cv_id, user=user)
    jd = await _load_visible_jd(db, jd_id=jd_snapshot.jd_id, user=user)
    return cv, jd


@router.get("", response_model=InterviewAgendaOut)
async def get_agenda(
    cv_id: str,
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewAgendaOut:
    """Lấy agenda đã sinh cho cặp CV+JD. KHÔNG tự sinh mới — endpoint này rẻ,
    gọi được thoải mái từ frontend để kiểm tra trạng thái.
    """
    cv = await _load_owned_cv(db, cv_id=cv_id, user=current_user)
    jd = await _load_visible_jd(db, jd_id=jd_id, user=current_user)

    agenda = await get_existing_agenda(db, user=current_user, cv=cv, jd=jd)
    if not agenda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chưa có agenda phỏng vấn cho cặp CV và JD này. Hãy tạo mới trước.",
        )
    return _to_out(agenda)


@router.post("", response_model=InterviewAgendaOut)
async def create_agenda(
    payload: InterviewAgendaCreateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewAgendaOut:
    """Tạo agenda cho cặp CV+JD, tái dùng bản đã có nếu tồn tại (không gọi LLM
    lần nữa). Trả 201 khi vừa sinh mới, 200 khi dùng lại bản cũ.
    """
    cv = await _load_owned_cv(db, cv_id=payload.cv_id, user=current_user)
    jd = await _load_visible_jd(db, jd_id=payload.jd_id, user=current_user)

    agenda, was_generated = await ensure_agenda(
        db,
        user=current_user,
        cv=cv,
        jd=jd,
        num_questions=payload.num_questions,
        competency_focus=payload.competency_focus,
    )

    response.status_code = status.HTTP_201_CREATED if was_generated else status.HTTP_200_OK
    return _to_out(agenda)


@router.post("/{agenda_id}/regenerate", response_model=InterviewAgendaOut)
async def regenerate_agenda(
    agenda_id: str,
    payload: InterviewAgendaRegenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewAgendaOut:
    """Ép sinh lại agenda (bấm "Sinh lại"): luôn gọi LLM, ghi đè tại chỗ và tăng `revision_no`."""
    agenda = await _load_owned_agenda(db, agenda_id=agenda_id, user=current_user)
    cv, jd = await _resolve_cv_jd_from_agenda(db, agenda=agenda, user=current_user)

    agenda, _was_generated = await ensure_agenda(
        db,
        user=current_user,
        cv=cv,
        jd=jd,
        num_questions=payload.num_questions,
        competency_focus=payload.competency_focus,
        force_regenerate=True,
    )
    return _to_out(agenda)


@router.patch("/{agenda_id}", response_model=InterviewAgendaOut)
async def update_agenda_questions(
    agenda_id: str,
    payload: InterviewAgendaEnabledUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewAgendaOut:
    """Bật/tắt từng câu hỏi trong agenda. Từ chối nếu thao tác làm tắt hết mọi câu — `set_questions_enabled()` giữ nguyên trạng thái trong trường hợp đó, nên ở đây phải tự phát hiện lại để trả lỗi thay vì im lặng trả 200."""
    agenda = await _load_owned_agenda(db, agenda_id=agenda_id, user=current_user)

    current_questions = list(agenda.questions_json or [])
    projected_enabled = {
        str(question.get("id")): payload.enabled.get(str(question.get("id")), question.get("is_enabled", True))
        for question in current_questions
    }
    if current_questions and not any(projected_enabled.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tắt hết mọi câu hỏi trong agenda — phải giữ lại ít nhất một câu.",
        )

    agenda = await set_questions_enabled(db, agenda=agenda, enabled_by_id=payload.enabled)
    return _to_out(agenda)
