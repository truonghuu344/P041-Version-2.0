"""Tái chuẩn hóa normalized_json cho mọi JobDescription bằng parser mới.

Vấn đề: các JD đã lưu trong DB trước cải tiến vẫn chứa giá trị bịa
(deadline hardcode, kinh nghiệm/học vấn mặc định, bảng quyền lợi mẫu).
Chúng vừa hiển thị sai ở card JD, vừa bị truyền vào metadata khi phân tích
làm nhiễu kết quả match.

Script đọc requirements_text gốc, chạy lại parse_job_description() và cập
nhật normalized_json. Không đổi title/company/location/requirements_text.

Chạy:  python scripts/reparse_jd_normalized.py [--dry-run]
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

_BACKEND_SRC = Path(__file__).resolve().parents[1] / "backend"
# Trong container backend, mã nguồn nằm tại /app/src
if (_BACKEND_SRC / "src").is_dir():
    sys.path.insert(0, str(_BACKEND_SRC))
elif Path("/app/src").is_dir():
    sys.path.insert(0, "/app")
    os.chdir("/app")
else:
    sys.path.insert(0, str(Path.cwd()))

from sqlalchemy import select
from src.db.database import AsyncSessionLocal
from src.db.models import JobDescription
from src.services.cv_jd_matching import parse_job_description
from src.services.text_cleaning import split_title_decorations


async def reparse(dry_run: bool = False) -> None:
    async with AsyncSessionLocal() as session:
        rows = (await session.scalars(select(JobDescription))).all()
        updated = skipped = 0
        for jd in rows:
            old = dict(jd.normalized_json or {})
            text = (jd.requirements_text or "").strip()
            if len(text) < 10:
                skipped += 1
                continue

            # Làm sạch tiêu đề lưu trong DB (bỏ tag [Junior], sửa khoảng trắng).
            clean_title = split_title_decorations(jd.title or "")["title"]
            if clean_title and clean_title != jd.title and not dry_run:
                jd.title = clean_title
            elif dry_run and clean_title != (jd.title or ""):
                print(f"[DRY] title: {(jd.title or '')[:50]!r} -> {clean_title!r}")

            fresh = parse_job_description(
                title=clean_title,
                requirements_text=text,
                metadata={
                    "company": jd.company,
                    "location": jd.location,
                    # Giữ nguyên dữ liệu nguồn có thật của catalog hệ thống
                    **{
                        key: old[key]
                        for key in (
                            "source",
                            "source_id",
                            "source_url",
                            "skills",
                            "domain",
                            "requirements_content_hash",
                            "source_file_hash",
                        )
                        if old.get(key)
                    },
                },
            )
            # Bảo toàn trường quản trị không do parser sinh ra
            for key in ("source", "source_id", "source_url", "skills", "domain",
                        "requirements_content_hash", "source_file_hash"):
                if old.get(key):
                    fresh[key] = old[key]
            if dry_run:
                changed = any(str(old.get(k)) != str(fresh.get(k)) for k in ("tags", "deadline", "experience", "education", "level"))
                print(f"[DRY] {jd.id[:8]} {jd.title[:40]:40s} changed={changed}")
                updated += 1
                continue
            jd.normalized_json = fresh
            updated += 1
        if not dry_run:
            await session.commit()
        print(f"\nDone: {updated} JD cập nhật, {skipped} bỏ qua (nội dung quá ngắn). dry_run={dry_run}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(reparse(dry_run=args.dry_run))
