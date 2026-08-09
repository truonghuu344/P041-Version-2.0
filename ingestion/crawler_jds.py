import asyncio
import hashlib
import json
import os
import random
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from pydantic import BaseModel, Field, ValidationError
from unidecode import unidecode

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
]

TECH_KEYWORDS = [
    "Java", "Spring", "Spring Boot", "Spring MVC", "Spring Security", "Hibernate", "JPA",
    "Python", "Django", "Flask", "FastAPI", "NodeJS", "Express", "NestJS",
    "React", "ReactJS", "Next.js", "Angular", "Vue", "JavaScript", "TypeScript",
    "C#", ".NET", "PHP", "Laravel", "Golang", "Go",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "EC2", "S3", "Lambda",
    "CI/CD", "Git", "GitHub Actions", "Jenkins", "RESTful API", "GraphQL", "Microservices",
    "QA", "QC", "Tester", "Selenium", "Postman", "JUnit", "Mockito", "Automation", "Manual Testing",
    "Linux", "DevOps", "AI", "Computer Vision", "OCR", "Kafka", "RabbitMQ"
]

LOCATION_ALIASES = {
    "tphcm": "Hồ Chí Minh", "tp.hcm": "Hồ Chí Minh", "hcm": "Hồ Chí Minh", "sai gon": "Hồ Chí Minh",
    "ho chi minh": "Hồ Chí Minh", "ho chi minh city": "Hồ Chí Minh", "hcmc": "Hồ Chí Minh",
    "ha noi": "Hà Nội", "hanoi": "Hà Nội", "ha noi city": "Hà Nội",
    "da nang": "Đà Nẵng", "danang": "Đà Nẵng", "da nang city": "Đà Nẵng",
    "can tho": "Cần Thơ", "cantho": "Cần Thơ",
    "hai phong": "Hải Phòng", "haiphong": "Hải Phòng",
    "binh duong": "Bình Dương", "bình dương": "Bình Dương",
    "dong nai": "Đồng Nai", "đồng nai": "Đồng Nai",
    "ba ria - vung tau": "Bà Rịa - Vũng Tàu", "phu my": "Bà Rịa - Vũng Tàu",
    "remote": "Remote", "work from home": "Remote"
}

async def block_resources(route):
    if route.request.resource_type in ["image", "stylesheet", "font", "media"]:
        await route.abort()
    else:
        await route.continue_()

def infer_source(url):
    if "linkedin.com" in url:
        return "LinkedIn"
    if "itviec.com" in url:
        return "ITviec"
    if "joboko.com" in url:
        return "Joboko"
    return "Other"

class ExtractedTier(BaseModel):
    job_title: str | None = None
    company_name: str | None = None
    locations: list[str] = Field(default_factory=list)
    salary_text: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    experience_text: str | None = None
    employment_type: str | None = None
    requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)

class FinalJDRecord(BaseModel):
    job_id: str
    job_hash: str
    source: str
    source_url: str
    raw: dict[str, str]
    extracted: ExtractedTier
    metadata: dict[str, Any]

def extract_locations_normalized(text: str) -> list[str]:
    if not text:
        return []
    normalized_text = unidecode(text.lower())
    found = set()
    for alias, canonical_name in LOCATION_ALIASES.items():
        if re.search(r'\b' + re.escape(alias) + r'\b', normalized_text):
            found.add(canonical_name)
    return sorted(list(found))

async def fetch_with_retry(page, url, max_retries=3, initial_delay=2.0):
    """Cơ chế thử lại (Retry) với thuật toán Exponential Backoff xử lý lỗi HTTP 429, 503 hoặc timeout"""
    delay = initial_delay
    for attempt in range(1, max_retries + 1):
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            status = response.status if response else 200
            if status in [429, 503, 500, 502, 504]:
                print(f"⚠️ [Lần thử {attempt}/{max_retries}] Gặp mã lỗi HTTP {status} tại {url}. Đang chờ {delay:.1f}s và thử lại...")
                await asyncio.sleep(delay)
                delay *= 2.0
                continue
            return response
        except Exception as e:
            if attempt == max_retries:
                raise e
            print(f"⚠️ [Lần thử {attempt}/{max_retries}] Lỗi kết nối tại {url}: {e}. Đang chờ {delay:.1f}s và thử lại...")
            await asyncio.sleep(delay)
            delay *= 2.0

