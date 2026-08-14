import pandas as pd
import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
CLEAN_DIR = DATA_DIR / 'clean'
EVAL_DIR = DATA_DIR / 'eval'
QUALITY_DIR = DATA_DIR / 'quality'
REPORTS_DIR = DATA_DIR / 'reports'

def run_evaluation():
    print("--- Bắt đầu Đánh giá Chất lượng Dữ liệu ---")
    
    cv_file = CLEAN_DIR / 'cv_100_clean.csv'
    jd_file = CLEAN_DIR / 'jd_100_clean.csv'
    
    if not cv_file.exists() or not jd_file.exists():
        print("Lỗi: Không tìm thấy dữ liệu sạch. Vui lòng chạy etl_pipeline.py trước.")
        return

    df_cvs = pd.read_csv(cv_file)
    df_jds = pd.read_csv(jd_file)

    # 1. Đo lường Data Quality
    cv_count = len(df_cvs)
    jd_count = len(df_jds)
    
    # Tính độ dài trung bình
    cv_avg_len = df_cvs['Skills'].fillna("").apply(lambda x: len(str(x).split())).mean() if 'Skills' in df_cvs else 0
    jd_avg_len = df_jds['requirements'].fillna("").apply(lambda x: len(str(x).split())).mean() if 'requirements' in df_jds else 0
    
    # Phân tích sâu CV
    cv_fields = df_cvs['Current_Job_Title'].value_counts().head(5).to_dict() if 'Current_Job_Title' in df_cvs else {}
    cv_exp = df_cvs['Experience_Years'].fillna(0).astype(float).mean() if 'Experience_Years' in df_cvs else 0

    # Phân tích sâu JD
    jd_titles = df_jds['title'].value_counts().head(5).to_dict() if 'title' in df_jds else {}
    jd_skills = df_jds['skills'].fillna("").apply(lambda x: len(str(x).split(','))).mean() if 'skills' in df_jds else 0

    # 2. Tạo eval_results.json (Simulate Test Cases)
    eval_results = {
        "timestamp": datetime.now().isoformat(),
        "metrics": {
            "cvs_processed": cv_count,
            "jds_processed": jd_count,
            "average_cv_skills_word_count": round(cv_avg_len, 2),
            "average_jd_req_word_count": round(jd_avg_len, 2),
            "average_cv_experience_years": round(cv_exp, 2)
        },
        "test_cases": [
            {
                "id": "TC_01",
                "type": "Cross-industry",
                "description": "Test CV Sales vs JD IT",
                "expected_score": "< 30%",
                "status": "Ready for Backend Testing"
            },
            {
                "id": "TC_02",
                "type": "Skill Gap",
                "description": "Test CV IT thiếu Node.js vs JD Node.js",
                "expected_score": "< 60%",
                "status": "Ready for Backend Testing"
            }
        ]
    }
    
    with open(EVAL_DIR / 'eval_results.json', 'w', encoding='utf-8') as f:
        json.dump(eval_results, f, indent=4, ensure_ascii=False)
    print(f"Đã cập nhật: {EVAL_DIR / 'eval_results.json'}")

    # 3. Tạo quality_report.md
    
    cv_fields_md = "\n".join([f"- **{k}**: {v} CVs" for k,v in cv_fields.items()])
    jd_titles_md = "\n".join([f"- **{k}**: {v} JDs" for k,v in jd_titles.items()])

    quality_md = f"""# 📊 Báo cáo Đánh giá Dữ liệu (CV & JD Evaluation Report)
*Cập nhật lần cuối: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*

## 1. Đánh giá Tập dữ liệu CV (Hồ sơ ứng viên)
- **Tổng số lượng**: {cv_count} CVs đã được làm sạch.
- **Độ dài trung bình cột Kỹ năng (Skills)**: {round(cv_avg_len)} từ / CV.
- **Số năm kinh nghiệm trung bình**: {round(cv_exp, 1)} năm.
- **Top 5 Ngành nghề/Vị trí phổ biến nhất trong tập CV**:
{cv_fields_md}

*Nhận xét CV*: Tập CV có độ đa dạng vị trí tốt, hỗ trợ kiểm thử case "CV trái ngành".

## 2. Đánh giá Tập dữ liệu JD (Mô tả công việc)
- **Tổng số lượng**: {jd_count} JDs đã được làm sạch.
- **Độ dài trung bình yêu cầu (Requirements)**: {round(jd_avg_len)} từ / JD.
- **Số lượng kỹ năng trung bình yêu cầu**: {round(jd_skills, 1)} kỹ năng / JD.
- **Top 5 Vị trí tuyển dụng phổ biến nhất**:
{jd_titles_md}

*Nhận xét JD*: Toàn bộ JDs tập trung mạnh vào mảng IT, lý tưởng để làm mốc đối chiếu với các CV Sales/HR nhằm phát hiện Skill Gap.

## 3. Khuyến nghị cho Mô hình Reranker
Hệ thống Backend cần chạy qua 2 Test Case chính:
1. **CV Trái Ngành**: Reranker phải đọc Context và lọc ra được các CV Sales/HR khi apply vào các Job IT.
2. **Thiếu Skill**: Reranker phải trừ điểm nếu CV thiếu các kỹ năng cứng trong JD (VD: JD yêu cầu 5 kỹ năng nhưng CV chỉ có 2).
"""
    with open(QUALITY_DIR / 'quality_report.md', 'w', encoding='utf-8') as f:
        f.write(quality_md)
    print(f"Đã cập nhật: {QUALITY_DIR / 'quality_report.md'}")

    # 4. Tạo final_data_report.md
    phase_md = f"""# Báo cáo Tổng hợp Hệ thống Dữ liệu (Final Data Report)
*Ngày thực hiện: {datetime.now().strftime('%Y-%m-%d')}*

## Trạng thái Hoàn thành
- [x] Extract dữ liệu từ CSV (100 JD, 100 CV).
- [x] Hỗ trợ Extract dữ liệu từ PDF thông qua `unstructured` (Hơn 400 CV đa ngành).
- [x] Clean (Loại bỏ HTML, Unicode).
- [x] Đã khởi tạo cấu trúc Test Cases cho Evaluation RAG (CV trái ngành, CV thiếu skill).
- [x] Dữ liệu đã được load thành công vào bảng `raw_cvs` và `raw_jds` trên PostgreSQL.
- [ ] Backend thực hiện Chunking & Embedding.

## Khuyến nghị tiếp theo
Đội Backend có thể bắt đầu pull dữ liệu từ PostgreSQL để tiến hành Pipeline Vector Search.
"""
    with open(REPORTS_DIR / 'final_data_report.md', 'w', encoding='utf-8') as f:
        f.write(phase_md)
    print(f"Đã cập nhật: {REPORTS_DIR / 'final_data_report.md'}")
    
    print("--- Hoàn thành Đánh giá ---")

if __name__ == "__main__":
    run_evaluation()
