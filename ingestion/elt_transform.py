import sys

import psycopg2

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "ats_user",
    "password": "ats_password",
    "dbname": "ats_db"
}

def run_elt_transform():
    print("================================================================")
    print("🔄 BẮT ĐẦU TRANSFORMATION TRONG DATABASE (ELT - TRANSFORM PHASE)")
    print("================================================================\n")

    try:
        conn = psycopg2.connect(**PG_CONFIG)
    except psycopg2.Error as e:
        print(f"❌ Không thể kết nối PostgreSQL: {e}")
        return

    cursor = conn.cursor()

    # Kích hoạt pgvector
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    conn.commit()

    # Tạo bảng Data Mart cuối cùng
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mart_jds_final (
            job_id TEXT PRIMARY KEY,
            source TEXT,
            job_title TEXT,
            company_name TEXT,
            domain_category TEXT,
            job_level TEXT,
            location TEXT,
            salary_range TEXT,
            experience_required TEXT,
            education_required TEXT,
            must_have_skills TEXT,
            nice_to_have_skills TEXT,
            embedding_text TEXT,
            embedding vector(384),
            stg_data_json TEXT,
            transformed_at TEXT
        )
    """)

    # Xóa dữ liệu cũ nếu chạy lại
    cursor.execute("DELETE FROM mart_jds_final")

    # SQL query thực hiện Transform toàn bộ dữ liệu từ bảng Staging
    transform_query = """
        INSERT INTO mart_jds_final (
            job_id, source, job_title, company_name, domain_category,
            job_level, location, salary_range, experience_required,
            education_required, must_have_skills, nice_to_have_skills,
            embedding_text, stg_data_json, transformed_at
        )
        SELECT
            job_id,
            source,
            job_title,
            company_name,
            -- Chuẩn hóa Domain bằng SQL
            CASE
                WHEN LOWER(job_title) LIKE '%ai%' OR LOWER(job_title) LIKE '%data%' OR LOWER(job_title) LIKE '%machine learning%' THEN 'AI/Data'
                WHEN LOWER(job_title) LIKE '%frontend%' OR LOWER(job_title) LIKE '%react%' OR LOWER(job_title) LIKE '%vue%' THEN 'Frontend'
                WHEN LOWER(job_title) LIKE '%backend%' OR LOWER(job_title) LIKE '%java%' OR LOWER(job_title) LIKE '%python%' THEN 'Backend'
                WHEN LOWER(job_title) LIKE '%devops%' OR LOWER(job_title) LIKE '%cloud%' THEN 'DevOps'
                WHEN LOWER(job_title) LIKE '%tester%' OR LOWER(job_title) LIKE '%qa%' OR LOWER(job_title) LIKE '%qc%' THEN 'QA/QC'
                ELSE 'Software Engineering'
            END AS domain_category,

            -- Gán nhãn Job Level dựa trên số năm kinh nghiệm bằng SQL
            CASE
                WHEN LOWER(experience_required) LIKE '%không yêu cầu%' OR LOWER(experience_required) LIKE '%intern%' OR LOWER(experience_required) LIKE '%fresher%' THEN 'Intern/Fresher'
                WHEN experience_required LIKE '%1%' OR experience_required LIKE '%2%' THEN 'Junior (1-2 years)'
                WHEN experience_required LIKE '%3%' OR experience_required LIKE '%4%' THEN 'Middle (3-4 years)'
                WHEN experience_required LIKE '%5%' OR experience_required LIKE '%6%' OR experience_required LIKE '%7%' OR experience_required LIKE '%8%' OR LOWER(job_title) LIKE '%senior%' THEN 'Senior (5+ years)'
                ELSE 'Not Specified'
            END AS job_level,

            location,
            salary_range,
            experience_required,
            education_required,
            must_have_skills,
            nice_to_have_skills,

            -- Ghép chuỗi tạo Embedding Text trực tiếp bằng SQL
            'Job Title: ' || COALESCE(job_title, '') || ' | Company: ' || COALESCE(company_name, '') || ' | Domain: ' ||
            (CASE
                WHEN LOWER(job_title) LIKE '%ai%' OR LOWER(job_title) LIKE '%data%' THEN 'AI/Data'
                ELSE 'Software Engineering'
            END) || ' | Must Have Skills: ' || COALESCE(must_have_skills, 'N/A') || ' | Experience: ' || COALESCE(experience_required, 'N/A') AS embedding_text,

            stg_data_json,
            TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS transformed_at
        FROM stg_jds;
    """

    try:
        cursor.execute(transform_query)
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM mart_jds_final")
        count = cursor.fetchone()[0]
        print(f"🎉 Transform SQL (ELT) hoàn tất! Cập nhật thành công {count} bản ghi vào bảng 'mart_jds_final'.")
    except Exception as e:
        print(f"❌ Lỗi khi thực thi SQL Transform: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    run_elt_transform()