async def scrape_and_parse_jd(page, url, idx):
    await fetch_with_retry(page, url, max_retries=3, initial_delay=2.0)
    await asyncio.sleep(1)

    content = await page.content()
    soup = BeautifulSoup(content, "html.parser")
    source = infer_source(url)

    title_text, company_name, container = None, None, None
    locations, salary_text, experience_text, employment_type = [], None, None, None

    if source == "LinkedIn":
        title_tag = soup.select_one("h1, h1.topcard__title, .top-card-layout__title")
        if title_tag:
            title_text = title_tag.get_text(strip=True)

        comp_tag = soup.select_one("a.topcard__org-name-link, div.topcard__flavor-row a, .topcard__flavor--black-link, .top-card-layout__first-sub-row a, span.topcard__flavor")
        if comp_tag:
            company_name = comp_tag.get_text(strip=True)

        loc_tag = soup.select_one("span.topcard__flavor--bullet, .topcard__flavor:nth-of-type(2), .top-card-layout__first-sub-row span:nth-of-type(2), span.job-search-card__location")
        if loc_tag:
            loc_str = loc_tag.get_text(strip=True)
            locations = extract_locations_normalized(loc_str)
            if not locations and loc_str:
                locations = [loc_str]

        container = soup.select_one("div.show-more-less-html__markup, div.description__text")

    elif source == "Joboko":
        title_tag = soup.select_one("h1.job-title, h1, div.job-title h1")
        if title_tag:
            title_text = title_tag.get_text(strip=True)

        comp_tag = soup.select_one("div.job-company-name, a.company-name, h2.company-name, h2, a.comp-name, div.company-name a")
        if comp_tag and comp_tag.get_text(strip=True):
            c_text = comp_tag.get_text(strip=True)
            if len(c_text) < 100 and c_text != title_text and "Joboko" not in c_text:
                company_name = c_text

        if not company_name:
            for tag in soup.find_all(['h2', 'h3', 'a', 'div', 'span'], limit=60):
                txt = tag.get_text(strip=True)
                if ("CÔNG TY" in txt or "COMPANY" in txt) and len(txt) < 80 and txt != title_text and "Joboko" not in txt:
                    company_name = txt
                    break

        # Location from header tag or specific line
        loc_match = None
        for tag in soup.find_all(['div', 'p', 'span', 'li']):
            t = tag.get_text(strip=True)
            if ("Địa điểm làm việc:" in t or "Nơi làm việc:" in t or "Địa chỉ công ty:" in t) and len(t) < 200:
                loc_match = t
                break

        if loc_match:
            locations = extract_locations_normalized(loc_match)

        if not locations:
            header_box = soup.select_one("div.job-header, div.job-detail-header, div.box-job-header, div.job-header-info")
            if header_box:
                locations = extract_locations_normalized(header_box.get_text(separator="\n", strip=True))

        info_text = soup.get_text(separator="\n", strip=True)[:3000]
        sal_match = re.search(r'(?:Thu nhập|Mức lương|Lương)\s*:\s*([^\n]+)', info_text, re.IGNORECASE)
        if sal_match:
            salary_text = sal_match.group(1).strip()

        exp_match = re.search(r'(?:Kinh nghiệm|Yêu cầu kinh nghiệm)\s*:\s*([^\n]+)', info_text, re.IGNORECASE)
        if exp_match:
            experience_text = exp_match.group(1).strip()

        emp_match = re.search(r'(?:Loại hình|Hình thức làm việc)\s*:\s*([^\n]+)', info_text, re.IGNORECASE)
        if emp_match:
            employment_type = emp_match.group(1).strip()

        container = soup.select_one("div.job-detail-content, div.box-job-detail, div.job-description, div.content-job-detail")

    full_text = container.get_text(separator="\n", strip=True) if container else soup.get_text(separator="\n", strip=True)

    if not locations:
        locations = extract_locations_normalized(full_text[:500])
    if not locations:
        locations = ["Hồ Chí Minh"] if source == "LinkedIn" else ["Hà Nội"]

    company_name = company_name or "Unknown Company"

    extracted_data = ExtractedTier(
        job_title=title_text,
        company_name=company_name,
        locations=locations,
        salary_text=salary_text,
        experience_text=experience_text,
        employment_type=employment_type,
        requirements=[p.get_text(strip=True) for p in container.find_all(['p', 'li']) if len(p.get_text(strip=True)) > 10] if container else []
    )

    job_id = f"JD-{idx+1:03d}"
    os.makedirs("./data/jds/raw", exist_ok=True)

    # 📌 RAW ARTIFACT DẠNG 1: Lưu file HTML response thô nguyên bản phục vụ audit nguồn
    html_filename = f"{job_id}.html"
    with open(os.path.join("./data/jds/raw", html_filename), "w", encoding="utf-8") as f:
        f.write(content)

    record = {
        "job_id": job_id,
        "job_hash": hashlib.md5(f"{title_text}|{company_name}".encode()).hexdigest(),
        "source": source,
        "source_url": url,
        "raw": {"description_raw": full_text, "html_file": f"raw/{html_filename}"},
        "extracted": extracted_data.model_dump(),
        "metadata": {"crawl_date": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}
    }
    return FinalJDRecord.model_validate(record).model_dump()

