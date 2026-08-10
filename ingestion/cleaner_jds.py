import json
import os
import re
import sys
from datetime import datetime

from bs4 import BeautifulSoup

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MASTER_TECH_KEYWORDS = [
    "Java", "Spring", "Spring Boot", "Spring MVC", "Spring Security", "Hibernate", "JPA",
    "Python", "Django", "Flask", "FastAPI", "NodeJS", "Express", "NestJS",
    "React", "ReactJS", "Next.js", "Angular", "Vue", "JavaScript", "TypeScript",
    "C", "C++", "C#", "Objective-C", ".NET", "PHP", "Laravel", "Golang", "Go",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "EC2", "S3", "Lambda",
    "CI/CD", "Git", "GitHub Actions", "Jenkins", "RESTful API", "GraphQL", "Microservices",
    "QA", "QC", "Tester", "Selenium", "Postman", "JUnit", "Mockito", "Automation", "Manual Testing",
    "Linux", "DevOps", "AI", "Computer Vision", "OCR", "Kafka", "RabbitMQ",
    "Data Structure", "Algorithms", "Software Engineering", "ChatGPT", "Gemini", "Claude"
]

DOMAIN_RULES = {
    "AI/Data": ["ai", "computer vision", "ocr", "data science", "machine learning", "llm", "nlp", "pytorch", "tensorflow", "chatgpt", "gemini", "claude"],
    "DevOps": ["devops", "cloud", "sysops", "linux", "sre", "infrastructure", "kubernetes", "terraform", "ansible"],
    "QA/QC": ["qa", "qc", "tester", "testing", "quality engineer", "automation testing", "manual testing", "selenium"],
    "Frontend": ["frontend", "front-end", "react", "vue", "angular", "next.js", "html", "css", "javascript"],
    "Backend": ["backend", "back-end", "java", "spring boot", "node", "python", "django", "fastapi", "php", "laravel", ".net", "golang", "c#"],
    "Mobile": ["mobile", "flutter", "ios", "android", "react native"]
}

def clean_text_by_source(text: str, source: str) -> str:
    """Cắt bỏ các thành phần rác đặc thù tùy theo nguồn trang web"""
    if source == "LinkedIn":
        text = re.sub(r'LinkedIn respects your privacy.*?(Our Journey|About The Role|Job Description|Key Responsibilities)', r'\1', text, flags=re.DOTALL)
        text = re.sub(r'(Continue with Google|Email or phone|Password|Sign in|Join now|Report this job|Save|Apply|Show more|Show less).*', '', text)
    elif source == "Joboko":
        # Bỏ phần header menu rác nếu có
        anchors = ["Chi tiết công việc", "Mô tả công việc", "JOB OVERVIEW"]
        for anchor in anchors:
            if anchor in text:
                text = text.split(anchor)[-1]
                break
        # Cắt bỏ phần footer rác của Joboko
        footer_anchors = ["Thông tin chung", "Cách thức ứng tuyển", "Các thông tin được cung cấp chỉ nhằm mục đích", "Quy mô công ty", "Trắc nghiệm tính cách MBTI", "Báo cáo lương, tuyển dụng"]
        for f_anchor in footer_anchors:
            if f_anchor in text:
                text = text.split(f_anchor)[0]
    elif source == "ITviec":
        anchors = ["Mô tả công việc", "About the Role", "Job Description"]
        for anchor in anchors:
            if anchor in text:
                text = text.split(anchor)[-1]
                break
    return text.strip()

def smart_extract_sections(text: str) -> dict[str, list[str]]:
    """Tự động phân tách nội dung thành responsibilities, requirements, benefits dựa trên từ khóa"""
    sections = {
        "responsibilities": [],
        "requirements": [],
        "benefits": []
    }

    current_section = "responsibilities"
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    resp_triggers = ["responsibilities", "what you'll do", "mô tả công việc", "duties", "role description", "nhiệm vụ", "your adventure ahead", "key responsibilities", "chi tiết công việc"]
    req_triggers = ["requirements", "qualifications", "who you are", "yêu cầu", "skills needed", "must-have", "kỹ năng", "essentials to succeed", "tiêu chuẩn"]
    ben_triggers = ["benefits", "what we offer", "why join", "quyền lợi", "phúc lợi", "chế độ", "what's in it for", "phúc lợi dành cho bạn", "our benefits", "special care", "trợ cấp", "perks"]

    for line in lines:
        line_lower = line.lower()
        if any(trig in line_lower for trig in resp_triggers) and len(line) < 70:
            current_section = "responsibilities"
            continue
        elif any(trig in line_lower for trig in req_triggers) and len(line) < 70:
            current_section = "requirements"
            continue
        elif any(trig in line_lower for trig in ben_triggers) and len(line) < 70:
            current_section = "benefits"
            continue

        if len(line) > 5:
            sections[current_section].append(line)

    return sections

