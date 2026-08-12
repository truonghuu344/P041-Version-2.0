"""Incrementally index data/jds into the configured Qdrant collection."""

from __future__ import annotations

import asyncio
import json

from src.services.job_rag import get_market_job_rag


async def main() -> None:
    result = await get_market_job_rag().sync_catalog()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
