"""Cuộc đua trên cv_snapshots/jd_snapshots khi hai luồng chạm cùng một nguồn.

`get_or_create_cv_snapshot()` và `get_or_create_jd_snapshot()` cấp
`version_number` bằng `max(version_number) + 1` — một phép đọc-rồi-ghi. Hai
request song song cùng đọc ra một số rồi cùng INSERT sẽ vi phạm
`uq_cv_snapshot_version` / `uq_jd_snapshot_version` và trả 500 cho người dùng.

Hai hàm này là tầng dùng chung của 8 nơi gọi (analysis, matches, cvs,
interviews, job_recommendations, cv_variant_service, match_persistence,
interview_agenda_service), nên bộ test ở đây kiểm cả tầng API lẫn tầng hàm.
"""

import asyncio

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.db.models import CV, CVSnapshot, JDSnapshot, MatchRun
from src.services.pipeline_context import (
    PIPELINE_VERSION,
    get_or_create_cv_snapshot,
    get_or_create_jd_snapshot,
)
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login
from tests.test_api.test_career_workflows import GAP_RESULT


@pytest.mark.asyncio
async def test_match_flow_reuses_snapshot_created_by_analysis(client, monkeypatch):
    """Luồng /matches dùng lại snapshot do /analysis tạo, không sinh bản mới.

    Chạy TUẦN TỰ chứ không song song, và đây là một giới hạn của bộ test chứ
    không phải của bản sửa. POST /api/v1/matches đẩy pipeline chấm điểm sang
    BackgroundTasks với session lấy bind từ cùng engine; trên SQLite in-memory
    (StaticPool) nghĩa là background session dùng chung ĐÚNG MỘT connection với
    request đang chạy. Chồng hai thứ đó lên nhau thì ranh giới transaction của
    bên này cắt ngang bên kia và ném StaleDataError ("UPDATE statement on table
    'matches' expected to update 1 row(s); 0 were matched") ở khoảng 40% số lần
    chạy — nhiễu của harness, không tái hiện trên PostgreSQL nơi hai session có
    hai connection riêng.

    Phần đồng thời thật của luồng này được các test cấp hàm bên dưới bao phủ,
    nơi không có background task nào xen vào.
    """
    user, headers = await register_and_login(client, email="match-reuse@example.com")
    cv = await insert_cv(
        email=user["email"],
        raw_text="[PAGE 1]\nDeveloped REST APIs with Python, FastAPI and PostgreSQL.",
        parsed_json={"skills": ["Python", "FastAPI", "PostgreSQL"]},
    )
    jd = await insert_jd(
        owner_email=user["email"],
        requirements_text="Python, FastAPI and PostgreSQL are required. Design REST APIs.",
    )

    async def fake_analysis(**_kwargs):
        return GAP_RESULT

    monkeypatch.setattr("src.api.v1.analysis.perform_cv_jd_gap_analysis", fake_analysis)

    gap = await client.post(
        "/api/v1/analysis/gap-analysis",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert gap.status_code == 201, gap.text

    match = await client.post(
        "/api/v1/matches",
        headers=headers,
        json={"candidate_id": cv.id, "job_id": jd.id},
    )
    assert match.status_code == 202, match.text

    async with TestingSessionLocal() as db:
        cv_snapshots = (
            await db.scalars(select(CVSnapshot).where(CVSnapshot.cv_id == cv.id))
        ).all()
        jd_snapshots = (
            await db.scalars(select(JDSnapshot).where(JDSnapshot.jd_id == jd.id))
        ).all()

    assert len(cv_snapshots) == 1
    assert len(jd_snapshots) == 1


@pytest.mark.asyncio
async def test_two_sessions_create_same_cv_snapshot(client):
    """Hai session cùng tạo snapshot đầu tiên cho một CV: dùng chung một hàng.

    Ép đúng cửa sổ hẹp giữa `max(version_number)` và `INSERT`: cả hai session
    đọc max TRƯỚC khi bên nào kịp ghi, nên cả hai đều tính ra version = 1.
    """
    user, _headers = await register_and_login(client, email="snapshot-pair@example.com")
    cv = await insert_cv(email=user["email"])

    async with TestingSessionLocal() as db_a, TestingSessionLocal() as db_b:
        cv_a = await db_a.get(type(cv), cv.id)
        cv_b = await db_b.get(type(cv), cv.id)
        snapshot_a, snapshot_b = await asyncio.gather(
            get_or_create_cv_snapshot(db_a, cv_a),
            get_or_create_cv_snapshot(db_b, cv_b),
        )
        assert snapshot_a.source_hash == snapshot_b.source_hash
        assert snapshot_a.id == snapshot_b.id, "Hai session phải dùng chung một snapshot"
        await db_a.commit()

    async with TestingSessionLocal() as db:
        rows = (await db.scalars(select(CVSnapshot).where(CVSnapshot.cv_id == cv.id))).all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_version_number_taken_by_another_source_hash(client):
    """Số version bị một snapshot có source_hash KHÁC chiếm mất.

    Đây là nhánh còn lại của cuộc đua: va chạm unique nhưng snapshot của mình
    vẫn chưa tồn tại. Hàm phải cấp số kế tiếp thay vì trả về bản của người
    khác (sai nội dung) hoặc ném 500.
    """
    user, _headers = await register_and_login(client, email="snapshot-steal@example.com")
    cv = await insert_cv(email=user["email"])

    async with TestingSessionLocal() as db:
        cv_row = await db.get(type(cv), cv.id)
        first = await get_or_create_cv_snapshot(db, cv_row)
        assert first.version_number == 1

        # Nguồn đổi nội dung -> source_hash mới, phải sinh snapshot mới.
        cv_row.raw_text = "Nội dung CV đã được người dùng sửa lại."
        second = await get_or_create_cv_snapshot(db, cv_row)
        await db.commit()

    assert second.id != first.id
    assert second.version_number == 2
    assert second.source_hash != first.source_hash

    async with TestingSessionLocal() as db:
        rows = (await db.scalars(select(CVSnapshot).where(CVSnapshot.cv_id == cv.id))).all()
    assert len(rows) == 2
    assert sorted(row.version_number for row in rows) == [1, 2]


@pytest.mark.asyncio
async def test_jd_snapshot_reused_across_concurrent_sessions(client):
    """Cùng kiểm tra cho JD: hai session song song không nhân đôi jd_snapshots."""
    user, _headers = await register_and_login(client, email="jd-snapshot-race@example.com")
    jd = await insert_jd(owner_email=user["email"])

    async with TestingSessionLocal() as db_a, TestingSessionLocal() as db_b:
        jd_a = await db_a.get(type(jd), jd.id)
        jd_b = await db_b.get(type(jd), jd.id)
        snap_a, snap_b = await asyncio.gather(
            get_or_create_jd_snapshot(db_a, jd_a),
            get_or_create_jd_snapshot(db_b, jd_b),
        )
        assert snap_a.id == snap_b.id
        await db_a.commit()

    async with TestingSessionLocal() as db:
        rows = (await db.scalars(select(JDSnapshot).where(JDSnapshot.jd_id == jd.id))).all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_caller_pending_work_survives_snapshot_conflict(client):
    """Va chạm snapshot không được vứt công việc caller đang làm dở.

    Đây là ràng buộc then chốt cho cả 8 nơi gọi. `matches.py` chẳng hạn
    `db.add(match)` RỒI mới gọi get_or_create_cv_snapshot, và hai hàm này chạy
    bên trong transaction của caller (chỉ flush, không commit). Nếu xử lý va
    chạm bằng `db.rollback()` thì hàng `matches` chưa commit sẽ bị vứt theo —
    im lặng và rất khó lần ra. Test dựng đúng hình đó: session A có MatchRun
    treo sẵn, thua cuộc đua snapshot, và MatchRun vẫn phải còn sau khi commit.
    """
    user, _headers = await register_and_login(client, email="pending-work@example.com")
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(owner_email=user["email"])
    match_id = "MATCH_PENDINGWORK"

    async with TestingSessionLocal() as db_a, TestingSessionLocal() as db_b:
        cv_a = await db_a.get(CV, cv.id)
        cv_b = await db_b.get(CV, cv.id)

        db_a.add(
            MatchRun(
                id=match_id,
                user_id=user["id"],
                cv_id=cv.id,
                jd_id=jd.id,
                status="PENDING",
                current_step="PENDING",
                pipeline_version=PIPELINE_VERSION,
            )
        )

        snapshot_a, snapshot_b = await asyncio.gather(
            get_or_create_cv_snapshot(db_a, cv_a),
            get_or_create_cv_snapshot(db_b, cv_b),
        )
        assert snapshot_a.id == snapshot_b.id

        await db_a.commit()

    async with TestingSessionLocal() as db:
        assert await db.get(MatchRun, match_id) is not None, (
            "MatchRun chưa commit đã bị bản sửa va chạm vứt mất"
        )
        rows = (await db.scalars(select(CVSnapshot).where(CVSnapshot.cv_id == cv.id))).all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_unique_index_rejects_duplicate_snapshot(client):
    """Ràng buộc nằm ở tầng DB chứ không chỉ ở tầng code.

    uq_cv_snapshot_version chỉ chặn khi hai bên cùng tính ra MỘT số version.
    Hàng dưới đây có version khác nhau nhưng trùng (cv_id, source_hash) — đúng
    thứ lọt qua được ràng buộc cũ. uq_cv_snapshot_source phải chặn nó.
    Migration đi kèm: migrations/20260823_10_uq_snapshot_source_hash.sql.
    """
    user, _headers = await register_and_login(client, email="uq-index@example.com")
    cv = await insert_cv(email=user["email"])

    async with TestingSessionLocal() as db:
        cv_row = await db.get(CV, cv.id)
        first = await get_or_create_cv_snapshot(db, cv_row)
        await db.commit()
        source_hash = first.source_hash
        user_id = first.user_id

    async with TestingSessionLocal() as db:
        db.add(
            CVSnapshot(
                cv_id=cv.id,
                user_id=user_id,
                version_number=first.version_number + 1,
                source_hash=source_hash,
                raw_text="",
                profile_json={},
            )
        )
        with pytest.raises(IntegrityError):
            await db.commit()