def extract_and_classify_skills(requirements: list[str], description: str) -> dict[str, list[str]]:
    """Phân loại kỹ năng thành Must-have và Nice-to-have chính xác"""
    req_text = " ".join(requirements).lower() if requirements else ""
    full_text = description.lower()

    nice_triggers = ["nice to have", "plus", "preferred", "advantage", "điểm cộng", "ưu tiên", "khuyến khích", "bổ sung", "desirable", "big plus"]

    nice_paragraphs = []
    must_paragraphs = []

    for line in description.split("\n"):
        line_lower = line.lower().strip()
        if any(trig in line_lower for trig in nice_triggers):
            nice_paragraphs.append(line_lower)
        else:
            must_paragraphs.append(line_lower)

    nice_text = " ".join(nice_paragraphs)
    must_text = " ".join(must_paragraphs) if must_paragraphs else req_text

    found_must_have = set()
    found_nice_to_have = set()

    for kw in MASTER_TECH_KEYWORDS:
        pattern = r'\b' + re.escape(kw.lower()) + r'\b'
        if nice_text and re.search(pattern, nice_text):
            found_nice_to_have.add(kw)
        elif re.search(pattern, req_text) or re.search(pattern, must_text):
            found_must_have.add(kw)
        elif re.search(pattern, full_text):
            found_nice_to_have.add(kw)

    found_nice_to_have = found_nice_to_have - found_must_have
    all_skills = sorted(list(found_must_have | found_nice_to_have))

    return {
        "must_have_skills": sorted(list(found_must_have)),
        "nice_to_have_skills": sorted(list(found_nice_to_have)),
        "all_skills": all_skills
    }

def normalize_domain(title: str, description: str) -> str:
    """Phân loại nhóm ngành dựa trên hệ thống trọng số điểm (Title ưu tiên hơn)"""
    title = (title or "").lower()
    description = (description or "").lower()
    combined = f"{title} {description}"

    scores = {domain: 0 for domain in DOMAIN_RULES}
    for domain, keywords in DOMAIN_RULES.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', combined):
                scores[domain] += 3 if kw in title else 1

    best_domain = max(scores, key=scores.get)
    return best_domain if scores[best_domain] > 0 else "Software Engineering"

def infer_job_level(title: str, text: str) -> str:
    combined = f"{title} {text}".lower()
    if any(k in combined for k in ["intern", "thực tập", "student"]):
        return "Intern"
    if "fresher" in combined:
        return "Fresher"
    if "junior" in combined:
        return "Junior"
    if "senior" in combined:
        return "Senior"
    if "middle" in combined or "mid-level" in combined:
        return "Middle"
    return "Not Specified"

def infer_employment_type(text: str, extracted_val: str | None = None) -> str:
    if extracted_val and extracted_val.strip():
        if "toàn thời gian" in extracted_val.lower() or "full-time" in extracted_val.lower():
            return "Full-time"
        if "bán thời gian" in extracted_val.lower() or "part-time" in extracted_val.lower():
            return "Part-time"
        if "thực tập" in extracted_val.lower() or "intern" in extracted_val.lower():
            return "Internship"

    text_lower = text.lower()
    if "full-time" in text_lower or "toàn thời gian" in text_lower:
        return "Full-time"
    if "part-time" in text_lower or "bán thời gian" in text_lower:
        return "Part-time"
    if "contract" in text_lower or "hợp đồng" in text_lower:
        return "Contract"
    return "Full-time"

def infer_remote_type(text: str) -> str:
    text_lower = text.lower()
    if "remote" in text_lower or "làm tại nhà" in text_lower:
        return "Remote"
    if "hybrid" in text_lower:
        return "Hybrid"
    return "On-site"

def infer_education(text: str) -> list[str]:
    degrees = []
    text_lower = text.lower()
    if any(k in text_lower for k in ["bachelor", "đại học", "degree", "bs", "ba", "cntt"]):
        degrees.append("Bachelor")
    if any(k in text_lower for k in ["master", "thạc sĩ", "ms", "mba"]):
        degrees.append("Master")
    return degrees if degrees else ["Bachelor (Preferred)"]

