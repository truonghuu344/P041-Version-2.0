import sys
import os
import json
from typing import List, Dict, Any, Union

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def calculate_completeness(records: List[Dict[str, Any]], required_fields: List[str]) -> float:
    """Tính tỷ lệ điền đầy đủ (Completeness Rate) của dữ liệu sạch"""
    if not records:
        return 0.0

    total_checks = len(records) * len(required_fields)
    valid_checks = 0

    for rec in records:
        for field in required_fields:
            val = rec.get(field)
            if val is not None and val != "" and val != []:
                valid_checks += 1

    return round((valid_checks / total_checks) * 100.0, 2)

def calculate_uniqueness(records: List[Dict[str, Any]], key_field: str = "job_id") -> float:
    """Tính tỷ lệ duy nhất không trùng lặp (Uniqueness Rate)"""
    if not records:
        return 0.0

    seen_keys = set()
    unique_count = 0

    for rec in records:
        key = rec.get(key_field) or rec.get("cv_id") or rec.get("job_hash")
        if key and key not in seen_keys:
            seen_keys.add(key)
            unique_count += 1

    return round((unique_count / len(records)) * 100.0, 2)

def run_data_quality_checks(
    jds_clean_path: str = "./data/clean/jds_clean.json",
    cvs_clean_path: str = "./data/clean/cvs_clean.json"
) -> Dict[str, Any]:
    """Chạy toàn bộ các hàm kiểm tra Data Quality cho JDs và CVs"""
    required_jd_fields = [
        "job_id", "job_title", "company_name", "domain_category",
        "location", "salary_range", "experience_required", "must_have", "embedding_text"
    ]

    jd_records = []
    if os.path.exists(jds_clean_path):
        with open(jds_clean_path, "r", encoding="utf-8") as f:
            jd_records = json.load(f)

    cv_records = []
    if os.path.exists(cvs_clean_path):
        with open(cvs_clean_path, "r", encoding="utf-8") as f:
            cv_records = json.load(f)

    jd_completeness = calculate_completeness(jd_records, required_jd_fields)
    jd_uniqueness = calculate_uniqueness(jd_records, key_field="job_hash")

    cv_completeness = calculate_completeness(cv_records, ["cv_id", "skills", "summary"]) if cv_records else 100.0
    cv_uniqueness = calculate_uniqueness(cv_records, key_field="cv_id") if cv_records else 100.0

    quality_summary = {
        "jd_data": {
            "total_records": len(jd_records),
            "completeness_rate": f"{jd_completeness}%",
            "uniqueness_rate": f"{jd_uniqueness}%"
        },
        "cv_data": {
            "total_records": len(cv_records),
            "completeness_rate": f"{cv_completeness}%",
            "uniqueness_rate": f"{cv_uniqueness}%"
        },
        "overall_status": "PASSED" if jd_completeness >= 90.0 and jd_uniqueness >= 95.0 else "WARNING"
    }

    return quality_summary

if __name__ == "__main__":
    summary = run_data_quality_checks()
    print("✅ JD & CV DATA QUALITY SUMMARY:")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
