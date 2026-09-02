"""Versioned, reusable source context for the three career workflows."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import Table, func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CV, CVSnapshot, JDSnapshot, JobDescription, generate_uuid

PIPELINE_VERSION = "2.1"

# Số lần cấp lại version_number khi một request song song chiếm mất số vừa
# tính. Mỗi vòng đọc lại max(version_number) nên chỉ cần đủ để vượt qua vài
# request chồng nhau; chạm trần nghĩa là có gì đó sai chứ không còn là tranh chấp.
_MAX_VERSION_ATTEMPTS = 5


def _fingerprint(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _pages(raw_text: str) -> list[dict[str, Any]]:
    """Preserve source pages when the parser left explicit page markers."""
    import re

    markers = list(re.finditer(r"(?m)^\[PAGE\s+(\d+)\]\s*$", raw_text))
    if not markers:
        return [{"page_number": 1, "text": raw_text}] if raw_text else []
    return [
        {
            "page_number": int(marker.group(1)),
            "text": raw_text[marker.end() : markers[index + 1].start() if index + 1 < len(markers) else len(raw_text)].strip(),
        }
        for index, marker in enumerate(markers)
    ]


async def insert_ignoring_conflict(
    db: AsyncSession,
    table: Table,
    values: dict[str, Any],
    *,
    index_elements: list[str] | None = None,
) -> bool:
    """INSERT bỏ qua trong im lặng nếu va chạm unique trên `index_elements`.

    Dùng chung cho mọi bảng có ràng buộc unique bị hai request song song
    tranh nhau, không riêng snapshot.

    Trả về True nếu hàng đã được ghi, False nếu bị bỏ qua vì đã có hàng khác
    chiếm chỗ.

    Cố ý KHÔNG để IntegrityError thoát ra và KHÔNG rollback. Hai hàm
    `get_or_create_*_snapshot` chạy BÊN TRONG transaction của caller — chúng
    chỉ flush chứ không commit — nên một lần `db.rollback()` ở đây sẽ vứt luôn
    công việc caller đang làm dở (`matches.py` chẳng hạn đã `db.add(match)`
    trước khi gọi vào đây). Savepoint cũng không cứu được: SAVEPOINT thuộc
    phạm vi connection, mà cả hai request có thể dùng chung một connection.

    `index_elements` giới hạn phạm vi bỏ qua về đúng một ràng buộc, để mọi
    lỗi toàn vẹn khác vẫn nổi lên bình thường thay vì bị nuốt. Bỏ trống khi
    bảng có NHIỀU ràng buộc unique mà va chạm ở bất kỳ ràng buộc nào cũng là
    tình huống hợp lệ cần xử lý — ON CONFLICT chỉ nhắm được một index mỗi
    lần, nên nhắm vào một cái sẽ để cái còn lại ném ra ngoài.
    """
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as conflict_aware_insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as conflict_aware_insert
    else:
        # Dialect không có ON CONFLICT: cô lập lần ghi trong một savepoint để
        # rollback chỉ huỷ đúng câu INSERT này, không chạm phần còn lại.
        try:
            async with db.begin_nested():
                await db.execute(insert(table).values(**values))
        except IntegrityError:
            return False
        return True

    statement = conflict_aware_insert(table).values(**values)
    statement = (
        statement.on_conflict_do_nothing(index_elements=index_elements)
        if index_elements
        else statement.on_conflict_do_nothing()
    )
    result = await db.execute(statement)
    return bool(result.rowcount)


async def _find_snapshot(
    db: AsyncSession,
    *,
    model: type[CVSnapshot] | type[JDSnapshot],
    owner_column: str,
    owner_id: str,
    source_hash: str,
) -> Any:
    return await db.scalar(
        select(model)
        .where(getattr(model, owner_column) == owner_id, model.source_hash == source_hash)
        .order_by(model.version_number.desc())
        .limit(1)
    )


async def _create_snapshot(
    db: AsyncSession,
    *,
    model: type[CVSnapshot] | type[JDSnapshot],
    owner_column: str,
    owner_id: str,
    source_hash: str,
    values: dict[str, Any],
) -> Any:
    """Cấp version_number kế tiếp và ghi snapshot, chịu được request song song.

    `max(version_number) + 1` là một phép đọc-rồi-ghi: hai request cùng đọc ra
    một số rồi cùng INSERT sẽ vi phạm ràng buộc unique theo version, còn nếu
    lệch nhịp hơn thì vi phạm ràng buộc unique theo source_hash. Ở đây va
    chạm không còn là lỗi mà là thông tin — hoặc request kia đã tạo đúng
    snapshot mình cần (dùng lại), hoặc nó chỉ chiếm mất số version (cấp số kế
    tiếp rồi thử lại).
    """
    # Ghi trước mọi thứ caller đang treo trong session. Bản cũ dùng ORM nên
    # `db.flush()` tự đẩy các hàng cha (CV/JD vừa tạo) xuống trước snapshot;
    # ở đây INSERT đi thẳng qua Core nên phải flush tường minh, nếu không
    # khoá ngoại của snapshot có thể trỏ vào hàng chưa tồn tại.
    await db.flush()

    for _ in range(_MAX_VERSION_ATTEMPTS):
        current_max = await db.scalar(
            select(func.max(model.version_number)).where(getattr(model, owner_column) == owner_id)
        )
        version = int(current_max or 0) + 1

        # Đọc lại theo source_hash NGAY TRƯỚC khi ghi. Va chạm unique chỉ bắt
        # được trường hợp hai request cùng tính ra một số version; nếu request
        # kia đã ghi xong trước khi mình đọc max thì mình tính ra số kế tiếp và
        # INSERT trót lọt — sinh ra hàng thứ hai trùng hệt nội dung. Snapshot là
        # ranh giới cache nên hàng trùng làm hỏng việc tái dùng, không chỉ tốn chỗ.
        concurrent = await _find_snapshot(
            db,
            model=model,
            owner_column=owner_column,
            owner_id=owner_id,
            source_hash=source_hash,
        )
        if concurrent is not None:
            return concurrent

        snapshot_id = generate_uuid()
        written = await insert_ignoring_conflict(
            db,
            model.__table__,
            {
                "id": snapshot_id,
                owner_column: owner_id,
                "version_number": version,
                "source_hash": source_hash,
                **values,
            },
            # Không nhắm index: bảng có hai ràng buộc unique và va chạm ở cả
            # hai đều hợp lệ — (nguồn, version_number) nghĩa là bị cướp mất số
            # version, (nguồn, source_hash) nghĩa là request kia đã tạo đúng
            # snapshot mình cần. Cả hai được phân biệt bằng lần đọc lại bên dưới.
        )
        if written:
            return await db.get(model, snapshot_id)

        winner = await _find_snapshot(
            db,
            model=model,
            owner_column=owner_column,
            owner_id=owner_id,
            source_hash=source_hash,
        )
        if winner is not None:
            # Request song song đã tạo đúng snapshot cho nguồn này. Dùng lại
            # bản của nó — đó vốn là kết quả mong muốn của hàm này.
            return winner
        # Số version bị một snapshot có source_hash khác chiếm mất. Đọc lại
        # max rồi thử số kế tiếp.

    raise RuntimeError(
        f"Không cấp được version_number cho {model.__tablename__} "
        f"(nguồn {owner_id}) sau {_MAX_VERSION_ATTEMPTS} lần thử."
    )


async def get_or_create_cv_snapshot(db: AsyncSession, cv: CV) -> CVSnapshot:
    profile = dict(cv.parsed_json or {})
    source_hash = _fingerprint({"raw_text": cv.raw_text or "", "profile": profile})
    existing = await _find_snapshot(
        db, model=CVSnapshot, owner_column="cv_id", owner_id=cv.id, source_hash=source_hash
    )
    if existing:
        return existing
    return await _create_snapshot(
        db,
        model=CVSnapshot,
        owner_column="cv_id",
        owner_id=cv.id,
        source_hash=source_hash,
        values={
            "user_id": cv.user_id,
            "raw_text": cv.raw_text or "",
            "profile_json": profile,
            "pages_json": _pages(cv.raw_text or ""),
            "source_language": str(profile.get("language") or "vi"),
        },
    )


async def get_or_create_jd_snapshot(db: AsyncSession, jd: JobDescription) -> JDSnapshot:
    normalized = dict(jd.normalized_json or {})
    requirements = normalized.get("requirements") or normalized
    source_hash = _fingerprint({"requirements_text": jd.requirements_text, "normalized": normalized})
    existing = await _find_snapshot(
        db, model=JDSnapshot, owner_column="jd_id", owner_id=jd.id, source_hash=source_hash
    )
    if existing:
        return existing
    return await _create_snapshot(
        db,
        model=JDSnapshot,
        owner_column="jd_id",
        owner_id=jd.id,
        source_hash=source_hash,
        values={
            "raw_text": jd.requirements_text or "",
            "requirements_json": {"requirements": requirements, "normalized": normalized},
            "pages_json": _pages(jd.requirements_text or ""),
            "source_language": str(normalized.get("language") or "vi"),
        },
    )
