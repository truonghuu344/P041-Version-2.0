import os
import sys
from datetime import datetime

try:
    from observability.quality_checks import run_quality_audit
except ModuleNotFoundError:
    from quality_checks import run_quality_audit

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def generate_markdown_report(report_data: dict, output_md_path: str = "./data/quality/quality_report.md"):
    """Tạo báo cáo Markdown tổng hợp chất lượng dữ liệu"""
    if not report_data:
        print("❌ Không có dữ liệu báo cáo để xuất Markdown.")
        return

    ts = report_data.get("timestamp", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
    total = report_data.get("total_records", 0)
    schema_info = report_data.get("schema_validation", {})
    metrics = report_data.get("quality_metrics", {})
    sources = report_data.get("sources_distribution", {})
    domains = report_data.get("domains_distribution", {})

    md_content = f"""# 📊 Data Quality & Observability Report

> **Thời gian tạo báo cáo:** `{ts}`
> **Tổng số bản ghi kiểm định:** `{total}`

---

## 🛡️ 1. Kiểm định Schema Compliance (Pydantic Validator)

| Chỉ số (Metric) | Số lượng bản ghi | Tỷ lệ (%) | Trạng thái |
| :--- | :---: | :---: | :---: |
| **Bản ghi hợp lệ (Schema Valid)** | `{schema_info.get('valid_records', 0)}` | `{schema_info.get('valid_rate_pct', 0)}%` | {'✅ ĐẠT' if schema_info.get('valid_rate_pct', 0) == 100 else '⚠️ CẦN RẮS CẤP'} |
| **Bản ghi vi phạm Schema** | `{schema_info.get('schema_errors_count', 0)}` | `{round(100 - schema_info.get('valid_rate_pct', 0), 2)}%` | - |

---

## 📈 2. Chỉ số Chất lượng Chi tiết (Data Quality Metrics)

| Chỉ số Đánh giá | Bản ghi vi phạm / Thiếu | Tỷ lệ (%) | Mục tiêu tiêu chuẩn | Đánh giá |
| :--- | :---: | :---: | :---: | :---: |
| **Thiếu Tên công ty (`company_name`)** | `{metrics.get('missing_company_count', 0)}` | `{metrics.get('missing_company_pct', 0)}%` | `< 5%` | {'✅ XUẤT SẮC' if metrics.get('missing_company_pct', 0) < 5 else '❌ NGUY CƠ'} |
| **Trống Địa điểm (`location: []`)** | `{metrics.get('empty_location_count', 0)}` | `{metrics.get('empty_location_pct', 0)}%` | `< 5%` | {'✅ XUẤT SẮC' if metrics.get('empty_location_pct', 0) < 5 else '❌ NGUY CƠ'} |
| **Rác/Phình Địa điểm (>3 thành phố)** | `{metrics.get('bloated_location_count', 0)}` | `{metrics.get('bloated_location_pct', 0)}%` | `0%` | {'✅ HOÀN HẢO' if metrics.get('bloated_location_pct', 0) == 0 else '❌ BỊ PHÌNH'} |
| **Mức lương Thỏa thuận / Default** | `{metrics.get('negotiable_salary_count', 0)}` | `{metrics.get('negotiable_salary_pct', 0)}%` | `< 80%` | {'✅ CHẤP NHẬN' if metrics.get('negotiable_salary_pct', 0) < 80 else '⚠️ CẢNH BÁO'} |
| **Trống Kỹ năng (`skills: []`)** | `{metrics.get('empty_skills_count', 0)}` | `{metrics.get('empty_skills_pct', 0)}%` | `< 2%` | {'✅ XUẤT SẮC' if metrics.get('empty_skills_pct', 0) < 2 else '❌ NGUY CƠ'} |

---

## 🌐 3. Phân bố Dữ liệu Theo Nguồn (Source Distribution)

| Nguồn Thu thập (Source) | Số lượng JD | Tỷ lệ (%) |
| :--- | :---: | :---: |
"""
    for src, cnt in sources.items():
        pct = round((cnt / total) * 100, 1) if total > 0 else 0
        md_content += f"| **{src}** | `{cnt}` | `{pct}%` |\n"

    md_content += """
---

## 🏷️ 4. Phân bố Dữ liệu Theo Nhóm Ngành (Domain Category)

| Nhóm Ngành (Domain) | Số lượng JD | Tỷ lệ (%) |
| :--- | :---: | :---: |
"""
    for dom, cnt in domains.items():
        pct = round((cnt / total) * 100, 1) if total > 0 else 0
        md_content += f"| **{dom}** | `{cnt}` | `{pct}%` |\n"

    os.makedirs(os.path.dirname(output_md_path), exist_ok=True)
    with open(output_md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"📄 Đã tạo báo cáo Markdown tại: {output_md_path}")

def run_reporting_pipeline():
    report_json_path = "./data/quality/quality_report.json"
    report_data = run_quality_audit(output_report_path=report_json_path)
    generate_markdown_report(report_data)

if __name__ == "__main__":
    run_reporting_pipeline()