async def run_crawler(urls_to_crawl):
    os.makedirs("./data/jds", exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        results = []
        seen_hashes = set()

        for index, url in enumerate(urls_to_crawl):
            context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = await context.new_page()
            await page.route("**/*", block_resources)

            print(f"⏳ [{index + 1}/{len(urls_to_crawl)}] Đang crawl URL: {url}")
            try:
                parsed_data = await scrape_and_parse_jd(page, url, index)
                if parsed_data:
                    j_hash = parsed_data["job_hash"]
                    if j_hash in seen_hashes:
                        print(f"🔄 Bỏ qua bản ghi trùng lặp (Hash: {j_hash})")
                    else:
                        seen_hashes.add(j_hash)
                        results.append(parsed_data)
            except ValidationError as ve:
                print(f"❌ Lỗi Schema Validation tại URL {url}: {ve}")
            except Exception as e:
                print(f"❌ Lỗi ngoại lệ tại URL {url}: {e}")

            await page.close()
            await context.close()
            await asyncio.sleep(random.uniform(2.0, 5.0))

        await browser.close()

        output_path = "./data/raw/jds/raw_jds.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"🎉 Hoàn tất crawl! Đã lưu {len(results)} bản ghi thô vào: {output_path}")

if __name__ == "__main__":
    # Danh sách các link JD mẫu cần crawl thử nghiệm
    target_urls = [
         # 1. Software Engineer Intern - Backend
        "https://www.linkedin.com/jobs/view/4281770937/",
        # 2. Software Developer - Intern
        "https://www.linkedin.com/jobs/view/4439326221/",
        # 3. Thực tập sinh Java
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-java-xvi5994345",
        # 4. Thực tập sinh Backend Developer
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-backend-developer-xvi6579604",
        # 5. Lập trình viên Java
        "https://vn.joboko.com/viec-lam-lap-trinh-vien-java-xvi6610939",
        # 6. Java Backend Developer (Middle-Senior)
        "https://vn.joboko.com/viec-lam-java-backend-developer-middle-senior-xvi6597769",
        # 7. Senior Java Developer
        "https://vn.joboko.com/viec-lam-senior-java-developer-xvi6612433",
        # 8. JAVA DEVELOPER
        "https://vn.joboko.com/viec-lam-java-developer-xvi6608736",
        # 9. Senior Java Backend Developer (Spring Boot)
        "https://vn.joboko.com/viec-lam-senior-java-backend-developer-spring-boot-xvi6603577",
        # 10. TTS Frontend Engineer
        "https://vn.joboko.com/viec-lam-tts-frontend-engineer-xvi6610243",
        # 11. Thực tập sinh Frontend Developer
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-frontend-developer-xvi6584060",
        # 12. Thực tập sinh IT
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-it-xvi6571801",
        # 13. Fresher Java
        "https://vn.joboko.com/viec-lam-fresher-java-spring-boot-angular-xvi4941113",
        # 14. Lập trình viên Net
        "https://vn.joboko.com/viec-lam-lap-trinh-vien-net-di-lam-sau-tet-xvi6302669",
        # 15. Lập Trình Viên Frontend/ Frontend Developer - Upto 15 Triệu
        "https://vn.joboko.com/viec-lam-lap-trinh-vien-frontend-frontend-developer-reactjs-luong-upto-15-trieu-xvi6481817",
        # 16. PHP Developer Fresher
        "https://vn.joboko.com/viec-lam-php-developer-fresher-xvi6604948",
        # 17. Fullstack Web Developer (Reactjs & Nodejs)
        "https://vn.joboko.com/viec-lam-fullstack-web-developer-reactjs-nodejs-xvi6598979",
        # 18. Lập trình viên giao diện web Front-End Developer
        "https://vn.joboko.com/viec-lam-lap-trinh-vien-giao-dien-web-front-end-developer-xvi6573502",
        # 19. Frontend Reactjs Developer
        "https://vn.joboko.com/viec-lam-frontend-reactjs-developer-xvi6603684",
        # 20. Junior Mobile Developer Flutter
        "https://vn.joboko.com/viec-lam-junior-mobile-developer-flutter-xvi6580519",
        # 21. Lập trình viên Frontend
        "https://vn.joboko.com/viec-lam-lap-trinh-vien-frontend-xvi6595415",
        # 22. [LTH] FULL STACK DEVELOPER INTERN (.NET & Angular)
        "https://vn.joboko.com/viec-lam-lth-full-stack-developer-intern-net-angular-xvi6611745",
        # 23. Intern Full Stack Developer
        "https://vn.joboko.com/viec-lam-intern-full-stack-developer-xvi6603411",
        # 24. Javascript Intern
        "https://vn.joboko.com/viec-lam-javascript-intern-xvi6603544",
        # 25. Junior Middle Fullstack Developer
        "https://vn.joboko.com/viec-lam-junior-middle-fullstack-developer-xvi6561760",
        # 26. IT Developer / Junior Full-Stack Developer (Thu Nhập Lên Đến 15 Triệu)
        "https://vn.joboko.com/viec-lam-it-developer-junior-full-stack-developer-thu-nhap-len-den-15-trieu-xvi6611617",
        # 27. QA Intern
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-tester-quality-assurance-co-luong-ho-tro-xvi6590087",
        # 28. Thực tập sinh QA / Tester
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-qa-tester-xvi6582986",
        # 29. QA/Tester Intern
        "https://vn.joboko.com/viec-lam-qa-tester-intern-xvi6582926",
        # 30. [LTH] QC/TESTER INTERN
        "https://vn.joboko.com/viec-lam-lth-qc-tester-intern-xvi6611737",
        # 31. Intern Quality Engineer (QC)
        "https://vn.joboko.com/viec-lam-intern-quality-engineer-qc-xvi6603973",
        # 32. Quality Control Intern (QA/QC Tester)
        "https://vn.joboko.com/viec-lam-quality-control-intern-qa-qc-tester-xvi6604108",
        # 33. Thực Tập Sinh Tester
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-tester-qa-qc-xvi6435645",
        # 34. Kỹ Sư QA - Quản Lý Chất Lượng (Làm việc tại Phú Mỹ)
        "https://vn.joboko.com/viec-lam-ky-su-qa-quan-ly-chat-luong-lam-viec-tai-phu-my-xvi6614171",
        # 35. Talent Intern Tester (Eng - Fluent)
        "https://vn.joboko.com/viec-lam-talent-intern-tester-eng-fluent-xvi6614668",
        # 36. Software Developer Intern - 5G
        "https://vn.joboko.com/viec-lam-software-developer-intern-5g-xvi6603689",
        # 37. Tester Intern
        "https://vn.joboko.com/viec-lam-tester-intern-xvi6599220",
        # 38. Junior CloudOps / SysOps Engineer - Linux
        "https://vn.joboko.com/viec-lam-junior-cloudops-sysops-engineer-linux-xvi6582106",
        # 39. [HCM] Công Ty Công nghệ Golden Owl Solutions Tuyển Dụng Thực Tập Sinh JS Full-stack/DevOps/Ruby on Rails/PHP/UI/UX Designer/Điều phối Full-time 2026
        "https://vn.joboko.com/viec-lam-hcm-cong-ty-cong-nghe-golden-owl-solutions-tuyen-dung-thuc-tap-sinh-js-full-stack-devops-ruby-on-rails-php-ui-ux-designer-dieu-phoi-full-time-2026-xvi6577753",
        # 40. DevOps Intern
        "https://vn.joboko.com/viec-lam-devops-intern-xvi6611561",
        # 41. Internship Programs DevOps
        "https://vn.joboko.com/viec-lam-internship-programs-devops-xvi5109148",
        # 42. Google Cloud Infrastructure SE (Junior - Middle)
        "https://vn.joboko.com/viec-lam-google-cloud-infrastructure-se-junior-middle-xvi6611004",
        # 43. DevOps Engineer
        "https://vn.joboko.com/viec-lam-devops-engineer-xvi6617579",
        # 44. Thực tập sinh Kỹ sư AI - Thị giác Máy tính (AI / Computer Vision)
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-ky-su-ai-thi-giac-may-tinh-ai-computer-vision-xvi6612188",
        # 45. AI Engineer Intern (Smart Input - OCR)
        "https://vn.joboko.com/viec-lam-vela-ai-engineer-intern-smart-input-ocr-xvi6611765",
        # 46. AI Application Intern
        "https://vn.joboko.com/viec-lam-ai-application-intern-xvi6581151",
        # 47. AI Engineer Intern
        "https://vn.joboko.com/viec-lam-ai-engineer-intern-xvi6617898",
        # 48. AI Engineer Intern
        "https://vn.joboko.com/viec-lam-ai-engineer-intern-xvi6585531",
        # 49. AI Engineer Intern
        "https://vn.joboko.com/viec-lam-ai-engineer-intern-xvi6600741",
        # 50. Thực tập sinh AI Vision
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-ai-vision-xvi6615312",
        # 51. Thực tập sinh AI
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-ai-xvi6168581",
        # 52. Thực Tập Sinh AI Content Creator Intern
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-ai-content-creator-intern-xvi6557105",
        # 53. Senior Cloud Engineer (AWS)
        "https://itviec.com/viec-lam-it/senior-cloud-engineer-aws-techcom-securities-0321?lab_feature=preview_jd_page",
        # 54. Junior Cloud Engineer (AWS & Azure)
        "https://itviec.com/viec-lam-it/urgent-02-junior-cloud-engineer-aws-azure-extreme-viet-nam-2024?lab_feature=preview_jd_page",
        # 55. Senior Technical Engineer - DevOps & SRE
        "https://itviec.com/viec-lam-it/senior-technical-engineer-devops-sre-hsc-2445?lab_feature=preview_jd_page",
        # 56. Senior DevOps & Platform Engineer (Linux, Git, Docker)
        "https://itviec.com/viec-lam-it/senior-devops-platform-engineer-linux-git-docker-cong-ty-co-phan-chung-khoan-vps-4511?lab_feature=preview_jd_page",
        # 57. Junior Fullstack Developer (PHP, Python, SQL, OOP)
        "https://itviec.com/viec-lam-it/junior-fullstack-developer-php-python-sql-oop-cong-ty-tnhh-vanfu-software-viet-nam-4331?lab_feature=preview_jd_page",
        # 58. Middle Senior Fullstack Developer (Nodejs, SQL, AI)
        "https://itviec.com/viec-lam-it/middle-senior-fullstack-developer-nodejs-sql-ai-dekon-4957?lab_feature=preview_jd_page",
        # 59. Remote AI Full Stack Engineer (English C1, 4-5.500 Gross)
        "https://itviec.com/viec-lam-it/remote-ai-full-stack-eng-english-c1-4-500-gross-xenia-tech-1057?lab_feature=preview_jd_page",
        # 60. New Product Development Engineer(Fullstack & English)
        "https://itviec.com/viec-lam-it/new-product-development-engineer-fullstack-english-porters-asia-vietnam-co-ltd-4655?lab_feature=preview_jd_page",
        # 61. Thực tập sinh Lập trình viên Backend
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-lap-trinh-vien-backend-xvi6528638",
        # 62. Thực tập sinh Kỹ sư .NET
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-net-developer-xvi5208863",
        # 63. Thực tập sinh Kỹ sư Python
        "https://vn.joboko.com/viec-lam-thuc-tap-sinh-lap-trinh-python-python-development-internship-xvi6591535",
        # 64. Thực tập sinh Lập trình viên Frontend
        "https://vn.joboko.com/viec-lam-tuyen-dung-lap-trinh-vien-frontend-xvi6609904",
        # 65. Product Engineer Intern (allowance 5 mil)
        "https://www.linkedin.com/jobs/view/4448027348/",
        # 66. AI Engineer Intern
        "https://www.linkedin.com/jobs/view/4447902237/",
        # 67. Product Engineering Intern
        "https://www.linkedin.com/jobs/view/4447682607/",
        # 68. Product Intern / Fresher
        "https://www.linkedin.com/jobs/view/4425184097/",
        # 69. Solutions Engineer Intern
        "https://www.linkedin.com/jobs/view/4449618423/",
        # 70. Intern (QA)
        "https://www.linkedin.com/jobs/view/4449102090/",
        # 71. Full Stack Engineer (Golang/ReactJS)
        "https://www.linkedin.com/jobs/view/4447393090/",
        # 72. FullStack Engineer
        "https://www.linkedin.com/jobs/view/4449352730/",
        # 73. Full-stack Engineer (NextJS, Java, AI-native)
        "https://www.linkedin.com/jobs/view/4442291387/",
        # 74. Junior Full Stack Engineer (Python React/Angular)
        "https://www.linkedin.com/jobs/view/4438497569/",
        # 75. Fullstack Reactjs Developer
        "https://www.linkedin.com/jobs/view/4446965844/",
        # 76. Full-Stack / Platform Engineer – Engineering Tools
        "https://www.linkedin.com/jobs/view/4428640289/",
        # 77. Full Stack Engineer
        "https://www.linkedin.com/jobs/view/4447783885/",
        # 78. HCM – Junior Fullstack Developer (ReactJS + NodeJS)
        "https://www.linkedin.com/jobs/view/4406597658/",
        # 79. Fullstack Developer
        "https://www.linkedin.com/jobs/view/4449083775/",
        # 80. Fullstack Engineer
        "https://www.linkedin.com/jobs/view/4389546376/",
        # 81. Fullstack Python/Nextjs Developer (Middle)
        "https://www.linkedin.com/jobs/view/4411357363/",
        # 82. Fullstack Engineer
        "https://www.linkedin.com/jobs/view/4445343250/",
        # 83. Full-Stack AI Engineer
        "https://www.linkedin.com/jobs/view/4438404461/",
        # 84. Software Engineer Intern (Salesforce/Guidewire/RPA)
        "https://www.linkedin.com/jobs/view/4440665420/",
        # 85. Software Engineering Intern (6-month contract)
        "https://www.linkedin.com/jobs/view/4445467972/",
        # 86. SOFTWARE DEVELOPER INTERNSHIP
        "https://www.linkedin.com/jobs/view/4401340346/",
        # 87. Intern Full-stack Engineer (AI Prompting)
        "https://www.linkedin.com/jobs/view/4439256724/",
        # 88. Typescript Engineer Intern - 6-month Internship
        "https://www.linkedin.com/jobs/view/4440454246/",
        # 89. ReactJS Engineer Intern - 6-month Internship
        "https://www.linkedin.com/jobs/view/4430250321/",
        # 90. JOB OPENING: NODEJS INTERN / FRESHER
        "https://www.linkedin.com/jobs/view/4434235596/",
        # 91. JOB OPENING: FRESHER NODEJS (MERN STACK)
        "https://www.linkedin.com/jobs/view/4434241139/",
        # 92. Penetration Tester - Intern
        "https://www.linkedin.com/jobs/view/4439334059/",
        # 93. Software Engineer Intern - QA
        "https://www.linkedin.com/jobs/view/4350676078/",
        # 94. Trainee 2026 QA/Tester
        "https://www.linkedin.com/jobs/view/4446293067/",
        # 95. Design Verification Intern
        "https://www.linkedin.com/jobs/view/4445484077/",
        # 96. Test Process and Equipment Engineer Intern
        "https://www.linkedin.com/jobs/view/4446713919/",
        # 97. Job Opening: MANUAL QA, QC Junior
        "https://www.linkedin.com/jobs/view/4434235594/",
        # 98. Security Software Engineer Intern
        "https://www.linkedin.com/jobs/view/4444978193/"
    ]
    asyncio.run(run_crawler(target_urls))
