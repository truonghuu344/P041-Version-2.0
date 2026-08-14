"""Incrementally index data/jds into the configured PostgreSQL/pgvector index."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
from src.services.job_rag import get_market_job_rag


async def main() -> None:
    result = await get_market_job_rag().sync_catalog()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
