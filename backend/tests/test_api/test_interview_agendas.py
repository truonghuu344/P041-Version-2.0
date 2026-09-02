import pytest
from sqlalchemy import select

from src.db.models import InterviewQuestion
from src.services.interview_agenda import DEFAULT_NUM_QUESTIONS
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login


@pytest.fixture(autouse=True)
def _stub_llm(monkeypatch):
    """Chặn mọi lời gọi LLM thật: agenda luôn rơi xuống bộ câu hỏi generic,
    nhưng vẫn đi qua đúng luồng sanitize/quota thật của tầng service.
    """
    calls = {"count": 0}

    async def fake_call_llm(_spec, _cv_text, _jd_text):
        calls["count"] += 1
        return None, "fallback-test"

    monkeypatch.setattr("src.services.interview_agenda_service._call_llm", fake_call_llm)
    return calls


@pytest.mark.asyncio
async def test_get_agenda_returns_404_when_never_generated(client):
    _user, headers = await register_and_login(client, email="agenda-404@example.com")
    cv = await insert_cv(email="agenda-404@example.com")
    jd = await insert_jd(is_system=True)

    response = await client.get(
        "/api/v1/interviews/agenda",
        headers=headers,
        params={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_creates_agenda_and_returns_201(client, _stub_llm):
    _user, headers = await register_and_login(client, email="agenda-create@example.com")
    cv = await insert_cv(email="agenda-create@example.com")
    jd = await insert_jd(is_system=True)

    response = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["revision_no"] == 1
    # Kể cả khi LLM không trả gì (stub trong test), agenda vẫn phải đủ đúng số
    # câu yêu cầu — kho câu generic được bảo đảm đủ mẫu cho mọi hạn ngạch bởi
    # test_interview_agenda.py::test_generic_pool_covers_worst_case_quota.
    assert len(body["questions"]) == DEFAULT_NUM_QUESTIONS
    assert sum(body["coverage"].values()) == len(body["questions"])
    assert _stub_llm["count"] == 1

    fetched = await client.get(
        "/api/v1/interviews/agenda",
        headers=headers,
        params={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_post_reuses_existing_agenda_without_calling_llm_again(client, _stub_llm):
    _user, headers = await register_and_login(client, email="agenda-reuse@example.com")
    cv = await insert_cv(email="agenda-reuse@example.com")
    jd = await insert_jd(is_system=True)

    first = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert first.status_code == 201
    assert _stub_llm["count"] == 1

    second = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["revision_no"] == 1
    # Không gọi thêm LLM khi agenda đã tồn tại.
    assert _stub_llm["count"] == 1


@pytest.mark.asyncio
async def test_regenerate_forces_new_call_and_bumps_revision(client, _stub_llm):
    _user, headers = await register_and_login(client, email="agenda-regen@example.com")
    cv = await insert_cv(email="agenda-regen@example.com")
    jd = await insert_jd(is_system=True)

    created = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    agenda_id = created.json()["id"]
    assert _stub_llm["count"] == 1

    regenerated = await client.post(
        f"/api/v1/interviews/agenda/{agenda_id}/regenerate",
        headers=headers,
        json={},
    )
    assert regenerated.status_code == 200, regenerated.text
    assert regenerated.json()["id"] == agenda_id
    assert regenerated.json()["revision_no"] == 2
    assert _stub_llm["count"] == 2


@pytest.mark.asyncio
async def test_patch_toggles_question_enabled_state(client):
    _user, headers = await register_and_login(client, email="agenda-patch@example.com")
    cv = await insert_cv(email="agenda-patch@example.com")
    jd = await insert_jd(is_system=True)

    created = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    agenda_id = created.json()["id"]
    questions = created.json()["questions"]
    target_id = questions[0]["id"]

    patched = await client.patch(
        f"/api/v1/interviews/agenda/{agenda_id}",
        headers=headers,
        json={"enabled": {target_id: False}},
    )
    assert patched.status_code == 200, patched.text
    updated_question = next(q for q in patched.json()["questions"] if q["id"] == target_id)
    assert updated_question["is_enabled"] is False

    reenabled = await client.patch(
        f"/api/v1/interviews/agenda/{agenda_id}",
        headers=headers,
        json={"enabled": {target_id: True}},
    )
    assert reenabled.status_code == 200
    updated_question = next(q for q in reenabled.json()["questions"] if q["id"] == target_id)
    assert updated_question["is_enabled"] is True


@pytest.mark.asyncio
async def test_patch_rejects_disabling_all_questions(client):
    _user, headers = await register_and_login(client, email="agenda-disable-all@example.com")
    cv = await insert_cv(email="agenda-disable-all@example.com")
    jd = await insert_jd(is_system=True)

    created = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    agenda_id = created.json()["id"]
    all_ids = [q["id"] for q in created.json()["questions"]]

    patched = await client.patch(
        f"/api/v1/interviews/agenda/{agenda_id}",
        headers=headers,
        json={"enabled": {qid: False for qid in all_ids}},
    )
    assert patched.status_code == 400

    # Trạng thái phải được giữ nguyên: không câu nào bị tắt.
    fetched = await client.get(
        "/api/v1/interviews/agenda",
        headers=headers,
        params={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert all(q["is_enabled"] for q in fetched.json()["questions"])


@pytest.mark.asyncio
async def test_other_user_cannot_access_agenda(client):
    _owner, owner_headers = await register_and_login(client, email="agenda-owner@example.com")
    _other, other_headers = await register_and_login(client, email="agenda-other@example.com")
    cv = await insert_cv(email="agenda-owner@example.com")
    jd = await insert_jd(is_system=True)

    created = await client.post(
        "/api/v1/interviews/agenda",
        headers=owner_headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    agenda_id = created.json()["id"]

    regenerate_response = await client.post(
        f"/api/v1/interviews/agenda/{agenda_id}/regenerate",
        headers=other_headers,
        json={},
    )
    assert regenerate_response.status_code == 403

    patch_response = await client.patch(
        f"/api/v1/interviews/agenda/{agenda_id}",
        headers=other_headers,
        json={"enabled": {"A-001": False}},
    )
    assert patch_response.status_code == 403


@pytest.mark.asyncio
async def test_num_questions_out_of_range_returns_422(client):
    _user, headers = await register_and_login(client, email="agenda-invalid@example.com")
    cv = await insert_cv(email="agenda-invalid@example.com")
    jd = await insert_jd(is_system=True)

    too_few = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "num_questions": 1},
    )
    assert too_few.status_code == 422

    too_many = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "num_questions": 99},
    )
    assert too_many.status_code == 422

    invalid_focus = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "competency_focus": "not-a-real-competency"},
    )
    assert invalid_focus.status_code == 422


@pytest.mark.asyncio
async def test_foreign_cv_and_private_jd_rejected(client):
    _owner, owner_headers = await register_and_login(client, email="agenda-cv-owner@example.com")
    _other, other_headers = await register_and_login(client, email="agenda-cv-other@example.com")
    foreign_cv = await insert_cv(email="agenda-cv-owner@example.com")
    private_jd = await insert_jd(owner_email="agenda-cv-owner@example.com")

    foreign_cv_response = await client.post(
        "/api/v1/interviews/agenda",
        headers=other_headers,
        json={"cv_id": foreign_cv.id, "jd_id": private_jd.id},
    )
    assert foreign_cv_response.status_code == 400

    own_cv = await insert_cv(email="agenda-cv-other@example.com")
    private_jd_response = await client.post(
        "/api/v1/interviews/agenda",
        headers=other_headers,
        json={"cv_id": own_cv.id, "jd_id": private_jd.id},
    )
    assert private_jd_response.status_code == 400


@pytest.mark.asyncio
async def test_text_interview_start_uses_agenda_and_records_link(client, _stub_llm):
    """Luồng text phải lấy câu hỏi TỪ agenda và ghi lại liên kết ngược.

    Đây là bất biến của việc nối agenda vào /interviews/start: câu hỏi của phiên
    phải trùng đúng câu trong agenda, và mỗi hàng interview_questions phải mang
    agenda_question_id để về sau truy vết được câu hỏi đã hỏi về đúng mục agenda
    (kèm competency, evidence, rubric của nó).
    """
    _user, headers = await register_and_login(client, email="agenda-start@example.com")
    cv = await insert_cv(email="agenda-start@example.com")
    jd = await insert_jd(is_system=True)

    created = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert created.status_code == 201, created.text
    agenda = created.json()
    agenda_texts = [q["question_vi"] for q in agenda["questions"] if q["is_enabled"]]
    agenda_ids = [q["id"] for q in agenda["questions"] if q["is_enabled"]]

    goi_llm_truoc = _stub_llm["count"]
    started = await client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3, "mode": "text"},
    )
    assert started.status_code == 201, started.text
    # Bắt đầu phiên KHÔNG được sinh agenda mới — đó là điểm tiết kiệm quota.
    assert _stub_llm["count"] == goi_llm_truoc

    body = started.json()
    assert body["question_text"] == agenda_texts[0]

    async with TestingSessionLocal() as db:
        rows = (
            await db.scalars(
                select(InterviewQuestion)
                .where(InterviewQuestion.session_id == body["session_id"])
                .order_by(InterviewQuestion.question_index)
            )
        ).all()

    assert len(rows) == 3
    assert [r.question_text for r in rows] == agenda_texts[:3]
    assert [r.agenda_question_id for r in rows] == agenda_ids[:3]


