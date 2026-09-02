"""`agenda_question_id` phải là danh tính, không phải số thứ tự.

`interview_questions.agenda_question_id` lưu id của mục agenda đã sinh ra câu
hỏi đó. Không có khoá ngoại nào bảo vệ nó — đích tham chiếu nằm BÊN TRONG cột
`interview_agendas.questions_json` chứ không phải một hàng riêng — nên tính
đúng đắn của liên kết hoàn toàn dựa vào cách sinh id.

Bản đầu gán id theo vị trí cuối cùng (`A-001`, `A-002`, ...). Cách đó hỏng ở
hai chỗ, và cái thứ hai nguy hiểm hơn nhiều:

1. Mọi agenda đều có `A-001` — cầm mình id thì không biết nó thuộc agenda nào.
2. `ensure_agenda(force_regenerate=True)` ghi đè `questions_json` TẠI CHỖ, giữ
   nguyên hàng agenda và nguyên không gian id, chỉ tăng `revision_no` (mà
   `interview_questions` không hề ghi lại). Sau một lần bấm "Sinh lại", id cũ
   trỏ sang một câu hỏi khác hẳn — và vẫn phân giải THÀNH CÔNG. Đo được trên
   bản cũ: trong 10 câu đã hỏi, 1 tra đúng, 2 tra ra câu khác, 7 mất hẳn.

Id ngẫu nhiên không làm câu hỏi cũ sống lại. Nó biến "sai âm thầm" thành
"không tra ngược được" — một trạng thái nhìn thấy được và xử lý được.
"""

import pytest
from sqlalchemy import select

from src.db.models import InterviewQuestion
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login


@pytest.fixture(autouse=True)
def _stub_llm(monkeypatch):
    """Chặn LLM thật: agenda rơi xuống bộ câu generic nhưng vẫn đi qua đúng
    luồng sanitize/quota thật của tầng service."""

    async def fake_call_llm(_spec, _cv_text, _jd_text):
        return None, "fallback-test"

    monkeypatch.setattr("src.services.interview_agenda_service._call_llm", fake_call_llm)


async def _create_agenda(client, headers, *, cv_id, jd_id, num_questions=None):
    payload = {"cv_id": cv_id, "jd_id": jd_id}
    if num_questions is not None:
        payload["num_questions"] = num_questions
    response = await client.post("/api/v1/interviews/agenda", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_ids_do_not_collide_across_agendas(client):
    """Hai agenda khác nhau không được dùng chung một id nào."""
    user, headers = await register_and_login(client, email="agenda-id-1@example.com")
    cv_one = await insert_cv(email=user["email"], title="CV Python")
    cv_two = await insert_cv(
        email=user["email"], title="CV Java", raw_text="Java Spring Boot Kafka microservices"
    )
    jd = await insert_jd(is_system=True)

    first = await _create_agenda(client, headers, cv_id=cv_one.id, jd_id=jd.id)
    second = await _create_agenda(client, headers, cv_id=cv_two.id, jd_id=jd.id)

    ids_first = {q["id"] for q in first["questions"]}
    ids_second = {q["id"] for q in second["questions"]}

    assert ids_first, "agenda phải có câu hỏi"
    assert ids_second
    assert not (ids_first & ids_second), (
        "Hai agenda dùng chung id: " + ", ".join(sorted(ids_first & ids_second))
    )


@pytest.mark.asyncio
async def test_ids_are_unique_within_one_agenda(client):
    """Trong một agenda, id phải phân biệt — set_questions_enabled tra theo id."""
    user, headers = await register_and_login(client, email="agenda-id-2@example.com")
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(is_system=True)

    agenda = await _create_agenda(client, headers, cv_id=cv.id, jd_id=jd.id, num_questions=12)
    ids = [q["id"] for q in agenda["questions"]]

    assert len(ids) == len(set(ids))


@pytest.mark.asyncio
async def test_regenerate_does_not_reuse_ids_of_previous_revision(client):
    """Sinh lại phải cấp id mới, không tái sử dụng id của bản trước.

    Đây là ràng buộc quan trọng nhất trong file: nếu id được tái sử dụng thì
    `agenda_question_id` của các phiên phỏng vấn cũ sẽ phân giải sang câu hỏi
    của bản mới mà không có dấu hiệu nào cho thấy đã sai.
    """
    user, headers = await register_and_login(client, email="agenda-id-3@example.com")
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(is_system=True)

    created = await _create_agenda(client, headers, cv_id=cv.id, jd_id=jd.id, num_questions=12)
    agenda_id = created["id"]
    ids_before = {q["id"] for q in created["questions"]}

    regenerated = await client.post(
        f"/api/v1/interviews/agenda/{agenda_id}/regenerate",
        headers=headers,
        json={"num_questions": 3, "competency_focus": "motivation"},
    )
    assert regenerated.status_code == 200, regenerated.text
    assert regenerated.json()["revision_no"] == 2
    ids_after = {q["id"] for q in regenerated.json()["questions"]}

    assert not (ids_before & ids_after), (
        "Bản sinh lại dùng lại id của bản trước: " + ", ".join(sorted(ids_before & ids_after))
    )


@pytest.mark.asyncio
async def test_recorded_question_id_never_resolves_to_a_different_question(client):
    """Sau khi sinh lại, id đã ghi hoặc tra đúng câu đã hỏi, hoặc không tra được.

    Điều KHÔNG được phép là tra ra một câu hỏi khác: khi đó liên kết vẫn phân
    giải thành công nên không có cách nào phát hiện là nó đã sai.
    """
    user, headers = await register_and_login(client, email="agenda-id-4@example.com")
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(is_system=True)

    created = await _create_agenda(client, headers, cv_id=cv.id, jd_id=jd.id, num_questions=12)
    agenda_id = created["id"]

    started = await client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 10, "mode": "text"},
    )
    assert started.status_code == 201, started.text

    async with TestingSessionLocal() as db:
        rows = (
            await db.scalars(
                select(InterviewQuestion).order_by(InterviewQuestion.question_index)
            )
        ).all()
        recorded = [(row.agenda_question_id, row.question_text) for row in rows]

    assert recorded, "phiên phỏng vấn phải ghi lại câu hỏi"
    assert all(agenda_question_id for agenda_question_id, _ in recorded)

    regenerated = await client.post(
        f"/api/v1/interviews/agenda/{agenda_id}/regenerate",
        headers=headers,
        json={"num_questions": 3, "competency_focus": "motivation"},
    )
    assert regenerated.status_code == 200, regenerated.text
    after = {q["id"]: q["question_vi"] for q in regenerated.json()["questions"]}

    misresolved = [
        (agenda_question_id, asked, after[agenda_question_id])
        for agenda_question_id, asked in recorded
        if agenda_question_id in after and after[agenda_question_id] != asked
    ]
    assert not misresolved, (
        "Id đã ghi tra ra câu hỏi KHÁC sau khi sinh lại — sai mà không phát hiện được: "
        + "; ".join(f"{qid}: đã hỏi {asked[:40]!r}, giờ ra {now[:40]!r}" for qid, asked, now in misresolved)
    )