def infer_languages(text: str) -> list[str]:
    langs = []
    text_lower = text.lower()
    if any(k in text_lower for k in ["english", "tiếng anh"]):
        langs.append("English")
    if any(k in text_lower for k in ["vietnamese", "tiếng việt"]):
        langs.append("Vietnamese")
    return langs if langs else ["English"]



def infer_salary_range(text: str, salary_text: str | None = None) -> str:
    if salary_text and salary_text.strip() and "thỏa thuận" not in salary_text.lower():
        return salary_text.strip()

    patterns = [
        r'(?:mức lương|thu nhập|lương)\s*:\s*([^\n,]+)',
        r'([\d,\.]+\s*(?:-|tới|đến|to)\s*[\d,\.]+\s*(?:triệu|tr|USD|\$|VND|đ\/tháng|VNĐ|Gross|M))',
        r'((?:Upto|Up to|Lương lên đến|Lương tới|Thu nhập lên đến)\s*[\d,\.]+\s*(?:triệu|tr|USD|\$|VNĐ|M|Triệu))',
        r'(Từ\s*[\d,\.]+\s*(?:Triệu|tr)?\s*-\s*(?:Dưới\s*)?[\d,\.]+\s*(?:Triệu|tr|VNĐ))',
        r'([\d,\.]+\.000\.000\s*-\s*[\d,\.]+\.000\.000\s*(?:VND|VNĐ)?)',
        r'((?:Dưới|Trên)\s*[\d,\.]+\s*(?:triệu|tr|USD|\$|VNĐ))',
        r'(trợ cấp thực tập|internship allowance|monthly allowance)'
    ]
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            val = match.group(1 if "(" in pat[:10] else 0).strip()
            if len(val) < 50:
                return val
    return "Negotiable"

def infer_experience_required(title: str, text: str, exp_text: str | None = None) -> str:
    if exp_text and exp_text.strip() and "không xác định" not in exp_text.lower():
        return exp_text.strip()

    combined = f"{title} {text}".lower()

    # 1. Direct regex for years
    exp_match = re.search(r'(\b\d+\s*(?:-\s*\d+)?\s*năm(?:\s*kinh nghiệm)?\b|\b\d+\s*\+\s*năm\b|\b\d+\s*(?:-\s*\d+)?\s*years?(?:\s*experience)?\b|\b\d+\s*\+\s*years?\b)', combined)
    if exp_match:
        return exp_match.group(0).strip()

    # 2. Check keywords
    if any(k in combined for k in ["không yêu cầu kinh nghiệm", "no experience required", "no experience needed"]):
        return "No experience required"
    if any(k in combined for k in ["intern", "thực tập", "trainee", "student"]):
        return "Internship / Entry Level (0-1 year)"
    if "fresher" in combined:
        return "Fresher (0-1 year)"
    if "junior" in combined:
        return "Junior (1-2 years)"
    if "middle" in combined or "mid-level" in combined:
        return "Middle (2-4 years)"
    if "senior" in combined:
        return "Senior (3+ years)"

    return "Not Specified"