@pytest.mark.asyncio
async def test_concurrent_create_returns_existing_instead_of_500(client, monkeypatch):
    """Bấm đúp "Tạo bộ câu hỏi" (hoặc hai tab cùng mở) không được trả 500.

    ensure_agenda() tra cứu trước rồi mới INSERT. Nếu một request khác chen vào
    giữa hai bước đó, ràng buộc uq_interview_agenda_pair sẽ chặn — đúng như
    thiết kế, nhưng đó là kết quả MONG MUỐN chứ không phải lỗi: agenda cho cặp
    này đã tồn tại. Test mô phỏng cuộc đua bằng cách ép lần tra cứu đầu trả về
    None dù hàng đã có trong DB.
    """
    _user, headers = await register_and_login(client, email="agenda-race@example.com")
    cv = await insert_cv(email="agenda-race@example.com")
    jd = await insert_jd(is_system=True)

    first = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert first.status_code == 201, first.text

    from src.services import interview_agenda_service as svc

    that_find = svc._find_agenda
    calls = {"n": 0}

    async def stale_find(db, **kwargs):
        # Lần đầu giả vờ chưa có gì (đọc cũ) -> ép đi vào nhánh INSERT.
        calls["n"] += 1
        if calls["n"] == 1:
            return None
        return await that_find(db, **kwargs)

    monkeypatch.setattr(svc, "_find_agenda", stale_find)

    second = await client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert second.status_code == 200, second.text
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["revision_no"] == 1


