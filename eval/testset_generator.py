import json
import os
import sys

import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FROZEN_JD_EVAL_SAMPLES = [
    {
        "id": "eval_001",
        "question": "Công ty ShopBack tuyển vị trí Software Engineer Intern - Backend yêu cầu các kỹ năng công nghệ và thuật toán nào?",
        "ground_truth": "Vị trí Software Engineer Intern - Backend tại ShopBack (JD-001) yêu cầu ứng viên có kiến thức vững về Cấu trúc dữ liệu & Thuật toán (Data Structure, Algorithms), thành thạo một trong các ngôn ngữ lập trình như Java, C/C++, C#, Python, JavaScript, Go, và năng lực ứng dụng các công cụ AI (ChatGPT, Gemini, Claude) trong công việc.",
        "reference_doc_id": "JD-001",
        "domain": "Backend",
        "question_type": "Skill Matching",
        "context": {
            "job_title": "Software Engineer Intern - Backend",
            "company_name": "ShopBack",
            "must_have_skills": ["AI", "Algorithms", "C", "ChatGPT", "Claude", "Data Structure", "Gemini", "Go", "Java", "JavaScript", "Objective-C", "Python", "Software Engineering"],
            "experience_required": "Internship / Entry Level (0-1 year)"
        }
    },
    {
        "id": "eval_002",
        "question": "Vị trí Software Developer - Intern tại Bouygues Construction IT Vietnam cung cấp các quyền lợi và mức phụ cấp như thế nào?",
        "ground_truth": "Vị trí Software Developer - Intern tại Bouygues Construction IT Vietnam (JD-002) cung cấp mức phụ cấp thực tập hàng tháng hấp dẫn (Attractive monthly internship allowance), trang bị máy tính Dell và màn hình rời, bảo hiểm sức khỏe cao cấp, 1 ngày nghỉ phép hưởng lương/tháng và cơ hội làm việc từ xa (Work from home 2 ngày/tuần).",
        "reference_doc_id": "JD-002",
        "domain": "Frontend/Fullstack",
        "question_type": "Benefit & Allowance Check",
        "context": {
            "job_title": "Software Developer - Intern",
            "company_name": "Bouygues Construction IT Vietnam",
            "salary_range": "internship allowance",
            "benefits_count": 22
        }
    },
    {
        "id": "eval_003",
        "question": "Mức lương và kinh nghiệm yêu cầu cho vị trí Thực tập sinh Backend Developer là bao nhiêu?",
        "ground_truth": "Vị trí Thực tập sinh Backend Developer (JD-004) đưa ra mức lương từ 4 đến 6 triệu VNĐ/tháng, yêu cầu kinh nghiệm ở mức Thực tập sinh / Mới tốt nghiệp (0-1 năm), có kiến thức về Java, Node.js, PostgreSQL, MySQL và RESTful API.",
        "reference_doc_id": "JD-004",
        "domain": "Backend",
        "question_type": "Salary & Experience Check",
        "context": {
            "job_title": "Thực tập sinh Backend Developer",
            "company_name": "CÔNG TY TNHH BZCOM",
            "salary_range": "4 - 6 triệu VNĐ",
            "experience_required": "Internship / Entry Level (0-1 year)"
        }
    },
    {
        "id": "eval_004",
        "question": "Mức thu nhập và khung công nghệ (tech stack) của vị trí Lập trình viên Java là gì?",
        "ground_truth": "Vị trí Lập trình viên Java (JD-005) chào mức thu nhập từ 8 đến 12 triệu VNĐ/tháng. Khung công nghệ yêu cầu gồm Java, Spring, Spring Boot, RESTful API, MySQL, PostgreSQL, DevOps và kỹ năng tự kiểm thử (Tester).",
        "reference_doc_id": "JD-005",
        "domain": "Backend",
        "question_type": "Salary & Tech Stack Check",
        "context": {
            "job_title": "Lập trình viên Java",
            "salary_range": "8TR-12TR",
            "must_have_skills": ["Algorithms", "DevOps", "Java", "MySQL", "PostgreSQL", "RESTful API", "SQL", "Spring", "Spring Boot", "Tester"]
        }
    },
    {
        "id": "eval_005",
        "question": "Vị trí Security Software Engineer Intern tại GeoComply đòi hỏi các kỹ năng lập trình backend và kỹ năng AI nào?",
        "ground_truth": "Vị trí Security Software Engineer Intern tại GeoComply (JD-066) đòi hỏi kiến thức phát triển backend cơ bản (ưu tiên PHP và/hoặc Golang), kỹ năng phân tích dữ liệu mạng (VPN, Proxy, DNS, IP infrastructure) và thành thạo sử dụng các công cụ AI để nghiên cứu phương pháp phát hiện các kỹ thuật giả mạo IP.",
        "reference_doc_id": "JD-098",
        "domain": "Backend/Security",
        "question_type": "Skill Matching",
        "context": {
            "job_title": "Security Software Engineer Intern",
            "company_name": "GeoComply",
            "must_have_skills": ["AI", "Software Engineering"],
            "nice_to_have_skills": ["Golang", "PHP"]
        }
    },
    {
        "id": "eval_006",
        "question": "Yêu cầu công việc của vị trí Thực tập sinh QA/Tester gồm những kỹ năng gì?",
        "ground_truth": "Vị trí Thực tập sinh QA/Tester yêu cầu kiến thức cơ bản về quy trình kiểm thử phần mềm (Manual testing), lập kịch bản test case, sử dụng các công cụ Postman, Selenium và tư duy phân tích phát hiện lỗi hệ thống.",
        "reference_doc_id": "JD-028",
        "domain": "QA/QC",
        "question_type": "Requirement Check",
        "context": {
            "job_title": "Thực tập sinh QA / Tester",
            "must_have_skills": ["Manual Testing", "Postman", "QA", "QC", "Selenium", "Tester"]
        }
    },
    {
        "id": "eval_007",
        "question": "Vị trí Junior CloudOps / SysOps Engineer yêu cầu kiến thức hệ thống và công cụ quản trị nào?",
        "ground_truth": "Vị trí Junior CloudOps / SysOps Engineer (JD-038) yêu cầu ứng viên có kiến thức về hệ điều hành Linux, công cụ containerization (Docker, Kubernetes), quản trị mạng, CI/CD Jenkins/GitLab và các nền tảng điện toán đám mây như AWS hoặc GCP.",
        "reference_doc_id": "JD-038",
        "domain": "DevOps",
        "question_type": "Requirement Check",
        "context": {
            "job_title": "Junior CloudOps / SysOps Engineer - Linux",
            "must_have_skills": ["AWS", "CI/CD", "Docker", "GCP", "Kubernetes", "Linux"]
        }
    },
    {
        "id": "eval_008",
        "question": "Thực tập sinh AI Engineer mảng Computer Vision / OCR cần có kiến thức nền tảng nào?",
        "ground_truth": "Thực tập sinh AI Engineer mảng Computer Vision / OCR (JD-045) yêu cầu kiến thức nền tảng về Python, các thư viện học máy (PyTorch/TensorFlow), xử lý ảnh số (OpenCV), kỹ thuật trích xuất văn bản (OCR) và năng lực huấn luyện các mô hình thị giác máy tính.",
        "reference_doc_id": "JD-045",
        "domain": "AI/Data",
        "question_type": "Requirement Check",
        "context": {
            "job_title": "AI Engineer Intern (Smart Input - OCR)",
            "must_have_skills": ["AI", "Computer Vision", "OCR", "Python"]
        }
    },
    {
        "id": "eval_009",
        "question": "Công ty Cổ phần Blueco toàn cầu tuyển vị trí Lập trình viên Frontend đưa ra dải lương và yêu cầu kinh nghiệm như thế nào?",
        "ground_truth": "Công ty Cổ phần Blueco toàn cầu tuyển vị trí Lập trình viên Frontend chào dải lương từ 12 đến 30 triệu VNĐ/tháng, yêu cầu từ 2+ năm kinh nghiệm trở lên, thông thạo HTML, CSS, JavaScript và một trong các framework Angular, ReactJS hoặc VueJS.",
        "reference_doc_id": "JD-064",
        "domain": "Frontend",
        "question_type": "Salary & Experience Check",
        "context": {
            "job_title": "TUYỂN DỤNG LẬP TRÌNH VIÊN FRONTEND",
            "company_name": "Công ty Cổ phần Blueco toàn cầu",
            "salary_range": "12 đến 30 triệu",
            "experience_required": "2+ năm"
        }
    },
    {
        "id": "eval_010",
        "question": "Vị trí Thực tập sinh Lập trình Python (Python Developer Intern) đòi hỏi kỹ năng lập trình và hình thức làm việc ra sao?",
        "ground_truth": "Vị trí Thực tập sinh Lập trình Python (Python Developer Intern) yêu cầu nắm vững ngôn ngữ Python, hiểu biết về Web Framework (Django, FastAPI hoặc Flask), thao tác cơ bản với cơ sở dữ liệu SQL/NoSQL và hình thức làm việc Toàn thời gian.",
        "reference_doc_id": "JD-024",
        "domain": "Backend/Python",
        "question_type": "Skill & Employment Check",
        "context": {
            "job_title": "Thực tập sinh Lập trình Python",
            "must_have_skills": ["Django", "FastAPI", "Flask", "Python", "SQL"],
            "employment_type": "Full-time"
        }
    }
]

def freeze_eval_dataset(
    output_json: str = "./data/eval/eval_dataset.json",
    output_csv: str = "./data/eval/eval_dataset.csv"
):
    """Đóng băng bộ 10 câu hỏi đánh giá thực tế chuyên biệt cho JD Tuyển dụng"""
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)

    # 1. Save JSON
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(FROZEN_JD_EVAL_SAMPLES, f, ensure_ascii=False, indent=2)

    # 2. Save CSV
    csv_rows = []
    for sample in FROZEN_JD_EVAL_SAMPLES:
        row = sample.copy()
        row["context_summary"] = str(row["context"])
        del row["context"]
        csv_rows.append(row)

    df = pd.DataFrame(csv_rows)
    df.to_csv(output_csv, index=False, encoding="utf-8-sig")

    print(f"🔒 ĐÃ ĐÓNG BẰNG THÀNH CÔNG BỘ CÂU HỎI ĐÁNH GIÁ JD ({len(FROZEN_JD_EVAL_SAMPLES)} câu)!")
    print(f"   - JSON: {output_json}")
    print(f"   - CSV:  {output_csv}")

if __name__ == "__main__":
    freeze_eval_dataset()