def recover_company_from_html(job_id: str, title: str) -> str | None:
    html_path = os.path.join("./data/jds/raw", f"{job_id}.html")
    if not os.path.exists(html_path):
        return None
    try:
        with open(html_path, encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        comp_tag = soup.select_one("div.job-company-name, a.company-name, h2.company-name, h2, a.comp-name, div.company-name a, a.topcard__org-name-link, div.topcard__flavor-row a, .topcard__flavor--black-link")
        comp_text = comp_tag.get_text(strip=True) if comp_tag else None
        if comp_text and len(comp_text) < 80 and comp_text != title and "Joboko" not in comp_text:
            return comp_text

        for tag in soup.find_all(['h2', 'h3', 'a', 'div', 'span'], limit=60):
            txt = tag.get_text(strip=True)
            if ("CÔNG TY" in txt or "COMPANY" in txt) and len(txt) < 80 and txt != title and "Joboko" not in txt:
                return txt
    except Exception:
        pass
    return None

def run_cleaning_pipeline():
    input_file = "./data/raw/jds/raw_jds.json"
    output_file = "./data/clean/jds_stg.json"

    if not os.path.exists(input_file):
        print(f"❌ Không tìm thấy file thô: {input_file}. Vui lòng chạy crawler trước!")
        return

    with open(input_file, encoding="utf-8") as f:
        raw_records = json.load(f)

    cleaned_records = []
    for item in raw_records:
        source = item.get("source", "Other")
        raw_desc = item.get("raw", {}).get("description_raw", "")
        extracted_sections = item.get("extracted", {})
        title = extracted_sections.get("job_title") or "Software Engineer"

        # 1. Làm sạch text theo nguồn
        clean_desc = clean_text_by_source(raw_desc, source)

        # 2. Phân tách sections thông minh nếu crawler thiếu
        requirements = extracted_sections.get("requirements", [])
        responsibilities = extracted_sections.get("responsibilities", [])
        benefits = extracted_sections.get("benefits", [])

        if not requirements or not responsibilities or not benefits:
            smart_secs = smart_extract_sections(clean_desc)
            if not responsibilities:
                responsibilities = smart_secs["responsibilities"]
            if not requirements:
                requirements = smart_secs["requirements"]
            if not benefits:
                benefits = smart_secs["benefits"]

        # 3. Trích xuất kỹ năng đầy đủ
        skills_data = extract_and_classify_skills(requirements, clean_desc)

        # 4. Phân loại Domain & Metadata bổ sung
        domain = normalize_domain(title, clean_desc)

        # Bỏ infer_job_level bằng Python để SQL xử lý (ELT)
        job_level = "To Be Evaluated"
        emp_type = infer_employment_type(clean_desc, extracted_sections.get("employment_type"))
        remote_type = infer_remote_type(clean_desc)
        education = infer_education(clean_desc)
        languages = infer_languages(clean_desc)
        salary_range = infer_salary_range(clean_desc, extracted_sections.get("salary_text"))

        company_name = extracted_sections.get("company_name")
        if not company_name or company_name == "Unknown Company":
            recovered = recover_company_from_html(item.get("job_id", ""), title)
            if recovered:
                company_name = recovered
            else:
                comp_match = re.search(r'CÔNG TY[^\n,]+', clean_desc, re.IGNORECASE)
                company_name = comp_match.group(0).strip() if comp_match else "Unknown Company"

        locations = extracted_sections.get("locations", [])
        if len(locations) > 3:
            locations = locations[:2]
        if not locations:
            locations = ["Hồ Chí Minh"] if source == "LinkedIn" else ["Hà Nội"]

        exp_req = infer_experience_required(title, clean_desc, extracted_sections.get("experience_text"))

        must_have_obj = {
            "skills": skills_data["must_have_skills"],
            "experience": exp_req,
            "education": education,
            "job_level": job_level,
            "requirements": requirements
        }

        must_have_skills_str = ", ".join(skills_data["must_have_skills"]) if skills_data["must_have_skills"] else "N/A"
        req_snippet = " ".join(requirements[:5]) if requirements else "N/A"

        must_have_text_str = f"Vị trí: {title}. Kỹ năng bắt buộc: {must_have_skills_str}. Kinh nghiệm: {exp_req}. Yêu cầu: {req_snippet}"
        embedding_text_str = f"Job Title: {title} | Company: {company_name} | Domain: {domain} | Level: {job_level} | Must Have Skills: {must_have_skills_str} | Experience: {exp_req} | Requirements: {req_snippet}"

        # 5. Đóng gói record sạch hoàn chỉnh theo Schema mở rộng
        cleaned_item = {
            "job_id": item.get("job_id"),
            "job_hash": item.get("job_hash"),
            "source": source,
            "source_url": item.get("source_url"),
            "job_title": title,
            "company_name": company_name,
            "job_level": job_level,
            "employment_type": emp_type,
            "remote_type": remote_type,
            "domain_category": domain,
            "industry": "Information Technology",
            "location": locations,
            "salary_range": salary_range,
            "experience_required": exp_req,
            "education_required": education,
            "language_required": languages,
            "skills": skills_data["all_skills"],
            "tech_stack": skills_data["all_skills"],
            "must_have": must_have_obj,
            "must_have_skills": skills_data["must_have_skills"],
            "nice_to_have_skills": skills_data["nice_to_have_skills"],
            "must_have_text": must_have_text_str,
            "embedding_text": embedding_text_str,
            "requirements": requirements,
            "responsibilities": responsibilities,
            "benefits": benefits,
            "clean_description": clean_desc,
            "metadata": {
                **item.get("metadata", {}),
                "cleaned_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            }
        }
        cleaned_records.append(cleaned_item)

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(cleaned_records, f, ensure_ascii=False, indent=2)

    print(f"🎉 Làm sạch và chuẩn hóa nâng cao thành công {len(cleaned_records)} bản ghi!")
    print(f"📁 Dữ liệu sạch đã lưu tại: {output_file}")

if __name__ == "__main__":
    run_cleaning_pipeline()
