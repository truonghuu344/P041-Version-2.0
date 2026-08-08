import json
import os
import re
import sys
from typing import Any

import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Global Tech Skill Keywords Dictionary for Extracting Skills from Raw CV Text
TECH_SKILL_KEYWORDS = [
    "Java", "Python", "C#", "C++", "C", "Go", "Golang", "PHP", "JavaScript", "TypeScript",
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "SQL Server", "NoSQL",
    "Spring", "Spring Boot", "Node.js", "Express", "Django", "Flask", "React", "ReactJS",
    "Angular", "VueJS", "Vue", "HTML", "CSS", "Tailwind", "Bootstrap",
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Linux", "Unix", "CI/CD", "Jenkins", "Git",
    "Algorithms", "Data Structure", "RESTful API", "REST API", "Microservices",
    "QA", "QC", "Manual Testing", "Automation", "Selenium", "Postman", "Tester",
    "Security", "Penetration Testing", "VPN", "Proxy", "DNS", "Network",
    "AI", "Machine Learning", "Deep Learning", "OCR", "Computer Vision", "PyTorch", "TensorFlow"
]

def clean_cv_text(text: str) -> str:
    """Loại bỏ bớt ký tự thừa và khoảng trắng xuống dòng rác trong text CV"""
    if not isinstance(text, str):
        return ""
    text = re.sub(r'<[^>]+>', ' ', text) # Strip HTML tags if any
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_skills_from_text(text: str) -> list[str]:
    """Trích xuất từ khóa kỹ năng công nghệ thực tế từ văn bản CV bằng Regex"""
    found_skills = set()
    text_lower = text.lower()

    for skill in TECH_SKILL_KEYWORDS:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.add(skill)

    return sorted(list(found_skills))

def process_kaggle_resume_csv(csv_path: str = "Resume.csv", output_json: str = "./data/clean/cvs_clean.json") -> list[dict[str, Any]]:
    """Đọc và làm sạch bộ dữ liệu CSV CV từ Kaggle/GitHub"""
    if not os.path.exists(csv_path):
        print(f"⚠️ Không tìm thấy file {csv_path}")
        return []

    df = pd.read_csv(csv_path)
    print(f"📄 Tìm thấy {len(df)} bản ghi CV trong file CSV {csv_path}.")

    # Filter Tech & Engineering Categories
    tech_categories = ["INFORMATION-TECHNOLOGY", "ENGINEERING", "DIGITAL-MEDIA", "DESIGNER", "BUSINESS-DEVELOPMENT"]
    filtered_df = df[df["Category"].isin(tech_categories)].copy()

    clean_records = []

    for idx, row in filtered_df.iterrows():
        raw_id = str(row.get("ID", idx))
        category = str(row.get("Category", "IT")).strip()
        raw_text = str(row.get("Resume_str", row.get("Resume_text", "")))

        clean_text = clean_cv_text(raw_text)
        if len(clean_text) < 100:
            continue

        extracted_skills = extract_skills_from_text(clean_text)

        # Summary snippet
        summary_snippet = clean_text[:300] + "..."

        cv_record = {
            "cv_id": f"CV-KAG-{raw_id}",
            "source": "Kaggle/GitHub Resume.csv",
            "category": category,
            "candidate_name": f"Kaggle Candidate {raw_id}",
            "target_role": f"{category} Specialist",
            "skills": extracted_skills,
            "summary": summary_snippet,
            "full_text": clean_text[:2000],
            "embedding_text": f"Candidate Category: {category} | Skills: {', '.join(extracted_skills)} | Resume Summary: {summary_snippet}"
        }
        clean_records.append(cv_record)

    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(clean_records, f, ensure_ascii=False, indent=2)

    # Save CSV version as well
    clean_csv_path = output_json.replace(".json", ".csv")
    df_out = pd.DataFrame(clean_records)
    df_out.to_csv(clean_csv_path, index=False, encoding="utf-8-sig")

    print(f"🎉 Đã bóc tách và làm sạch thành công {len(clean_records)} bản ghi CV từ Kaggle CSV!")
    print(f"📁 Đã lưu JSON tại: {output_json}")
    print(f"📁 Đã lưu CSV tại:  {clean_csv_path}")

    return clean_records

if __name__ == "__main__":
    records = process_kaggle_resume_csv()
    if records:
        print("\n--- MẪU CV LÀM SẠCH TỪ KAGGLE CSV ---")
        print(json.dumps(records[0], ensure_ascii=False, indent=2))
