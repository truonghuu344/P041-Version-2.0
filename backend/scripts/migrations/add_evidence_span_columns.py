"""
Migration script to add span_start and span_end columns to evidences table.
Thành viên 4 — feat/match-evaluation-modal

Chạy: python backend/scripts/migrations/add_evidence_span_columns.py
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.config import get_settings

async def run_migration():
    settings = get_settings()
    db_url = settings.database_url
    print(f"Running migration on database: {db_url}")
    
    engine = create_async_engine(db_url)
    
    async with engine.begin() as conn:
        # Kiểm tra xem các cột đã tồn tại hay chưa (để an toàn chạy lại nhiều lần)
        # PostgreSQL check columns
        check_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'evidences' AND column_name IN ('span_start', 'span_end');
        """
        result = await conn.execute(text(check_query))
        existing_cols = [row[0] for row in result.fetchall()]
        
        if "span_start" not in existing_cols:
            print("Adding span_start column to evidences table...")
            await conn.execute(text("ALTER TABLE evidences ADD COLUMN span_start INTEGER;"))
        else:
            print("span_start column already exists.")
            
        if "span_end" not in existing_cols:
            print("Adding span_end column to evidences table...")
            await conn.execute(text("ALTER TABLE evidences ADD COLUMN span_end INTEGER;"))
        else:
            print("span_end column already exists.")
            
    print("Migration completed successfully!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
