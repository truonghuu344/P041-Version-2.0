import sys
import os
import json
import psycopg2
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

STG_JSON_PATH = "./data/clean/jds_stg.json"

PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "ats_user",
    "password": "ats_password",
    "dbname": "ats_db"
}

def get_db_connection():
    return psycopg2.connect(**PG_CONFIG)

def init_stg_table(conn):
    cursor = conn.cursor()
    # Bảng Staging chứa dữ liệu đã tiền xử lý bằng Python (ETL output)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stg_jds (
            job_id TEXT PRIMARY KEY,
            source TEXT,
            job_title TEXT,
            company_name TEXT,
            domain_category TEXT,
            location TEXT,
            salary_range TEXT,
            experience_required TEXT,
            education_required TEXT,
            must_have_skills TEXT,
            nice_to_have_skills TEXT,
            stg_data_json TEXT,
            loaded_at TEXT
        )
    """)
    conn.commit()

def load_stg_jds():
    print("================================================================")
    print("📥 BẮT ĐẦU LOAD DỮ LIỆU STAGING VÀO DATABASE (ETLT - LOAD PHASE)")
    print("================================================================\n")

    if not os.path.exists(STG_JSON_PATH):
        print(f"❌ Không tìm thấy file JSON Staging: {STG_JSON_PATH}. Vui lòng chạy Python ETL trước!")
        return

    with open(STG_JSON_PATH, "r", encoding="utf-8") as f:
        stg_records = json.load(f)

    conn = get_db_connection()
    init_stg_table(conn)
    cursor = conn.cursor()

    count = 0
    for item in stg_records:
        job_id = item.get("job_id")
        if not job_id:
            continue
            
        source = item.get("source", "Other")
        job_title = item.get("job_title", "")
        company_name = item.get("company_name", "")
        domain_category = item.get("domain_category", "")
        location = json.dumps(item.get("location", []), ensure_ascii=False)
        salary_range = item.get("salary_range", "")
        experience_required = item.get("experience_required", "")
        education_required = json.dumps(item.get("education_required", []), ensure_ascii=False)
        must_have_skills = json.dumps(item.get("must_have_skills", []), ensure_ascii=False)
        nice_to_have_skills = json.dumps(item.get("nice_to_have_skills", []), ensure_ascii=False)
        
        stg_data_json = json.dumps(item, ensure_ascii=False)
        loaded_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Upsert in PostgreSQL
        cursor.execute("""
            INSERT INTO stg_jds (
                job_id, source, job_title, company_name, domain_category, 
                location, salary_range, experience_required, education_required, 
                must_have_skills, nice_to_have_skills, stg_data_json, loaded_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(job_id) DO UPDATE SET
                source=EXCLUDED.source,
                job_title=EXCLUDED.job_title,
                company_name=EXCLUDED.company_name,
                domain_category=EXCLUDED.domain_category,
                location=EXCLUDED.location,
                salary_range=EXCLUDED.salary_range,
                experience_required=EXCLUDED.experience_required,
                education_required=EXCLUDED.education_required,
                must_have_skills=EXCLUDED.must_have_skills,
                nice_to_have_skills=EXCLUDED.nice_to_have_skills,
                stg_data_json=EXCLUDED.stg_data_json,
                loaded_at=EXCLUDED.loaded_at
        """, (job_id, source, job_title, company_name, domain_category, 
              location, salary_range, experience_required, education_required, 
              must_have_skills, nice_to_have_skills, stg_data_json, loaded_at))
        
        count += 1

    conn.commit()
    conn.close()

    print(f"🎉 Load thành công {count} bản ghi vào bảng 'stg_jds' trong PostgreSQL!")

if __name__ == "__main__":
    load_stg_jds()
