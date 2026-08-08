import sys
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field, ValidationError

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class CleanJDRecordSchema(BaseModel):
    job_id: str
    job_hash: str
    source: str
    source_url: str
    job_title: str
    company_name: str
    job_level: str
    employment_type: str
    remote_type: str
    domain_category: str
    industry: str
    location: List[str]
    salary_range: str
    experience_required: str
    education_required: List[str]
    language_required: List[str]
    skills: List[str]
    tech_stack: List[str]
    must_have: Dict[str, Any]
    must_have_skills: List[str]
    nice_to_have_skills: List[str]
    must_have_text: str
    embedding_text: str
    requirements: List[str]
    responsibilities: List[str]
    benefits: List[str]
    clean_description: str
    metadata: Dict[str, Any]

def validate_record_schema(record: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Kiểm tra tính tuân thủ Schema Pydantic cho một bản ghi Clean JD"""
    try:
        CleanJDRecordSchema.model_validate(record)
        return True, []
    except ValidationError as ve:
        errors = [f"{err['loc']}: {err['msg']}" for err in ve.errors()]
        return False, errors

def run_quality_audit(input_path: str = "./data/clean/jds_clean.json", output_report_path: str = "./data/quality/quality_report.json") -> Dict[str, Any]:
    """Chạy đánh giá toàn diện chất lượng dữ liệu sạch thu thập được"""
    if not os.path.exists(input_path):
        print(f"❌ Không tìm thấy file dữ liệu: {input_path}")
        return {}

    with open(input_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    total_records = len(records)
    if total_records == 0:
        print("⚠️ Dữ liệu rỗng.")
        return {}

    missing_company_count = 0
    empty_location_count = 0
    bloated_location_count = 0
    negotiable_salary_count = 0
    empty_skills_count = 0
    schema_valid_count = 0
    sources_distribution: Dict[str, int] = {}
    domains_distribution: Dict[str, int] = {}

    schema_errors_log = []

    for idx, item in enumerate(records):
        source = item.get("source", "Unknown")
        sources_distribution[source] = sources_distribution.get(source, 0) + 1

        domain = item.get("domain_category", "Unknown")
        domains_distribution[domain] = domains_distribution.get(domain, 0) + 1

        # Check company name
        company = item.get("company_name", "")
        if not company or company == "Unknown Company":
            missing_company_count += 1

        # Check locations
        locs = item.get("location", [])
        if not locs:
            empty_location_count += 1
        elif len(locs) > 3:
            bloated_location_count += 1

        # Check salary
        salary = item.get("salary_range", "Negotiable")
        if salary == "Negotiable":
            negotiable_salary_count += 1

        # Check skills
        skills = item.get("skills", [])
        if not skills:
            empty_skills_count += 1

        # Check schema compliance
        is_valid, errors = validate_record_schema(item)
        if is_valid:
            schema_valid_count += 1
        else:
            schema_errors_log.append({"job_id": item.get("job_id"), "errors": errors})

    report = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_records": total_records,
        "schema_validation": {
            "valid_records": schema_valid_count,
            "valid_rate_pct": round((schema_valid_count / total_records) * 100, 2),
            "schema_errors_count": len(schema_errors_log)
        },
        "quality_metrics": {
            "missing_company_count": missing_company_count,
            "missing_company_pct": round((missing_company_count / total_records) * 100, 2),
            "empty_location_count": empty_location_count,
            "empty_location_pct": round((empty_location_count / total_records) * 100, 2),
            "bloated_location_count": bloated_location_count,
            "bloated_location_pct": round((bloated_location_count / total_records) * 100, 2),
            "negotiable_salary_count": negotiable_salary_count,
            "negotiable_salary_pct": round((negotiable_salary_count / total_records) * 100, 2),
            "empty_skills_count": empty_skills_count,
            "empty_skills_pct": round((empty_skills_count / total_records) * 100, 2)
        },
        "sources_distribution": sources_distribution,
        "domains_distribution": domains_distribution
    }

    os.makedirs(os.path.dirname(output_report_path), exist_ok=True)
    with open(output_report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"📊 Đã hoàn tất kiểm định Data Quality! Báo cáo lưu tại: {output_report_path}")
    return report

if __name__ == "__main__":
    run_quality_audit()
