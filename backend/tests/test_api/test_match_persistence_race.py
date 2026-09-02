"""Cuộc đua trên các artifact DÙNG CHUNG của match_persistence.

`persist_match_artifacts()` tạo năm loại hàng có khoá tất định, tức là hai lần
chạy khác nhau sẽ tính ra CÙNG một khoá:

    candidates.id       = candidate_id                (chung theo ứng viên)
    documents.id        = 'DOC_CV_<cv_snapshot_id>'   (chung theo snapshot)
    documents.id        = 'DOC_JD_<jd_snapshot_id>'   (chung theo snapshot)
    jobs.id             = 'JOB_<jd_id>'               (chung theo JD)
    rubrics.id          = 'RUBRIC_DEFAULT_V1'         (chung TOÀN HỆ THỐNG)

Mỗi chỗ đều theo khuôn "đọc xem có chưa, chưa có thì thêm" mà không xử lý va
chạm. Hai lần chạy song song cùng thấy "chưa có" rồi cùng INSERT là vi phạm
khoá chính. `RUBRIC_DEFAULT_V1` là nặng nhất: nó dùng chung cho MỌI người
dùng, nên bất kỳ hai lượt chấm điểm nào chạy chồng nhau cũng đụng.

Đo ở tầng hàm chứ không qua endpoint: POST /api/v1/matches đẩy pipeline sang
BackgroundTasks và background session lấy bind từ cùng engine, nên trên SQLite
in-memory của bộ test (StaticPool) nó dùng chung đúng một connection với
request — chồng hai thứ đó lên nhau chỉ đo được nhiễu của harness.
"""

import asyncio

import pytest
from sqlalchemy import select

from src.db.models import (
    CandidateArtifact,
    DocumentArtifact,
    JobArtifact,
    RubricCriterionDefinition,
    RubricDefinition,
)
from src.services.match_persistence import persist_match_artifacts
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login

SHARED_CANDIDATE_ID = "CAND_SHARED"


def _result(match_id: str) -> dict:
    """Kết quả chấm điểm tối thiểu, đủ để persist_match_artifacts chạy hết."""
    return {
        "match_id": match_id,
        "status": "COMPLETED",
        "match_score": 50.0,
        "final_score": 50.0,
        "rating": "AVERAGE",
        "candidate_id": SHARED_CANDIDATE_ID,
        "structured_cv": {
            "candidate_id": SHARED_CANDIDATE_ID,
            "candidate": {"current_title": "Backend Developer", "location": "Hà Nội"},
        },
        "structured_jd": {"job": {"title_original": "Backend Developer"}},
        "criteria": [],
        "versions": {},
    }


async def _persist(*, user_id: str, cv_id: str, jd_id: str, match_id: str):
    async with TestingSessionLocal() as db:
        await persist_match_artifacts(
            db,
            user_id=user_id,
            cv_id=cv_id,
            jd_id=jd_id,
            analysis_id=None,
            result=_result(match_id),
        )
        await db.commit()


@pytest.mark.asyncio
async def test_two_matches_on_same_cv_and_jd_at_the_same_time(client):
    """Hai lượt chấm điểm song song trên cùng CV+JD.

    Cả năm artifact dùng chung đều bị tranh: cùng candidate_id, cùng cặp
    snapshot, cùng JD, và cùng RUBRIC_DEFAULT_V1. Không được ném lỗi, và mỗi
    artifact dùng chung chỉ được tồn tại đúng một hàng.
    """
    user, _headers = await register_and_login(client, email="mp-race@example.com")
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(owner_email=user["email"])

    await asyncio.gather(
        _persist(user_id=user["id"], cv_id=cv.id, jd_id=jd.id, match_id="MATCH_AAA"),
        _persist(user_id=user["id"], cv_id=cv.id, jd_id=jd.id, match_id="MATCH_BBB"),
    )

    async with TestingSessionLocal() as db:
        candidates = (await db.scalars(select(CandidateArtifact))).all()
        documents = (await db.scalars(select(DocumentArtifact))).all()
        jobs = (await db.scalars(select(JobArtifact))).all()
        rubrics = (await db.scalars(select(RubricDefinition))).all()
        criteria = (await db.scalars(select(RubricCriterionDefinition))).all()

    assert len(candidates) == 1, f"candidates: phải 1, đang có {len(candidates)}"
    assert len(jobs) == 1, f"jobs: phải 1, đang có {len(jobs)}"
    assert len(rubrics) == 1, f"rubrics: phải 1, đang có {len(rubrics)}"
    # documents: đúng một hàng cho CV snapshot và một cho JD snapshot.
    assert len(documents) == 2, f"documents: phải 2, đang có {len(documents)}"
    assert sorted(d.document_type for d in documents) == ["CV", "JD"]
    # rubric_criteria có ràng buộc unique (rubric_id, criterion_id) — không
    # được nhân đôi khi hai lượt cùng khởi tạo rubric mặc định.
    assert len(criteria) == len({(c.rubric_id, c.criterion_id) for c in criteria})


@pytest.mark.asyncio
async def test_two_users_matching_the_same_system_jd_at_the_same_time(client):
    """Hai NGƯỜI DÙNG KHÁC NHAU cùng chấm điểm trên một JD hệ thống.

    Đây là tình huống dễ gặp nhất trong thực tế: JD hệ thống ai cũng thấy, và
    'JOB_<jd_id>' cùng 'RUBRIC_DEFAULT_V1' không hề gắn với người dùng nào.
    Không cần hai người thao tác cùng một CV vẫn đụng nhau.
    """
    user_a, _ = await register_and_login(client, email="mp-a@example.com")
    user_b, _ = await register_and_login(client, email="mp-b@example.com")
    cv_a = await insert_cv(email=user_a["email"], title="CV A")
    cv_b = await insert_cv(email=user_b["email"], title="CV B")
    jd = await insert_jd(is_system=True)

    await asyncio.gather(
        _persist(user_id=user_a["id"], cv_id=cv_a.id, jd_id=jd.id, match_id="MATCH_UA"),
        _persist(user_id=user_b["id"], cv_id=cv_b.id, jd_id=jd.id, match_id="MATCH_UB"),
    )

    async with TestingSessionLocal() as db:
        jobs = (await db.scalars(select(JobArtifact))).all()
        rubrics = (await db.scalars(select(RubricDefinition))).all()

    assert len(jobs) == 1, f"jobs: phải 1, đang có {len(jobs)}"
    assert len(rubrics) == 1, f"rubrics: phải 1, đang có {len(rubrics)}"


@pytest.mark.asyncio
async def test_second_match_reuses_shared_artifacts(client):
    """Chạy tuần tự thì không được nhân đôi — lưới an toàn cho bản sửa.

    Nếu một bản sửa va chạm lỡ tay biến "đã có rồi" thành "thêm hàng nữa" thì
    test đồng thời ở trên vẫn có thể xanh do may mắn về thứ tự. Test này chốt
    luôn hành vi tuần tự.
    """
    user, _headers = await register_and_login(client, email="mp-seq@example.com")
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(owner_email=user["email"])

    await _persist(user_id=user["id"], cv_id=cv.id, jd_id=jd.id, match_id="MATCH_S1")
    await _persist(user_id=user["id"], cv_id=cv.id, jd_id=jd.id, match_id="MATCH_S2")

    async with TestingSessionLocal() as db:
        assert len((await db.scalars(select(CandidateArtifact))).all()) == 1
        assert len((await db.scalars(select(JobArtifact))).all()) == 1
        assert len((await db.scalars(select(RubricDefinition))).all()) == 1
        assert len((await db.scalars(select(DocumentArtifact))).all()) == 2