@pytest.mark.asyncio
async def test_start_and_create_agenda_at_the_same_time(client, _stub_llm):
    """Bấm "Bắt đầu phỏng vấn" và "Tạo bộ câu hỏi" cùng lúc.

    Hai cuộc đua xếp chồng lên nhau, cả hai đều phải chịu được:
      1. trên `interview_agendas` — hai endpoint cùng gọi ensure_agenda() cho
         một cặp (CV, JD) nên cùng thấy "chưa có agenda" rồi cùng INSERT;
      2. trên `cv_snapshots`/`jd_snapshots` — ensure_agenda() mở đầu bằng
         get_or_create_cv_snapshot()/get_or_create_jd_snapshot(), vốn cấp
         version_number bằng max()+1 (xem test_pipeline_context_race.py).

    Cố ý KHÔNG tạo sẵn snapshot trước: chạy từ trạng thái trắng thì cả hai
    request cùng phải sinh snapshot đầu tiên, đúng như lần đầu người dùng chạm
    vào một CV. Không được có 500, và cuối cùng chỉ được tồn tại ĐÚNG MỘT
    agenda cho cặp đó.
    """
    import asyncio

    from src.db.models import InterviewAgenda

    _user, headers = await register_and_login(client, email="agenda-both@example.com")
    cv = await insert_cv(email="agenda-both@example.com")
    jd = await insert_jd(is_system=True)

    create_agenda = client.post(
        "/api/v1/interviews/agenda",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    start_interview = client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3, "mode": "text"},
    )
    agenda_res, start_res = await asyncio.gather(create_agenda, start_interview)

    assert agenda_res.status_code < 500, agenda_res.text
    assert start_res.status_code < 500, start_res.text
    assert agenda_res.status_code in (200, 201)
    assert start_res.status_code == 201

    # Chỉ một agenda duy nhất cho cặp này, không sinh ra bản trùng.
    async with TestingSessionLocal() as db:
        rows = (await db.scalars(select(InterviewAgenda))).all()
    assert len(rows) == 1, f"Phải còn đúng 1 agenda, đang có {len(rows)}"

    # Phiên phỏng vấn vừa tạo phải dùng chính agenda đó.
    assert agenda_res.json()["id"] == rows[0].id


@pytest.mark.asyncio
async def test_agenda_bao_loi_ro_rang_voi_jd_catalog_chua_import(client):
    """Issue #68 — id dạng `catalog:<source_id>` phải có thông báo đúng bản chất.

    JD trong catalog là hợp lệ, chỉ chưa được import vào bảng job_descriptions
    nên chưa có id thật. Thông báo cũ ("chọn 1 JD hợp lệ") gộp chung với "không
    tồn tại / không có quyền" khiến người debug đi sai hướng.
    """
    _user, headers = await register_and_login(client, email="agenda-catalog@example.com")
    cv = await insert_cv(email="agenda-catalog@example.com")

    response = await client.get(
        "/api/v1/interviews/agenda",
        headers=headers,
        params={"cv_id": cv.id, "jd_id": "catalog:JD-043"},
    )

    assert response.status_code == 400, response.text
    detail = response.json()["detail"]
    assert "catalog" in detail.lower(), detail
    assert "select" in detail.lower(), "Thông báo phải chỉ ra cách lấy id thật"
