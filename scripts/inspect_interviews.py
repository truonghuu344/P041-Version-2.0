"""Đọc lại các phiên phỏng vấn đã lưu trong database.

Khác với `docker compose logs` (log runtime, mất khi restart), script này đọc
dữ liệu đã lưu: câu hỏi AI đã hỏi, câu trả lời ứng viên, điểm STAR, báo cáo.

Dùng để trả lời câu hỏi quan trọng nhất khi debug voice: **STT có nghe được
gì không**. Nếu `user_answer` rỗng ở mọi câu thì micro/STT hỏng, dù buổi
phỏng vấn trông vẫn "chạy" trên giao diện.

Cách chạy (PowerShell, ở thư mục gốc, cần Postgres đang chạy):

    $env:PYTHONPATH="backend"; .venv\\Scripts\\python.exe scripts/inspect_interviews.py

Tùy chọn:

    --limit N        chỉ xem N phiên gần nhất (mặc định 10)
    --session ID     xem chi tiết một phiên
    --full           in nguyên văn, không cắt ngắn
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload
from src.db.database import AsyncSessionLocal
from src.db.models import InterviewReport, InterviewSession, UsageEvent

LINE = "─" * 78


def _clip(text: str | None, limit: int, full: bool) -> str:
    if not text:
        return ""
    text = " ".join(text.split())
    if full or len(text) <= limit:
        return text
    return text[:limit] + "…"


def _answer_health(answers: list[str | None]) -> str:
    """Chẩn đoán nhanh: câu trả lời rỗng gần như luôn là lỗi STT."""
    if not answers:
        return "KHÔNG CÓ CÂU NÀO — phiên kết thúc trước khi hỏi được gì"
    filled = [a for a in answers if a and a.strip()]
    if not filled:
        return "MỌI CÂU TRẢ LỜI ĐỀU RỖNG — nghi STT không nghe được"
    if len(filled) < len(answers):
        return f"{len(answers) - len(filled)}/{len(answers)} câu rỗng"
    avg = sum(len(a) for a in filled) / len(filled)
    if avg < 25:
        return f"câu trả lời rất ngắn (trung bình {avg:.0f} ký tự) — nghi STT cắt cụt"
    return f"ổn ({len(filled)} câu, trung bình {avg:.0f} ký tự)"


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--session", type=str, default=None)
    parser.add_argument("--full", action="store_true")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        query = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.questions),
                selectinload(InterviewSession.cv),
                selectinload(InterviewSession.jd),
            )
            .order_by(desc(InterviewSession.created_at))
        )
        if args.session:
            query = query.where(InterviewSession.id == args.session)
        else:
            query = query.limit(args.limit)

        sessions = (await db.execute(query)).scalars().all()
        if not sessions:
            print("Không có phiên phỏng vấn nào trong database.")
            return 0

        # Lấy hết UsageEvent rồi ghép trong Python: truy vấn theo đường dẫn JSON
        # là cú pháp riêng của từng loại database, ghép ở đây thì chạy ở đâu cũng được.
        usage_events = (
            await db.execute(
                select(UsageEvent).where(
                    UsageEvent.event_name == "voice_interview_session"
                )
            )
        ).scalars().all()
        usage_by_session = {
            (e.metadata_json or {}).get("session_id"): e for e in usage_events
        }

        print(f"\n{len(sessions)} phiên (mới nhất trước)\n")

        for s in sessions:
            report = await db.scalar(
                select(InterviewReport).where(InterviewReport.session_id == s.id)
            )
            usage = usage_by_session.get(s.id)

            answers = [q.user_answer for q in s.questions]

            print(LINE)
            print(f"Phiên   : {s.id}")
            print(f"Chế độ  : {s.mode} | {s.language} | trạng thái: {s.status}")
            print(f"Bắt đầu : {s.created_at}")
            print(f"Kết thúc: {s.completed_at or '(chưa hoàn thành)'}")
            if usage and usage.duration_ms:
                turns = (usage.metadata_json or {}).get("turns", "?")
                print(f"Thời lượng: {usage.duration_ms / 1000:.1f}s | {turns} lượt")
            print(f"CV      : {_clip(s.cv.title if s.cv else None, 60, args.full)}")
            print(f"JD      : {_clip(s.jd.title if s.jd else None, 60, args.full)}")
            print(f"Chẩn đoán: {_answer_health(answers)}")

            if s.questions:
                print()
                for q in s.questions:
                    ans = q.user_answer or ""
                    flag = "  ⚠ RỖNG" if not ans.strip() else f"  ({len(ans)} ký tự)"
                    print(f"  [{q.question_index}] HỎI: {_clip(q.question_text, 100, args.full)}")
                    print(f"      TRẢ LỜI:{flag} {_clip(ans, 100, args.full)}")
                    if q.star_score_json:
                        parts = ", ".join(f"{k[0].upper()}={v}" for k, v in q.star_score_json.items())
                        print(f"      STAR: {parts}")

            if report:
                print()
                print(f"  Báo cáo: tổng {report.total_score}")
                if report.star_scores_json:
                    print(f"    STAR : {report.star_scores_json}")
                for label, data in (
                    ("Điểm mạnh", report.strengths_json),
                    ("Cần cải thiện", report.improvements_json),
                ):
                    if data:
                        for item in data[: None if args.full else 3]:
                            print(f"    {label}: {_clip(str(item), 90, args.full)}")
            print()

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
