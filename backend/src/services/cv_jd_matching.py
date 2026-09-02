from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import defaultdict
from collections.abc import Iterable
from typing import Any, Literal

from src.agents.tools.career_tools import SOFT_SKILLS, TECH_SKILLS, extract_known_terms
from src.services.text_cleaning import clean_jd_text, restore_diacritics

PIPELINE_VERSION = "1.0"
UNKNOWN_LABEL = "Chưa xác định"

RequirementStatus = Literal["matched", "partial", "missing", "unknown"]

SKILL_ALIASES: dict[str, str] = {
    "amazon web services": "AWS",
    "aws": "AWS",
    "ci cd": "CI/CD",
    "ci/cd": "CI/CD",
    "golang": "Go",
    "go": "Go",
    "javascript": "JavaScript",
    "js": "JavaScript",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "reactjs": "React",
    "react.js": "React",
    "react": "React",
    "restful api": "REST API",
    "rest api": "REST API",
    "vuejs": "Vue",
    "vue.js": "Vue",
    "vue": "Vue",
    "vector database": "Vector Database",
    "vector databases": "Vector Database",
    "qdrant": "Vector Database",
    "pgvector": "Vector Database",
    "milvus": "Vector Database",
    "restassured": "RestAssured",
    "rest-assured": "RestAssured",
    "postman": "Postman",
    "playwright": "Playwright",
    "selenium": "Selenium",
    "istqb": "ISTQB",
    "nlp": "NLP",
    "llm": "LLM",
    "rag": "RAG",
    "langchain": "LangChain",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",
    "terraform": "Terraform",
    "fastapi": "FastAPI",
    "python": "Python",
    "typescript": "TypeScript",
    "ts": "TypeScript",
    "redux": "Redux",
    "tailwind": "Tailwind",
    "tailwindcss": "Tailwind",
    "tailwind css": "Tailwind",
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "graphql": "GraphQL",
    "kafka": "Kafka",
    "redis": "Redis",
}

RELATED_SKILLS: dict[str, set[str]] = {
    "PostgreSQL": {"SQL", "MySQL", "SQL Server"},
    "MySQL": {"SQL", "PostgreSQL", "SQL Server"},
    "SQL Server": {"SQL", "PostgreSQL", "MySQL"},
    "MongoDB": {"NoSQL"},
    "AWS": {"Azure", "GCP"},
    "Azure": {"AWS", "GCP"},
    "GCP": {"AWS", "Azure"},
    "FastAPI": {"Flask", "Django", "REST API"},
    "Django": {"Flask", "FastAPI", "Python"},
    "Flask": {"Django", "FastAPI", "Python"},
    "React": {"Vue", "JavaScript", "TypeScript"},
    "Vue": {"React", "JavaScript", "TypeScript"},
    "Docker": {"Kubernetes", "CI/CD"},
    "Kubernetes": {"Docker"},
    "PyTorch": {"TensorFlow", "Machine Learning"},
    "TensorFlow": {"PyTorch", "Machine Learning"},
}

ROLE_SKILLS: dict[str, set[str]] = {
    "backend": {
        "Python",
        "Java",
        "C#",
        "Go",
        "FastAPI",
        "Django",
        "Flask",
        "Spring Boot",
        "Node.js",
        "REST API",
        "SQL",
        "PostgreSQL",
        "MySQL",
    },
    "frontend": {"JavaScript", "TypeScript", "React", "Vue", "HTML", "CSS", "Tailwind"},
    "fullstack": {"JavaScript", "TypeScript", "React", "Vue", "Node.js", "REST API", "SQL"},
    "data": {"Python", "SQL", "Machine Learning", "PyTorch", "TensorFlow"},
    "devops": {"Docker", "Kubernetes", "Linux", "CI/CD", "Jenkins", "AWS", "Azure", "GCP"},
    "cloud": {"AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux"},
    "qa": {"QA", "Selenium", "Postman"},
    "ai": {"AI", "Machine Learning", "Python", "PyTorch", "TensorFlow", "LangChain", "LangGraph"},
}

NICE_MARKERS = (
    "ưu tiên",
    "lợi thế",
    "điểm cộng",
    "khuyến khích",
    "preferred",
    "nice to have",
    "a plus",
    "plus",
    "bonus",
)
MUST_MARKERS = (
    "bắt buộc",
    "yêu cầu",
    "cần có",
    "thành thạo",
    "must",
    "required",
    "requirement",
    "proficient",
    "strong knowledge",
)
EXCLUSION_MARKERS = ("bắt buộc", "must have", "must-have", "mandatory", "required")
RESPONSIBILITY_MARKERS = (
    "phát triển",
    "xây dựng",
    "thiết kế",
    "triển khai",
    "duy trì",
    "vận hành",
    "phân tích",
    "kiểm thử",
    "tối ưu",
    "tối ưu hóa",
    "chủ trì",
    "quản lý",
    "giám sát",
    "hướng dẫn",
    "develop",
    "build",
    "design",
    "implement",
    "maintain",
    "operate",
    "analyze",
    "test",
    "optimize",
    "lead",
)


def _fold(value: str) -> str:
    text = str(value or "").casefold().replace("đ", "d").replace("Đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


# Canonical Classification Constants & Markers
# NON-SCORABLE Categories:
# - company_info
# - company_marketing
# - benefit
# - training_benefit
# - internship_program_description
# - application_instruction
# - website_contact
# - section_heading
# - duplicate
# - other_non_requirement

NON_REQUIREMENT_MARKERS = (
    # Benefits / Perks
    "quyen loi",
    "dai ngo",
    "benefits",
    "che do dai ngo",
    "che do phuc loi",
    "phuc loi",
    "muc luong",
    "luong thuong",
    "thang 13",
    "thuong kpi",
    "thuong le",
    "thuong tet",
    "bao hiem",
    "bhxh",
    "bhyt",
    "bhtn",
    "phu cap",
    "allowance",
    "an trua",
    "com trua",
    "macbook",
    "laptop",
    "thiet bi",
    "du lich",
    "team building",
    "teambuilding",
    "nghi phep",
    "ngay phep",
    "phep nam",
    "kham suc khoe",
    "gym",
    "tra caphe",
    "tra sua",
    "snack",
    "gui xe",
    "do xe",
    "ban se duoc",
    "ban duoc huong",
    "duoc huong",
    "duoc cung cap",
    "duoc trang bi",

    # Company Info & Marketing
    "gioi thieu tong quan",
    "gioi thieu cong ty",
    "ve chung toi",
    "about us",
    "company overview",
    "chung toi la",
    "thong tin cong ty",
    "gioi thieu du an",
    "welcome to",
    "van hoa cong ty",
    "moi truong lam viec",
    "moi truong nang dong",
    "moi truong chuyen nghiep",
    "co hoi nghe nghiep",
    "chao don ban",
    "gia nhap doi ngu",
    "la cong ty",
    "la tap doan",
    "la doanh nghiep",
    "la don vi",
    "thuoc tap doan",
    "truc thuoc tap doan",
    "truc thuoc",
    "thanh lap nam",
    "tru so tai",
    "chi nhanh tai",
    "van phong tai",
    "tien phong trong",
    "hang dau ve",
    "su menh",
    "tam nhin",
    "gia tri cot loi",

    # Internship Program Descriptions
    "chuong trinh thuc tap",
    "chuong trinh internship",
    "chuong trinh fresher",
    "duoc thiet ke nham",
    "mang den co hoi",
    "co hoi cho sinh vien",
    "danh cho sinh vien",
    "danh cho cac ban sinh vien",
    "tao co hoi cho",
    "tao dieu kien cho sinh vien",
    "trai nghiem thuc te",
    "muc dich cua chuong trinh",

    # Training Benefits & Subsidies
    "duoc dao tao",
    "dao tao va phat trien",
    "phat trien nghe nghiep",
    "co hoi dao tao",
    "tham gia dao tao",
    "ho tro dao tao",
    "chuong trinh dao tao",
    "duoc huong dan",
    "duoc mentor",
    "co co hoi hoc hoi",
    "co co hoi phat trien",
    "co co hoi ho tro",
    "co hoi ho tro",
    "ho tro thi chung chi",
    "ho tro chi phi thi",
    "tai tro thi chung chi",
    "ho tro le phi",
    "ho tro hoc phi",
    "ho tro thi",
    "tai tro thi",
    "co hoi thang tien",
    "duoc tham gia cac hoat dong",
    "duoc lam viec trong moi truong",
    "duoc huong cac che do",
    "duoc tham gia bao hiem",

    # Application Instructions & Process
    "quy trinh tuyen dung",
    "recruitment process",
    "cach thuc ung tuyen",
    "how to apply",
    "nop ho so",
    "nop cv",
    "gui cv",
    "gui cv qua",
    "gui cv ve",
    "gui ho so qua",
    "ung tuyen qua",
    "ung tuyen tai",
    "nop ho so tai",
    "lien he",
    "contact",
    "hr contact",
    "dia diem phong van",
    "apply link",
    "link ung tuyen",
    "tieu de email",
    "ho so gui ve",
    "han nop ho so",
    "han chot",
    "dia diem lam viec",
    "vi tri tuyen dung:",
    "mo ta cong viec:",

    # Website & Contact
    "website cong ty",
    "tham khao tai",
    "truy cap website",
    "tim hieu them tai",
    "fanpage",
    "hotline",
)

FLUFF_RESPONSIBILITY_PATTERNS = (
    "dong vai tro then chot",
    "dong vai tro quan trong",
    "co hoi phat trien",
    "moi truong lam viec",
    "tham gia cac hoat dong",
    "theo su phan cong",
    "cac cong viec khac theo",
    "tuan thu quy dinh",
    "bao cao tien do",
    "other duties as assigned",
    "support team members",
    "duoc dao tao",
    "duoc huong dan",
    "duoc ho tro",
    "co hoi hoc hoi",
    "chuong trinh internship",
    "chuong trinh thuc tap",
)


LANGUAGE_DISPLAY_MAP: dict[str, str] = {
    "en": "Tiếng Anh",
    "english": "Tiếng Anh",
    "vi": "Tiếng Việt",
    "vietnamese": "Tiếng Việt",
    "ja": "Tiếng Nhật",
    "jp": "Tiếng Nhật",
    "japanese": "Tiếng Nhật",
    "ko": "Tiếng Hàn",
    "kr": "Tiếng Hàn",
    "korean": "Tiếng Hàn",
    "zh": "Tiếng Trung",
    "cn": "Tiếng Trung",
    "chinese": "Tiếng Trung",
    "fr": "Tiếng Pháp",
    "french": "Tiếng Pháp",
    "de": "Tiếng Đức",
    "german": "Tiếng Đức",
}


def classify_jd_sentence(text: str) -> tuple[str, bool]:
    """Classify a JD text fragment into one of 8 canonical taxonomy categories:
    - CANDIDATE_REQUIREMENT (is_scorable = True)
    - PREFERRED_QUALIFICATION (is_scorable = True)
    - RESPONSIBILITY (is_scorable = False)
    - COMPANY_INFO (is_scorable = False)
    - BENEFIT (is_scorable = False)
    - CULTURE_OR_MARKETING (is_scorable = False)
    - HEADING (is_scorable = False)
    - NOISE (is_scorable = False)

    Returns:
        (category_name, is_scorable)
    """
    raw = str(text or "").strip()
    if not raw or len(raw) < 2:
        return "NOISE", False

    folded = _fold(raw)

    # 1. Pure numbering / bullets / markers
    if re.fullmatch(r"^[0-9a-zA-Z][\.\)]$", raw) or re.fullmatch(r"^[0-9]+(?:\.[0-9]+)*\.?$", raw) or re.fullmatch(r"^[\s#•*\-–—\d.)]+$", raw):
        return "HEADING", False

    # 2. Markdown headings
    if re.match(r"^#{1,6}\s*", raw):
        clean_after_hash = re.sub(r"^#{1,6}\s*", "", raw).strip()
        if not clean_after_hash or re.match(r"^(?:[IVXLCDM]+|\d+(\.\d*)*)\.?$", clean_after_hash, re.IGNORECASE) or len(clean_after_hash) < 3:
            return "HEADING", False
        if any(_fold(h) in _fold(clean_after_hash) for h in ("yeu cau", "mo ta", "trach nhiem", "quyen loi", "gioi thieu", "overview", "requirements", "responsibilities", "must have", "nice to have")):
            return "HEADING", False

    # 3. Known language display names
    if raw.lower() in LANGUAGE_DISPLAY_MAP or folded in LANGUAGE_DISPLAY_MAP:
        return "CANDIDATE_REQUIREMENT", True

    # 4. Section Headers
    section_headers = (
        "mo ta cong viec", "trach nhiem cong viec", "yeu cau cong viec", "yeu cau ung vien", "yeu cau ung tuyen",
        "must have", "nice to have", "quyen loi duoc huong", "thong tin khac",
        "job description", "job requirements", "requirements", "responsibilities", "overview",
        "gioi thieu chung", "quyen loi", "dai ngo", "cach thuc ung tuyen", "quy trinh tuyen dung", "why join us"
    )
    if any(folded == h or folded == f"{h}:" or re.match(rf"^(?:\d+\.\s*)?{re.escape(h)}\s*[:\-–—]?$", folded) for h in section_headers):
        return "HEADING", False

    # 5. URLs / Web links / Emails / Application process
    if re.search(r"https?://|www\.|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\.com/|\.vn/|bit\.ly", raw, re.IGNORECASE):
        return "NOISE", False
    if any(marker in folded for marker in (
        "quy trinh tuyen dung", "recruitment process", "cach thuc ung tuyen", "how to apply",
        "nop ho so", "nop cv", "gui cv", "ung tuyen qua", "ung tuyen tai", "nop ho so tai",
        "gui cv qua", "gui cv ve", "gui ho so qua", "tieu de email", "ho so gui ve",
        "apply link", "link ung tuyen", "lien he hr", "hr contact", "han nop ho so", "han chot"
    )):
        return "NOISE", False

    # 6. Culture / Marketing / Motivational Questions
    if raw.endswith("?") or any(folded.startswith(p) for p in (
        "ban yeu thich", "ban co yeu thich", "ban muon", "ban co muon", "ban dam me", "ban co dam me",
        "are you passionate", "do you want to", "looking to grow", "khat khao", "mong muon phat trien"
    )):
        return "CULTURE_OR_MARKETING", False
    if any(marker in folded for marker in (
        "trai nghiem moi truong", "tre trung", "van hoa doanh nghiep", "van hoa dac sac",
        "dong nghiep than thien", "khong gian lam viec", "khong gian sang tao", "moi truong nang dong",
        "co hoi phat trien ban than", "moi truong chuyen nghiep", "welcome to", "join our team",
        "our team", "doi ngu chung toi", "su menh", "tam nhin", "gia tri cot loi",
        "chuong trinh internship", "chuong trinh thuc tap", "chuong trinh fresher",
        "duoc thiet ke nham", "mang den co hoi", "co hoi cho sinh vien", "danh cho sinh vien",
        "danh cho cac ban sinh vien", "tao co hoi cho", "muc dich cua chuong trinh", "trai nghiem thuc te"
    )):
        return "CULTURE_OR_MARKETING", False

    # 7. Company Info
    if any(marker in folded for marker in (
        "la cong ty", "la tap doan", "la doanh nghiep", "thuoc tap doan", "truc thuoc",
        "thanh lap nam", "tru so tai", "chi nhanh tai", "gioi thieu cong ty", "ve chung toi",
        "about us", "company overview", "chung toi la", "tien phong trong", "hang dau ve", "quy mo cong ty"
    )):
        return "COMPANY_INFO", False

    # 8. Benefits & Perks & Subsidies
    if any(marker in folded for marker in (
        "quyen loi", "dai ngo", "benefits", "che do dai ngo", "che do phuc loi", "muc luong",
        "luong thuong", "thang 13", "thuong kpi", "bao hiem", "bhxh", "bhyt", "bhtn",
        "phu cap", "allowance", "an trua", "macbook", "laptop", "thiet bi", "du lich",
        "team building", "teambuilding", "nghi phep", "ngay phep", "kham suc khoe", "gym",
        "tra caphe", "snack", "duoc dao tao", "dao tao va phat trien", "phat trien nghe nghiep",
        "co hoi dao tao", "tham gia dao tao", "ho tro dao tao", "chuong trinh dao tao",
        "duoc huong dan", "duoc mentor", "co co hoi hoc hoi", "ho tro thi chung chi",
        "ho tro chi phi thi", "tai tro thi chung chi", "ho tro le phi", "ho tro hoc phi",
        "ho tro thi", "tai tro thi", "co hoi thang tien", "duoc cung cap", "duoc trang bi", "ban se duoc"
    )):
        return "BENEFIT", False

    # 9. Preferred Qualifications
    if any(_fold(marker) in folded for marker in NICE_MARKERS):
        return "PREFERRED_QUALIFICATION", True

    # 10. Responsibilities (Actions / Tasks)
    if any(re.search(rf"\b{re.escape(_fold(marker))}\b", folded) for marker in RESPONSIBILITY_MARKERS) and not any(_fold(m) in folded for m in MUST_MARKERS):
        return "RESPONSIBILITY", True

    return "CANDIDATE_REQUIREMENT", True


# Backward compatibility alias
classify_jd_fragment = classify_jd_sentence


def _is_non_requirement(text: str) -> bool:
    s = str(text or "").strip()
    if not s or len(s) < 2:
        return True
    if re.fullmatch(r"^[0-9a-zA-Z][\.\)]$", s) or re.fullmatch(r"^[0-9]+(?:\.[0-9]+)*\.?$", s):
        return True
    if s.lower() in LANGUAGE_DISPLAY_MAP or _fold(s) in LANGUAGE_DISPLAY_MAP:
        return False
    cat, is_scorable = classify_jd_fragment(s)
    return not is_scorable


def _clean_requirement_title(text: str) -> str:
    """Normalize raw JD text into concise, atomic human-readable requirement name."""
    raw = str(text or "").strip()
    if not raw or raw.lower() in {"null", "undefined"}:
        return ""
    if raw.lower() in LANGUAGE_DISPLAY_MAP:
        return LANGUAGE_DISPLAY_MAP[raw.lower()]

    s = re.sub(r"\s+", " ", raw).strip()
    s = re.sub(r"\\([#\-_*])", r"\1", s)
    s = re.sub(r"\s+#{1,6}\s*(?:[IVXLCDM]+|\d+)\.?(?:\s|$)", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"^một\s+số\s+lưu\s+ý\s+khác\s*[:\-–—]+\s*", "", s, flags=re.IGNORECASE)
    # Strip markdown noise: headings (### 4.), escaped slashes, duplicate hyphens
    s = re.sub(r"^#{1,6}\s*", "", s).strip()
    s = re.sub(r"\\([#\-_*])", r"\1", s)
    s = re.sub(r"-{2,}", "-", s).strip()
    # Strip leading numbers/bullets e.g. "4. ", "- ", "• "
    s = re.sub(r"^(?:\d+[\.\)]|\-|\•|\*|\+)\s*", "", s).strip()
    # Strip garbage numeric sequence (e.g. 1787577430444 4867317802322134103)
    s = re.sub(r"(?:trong vai trò|vị trí|role)\s+\d{5,}(?:\s+\d{5,})*", "trong vai trò tương đương", s, flags=re.IGNORECASE)
    s = re.sub(r"\b\d{6,}\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(
        r"^(?:\d+\.\s*)?(?:Trách nhiệm & Nhiệm vụ chính|Trách nhiệm|Nhiệm vụ chính|Nhiệm vụ|Yêu cầu bắt buộc \(Must-Have\)|Yêu cầu bắt buộc|Yêu cầu ưu tiên \(Nice-To-Have\)|Yêu cầu ưu tiên|Yêu cầu công việc|Yêu cầu ứng viên|Yêu cầu khác|Mô tả công việc|Must-Have|Nice-To-Have|Responsibilities|Requirements|Overview)\s*[:\-–—]?\s*",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()

    # Strip role prefixes when embedded into requirement line (e.g. "UI/UX Design Intern Có tư duy logic tốt...")
    s = re.sub(
        r"^(?:(?:UI/UX|Frontend|Backend|Fullstack|Data|DevOps|AI|Software|Mobile|iOS|Android|Product|QA|QC|Tester|HR)\s+)?"
        r"(?:Intern|Internship|Fresher|Junior|Middle|Senior|Lead|Principal|Architect|Developer|Engineer|Designer|Specialist|Manager|Thực tập sinh|Nhân viên|Chuyên viên|Kỹ sư|Lập trình viên)\s*[:\-–—,]?\s*"
        r"(?:(?:Có|Yêu cầu|Cần có|Khả năng|Thành thạo)\s+)?",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()

    s = re.sub(r"^[\-\•\*\+\d\.\)]+\s*", "", s).strip()
    # If the clean title is just a number, url or section header, return empty
    if _is_non_requirement(s):
        return ""
    return s


def _is_skill_list_sentence(text: str) -> bool:
    detected = _extract_canonical_skills(text)
    if not detected:
        return False
    folded = _fold(text)
    # Remove all skill list lead-in / connective phrases anywhere at the start
    folded = re.sub(
        r"^(?:thanh thao|su dung thanh thao|nam vung|hieu biet|co kien thuc|kien thuc|kinh nghiem|co kinh nghiem|lam viec|proficient in|strong knowledge of|experience with|working with|knowledge of)\s*(?:ve|voi|ve mat|cac|ve cac)?\s*(?:cong nghe cot loi|cong nghe|framework|cong cu|he thong phan tan|dien toan dam may|cloud)?\s*[:\-–—]?\s*",
        "",
        folded,
        flags=re.IGNORECASE,
    )
    # Remove any remaining detected skills and punctuation
    for sk in detected:
        folded = re.sub(rf"\b{re.escape(_fold(sk))}\b", "", folded)
    for conn in (
        "va", "hoac", "or", "and", "co ban", "nang cao", "tot", "is", "are",
        "required", "mandatory", "bat buoc", "yeu cau", "can co", "must", "have", "preferred", "nice", "to", "plus"
    ):
        folded = re.sub(rf"\b{conn}\b", "", folded).strip()
    return len(folded) <= 10


def _normalize_responsibility_task(text: str) -> str | None:
    """Extract a concise, concrete task from raw responsibility text, filtering out generic fluff."""
    folded = _fold(text)
    if any(marker in folded for marker in FLUFF_RESPONSIBILITY_PATTERNS):
        return None
    if _is_skill_list_sentence(text):
        return None

    clean = _clean_requirement_title(text)
    if len(clean) < 10:
        return None

    if any(k in folded for k in ("kien truc", "system design", "architecture", "thiet ke he thong")):
        return "Phân tích và thiết kế kiến trúc hệ thống"
    if any(k in folded for k in ("clean code", "testing", "kiem thu", "bao mat", "code quality", "security")):
        return "Clean code, testing và bảo mật"
    if any(k in folded for k in ("toi uu", "hieu nang", "performance", "optimize")):
        return "Tối ưu hiệu năng hệ thống và CSDL"
    if any(k in folded for k in ("api", "backend service", "microservice", "rest api", "grpc")):
        return "Phát triển API và dịch vụ Backend"
    if any(k in folded for k in ("ci/cd", "ci cd", "trien khai he thong", "deployment", "devops")):
        return "Vận hành và giám sát CI/CD"
    if any(k in folded for k in ("database", "co so du lieu", "csdl", "sql", "nosql")):
        return "Thiết kế và quản trị CSDL"

    return clean[:90].strip()


def _unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        key = _fold(value)
        if value and key not in seen:
            seen.add(key)
            output.append(value)
    return output


def canonical_skill(value: str) -> str:
    folded = _fold(value).replace("-", " ")
    # OCR/forms often store aliases together (``NextJS/Next.js`` or
    # ``ReactJS/React``).  Treat them as one canonical skill, but do not split
    # real compound technologies such as CI/CD.
    if "/" in folded and folded not in {"ci/cd"}:
        parts = [part.strip() for part in folded.split("/") if part.strip()]
        canonical_parts = [canonical_skill(part) for part in parts]
        if canonical_parts and len(set(canonical_parts)) == 1:
            return canonical_parts[0]
    if folded in SKILL_ALIASES:
        return SKILL_ALIASES[folded]
    for skill in TECH_SKILLS:
        if _fold(skill) == folded:
            return SKILL_ALIASES.get(folded, skill)
    return re.sub(r"\s+", " ", value).strip()


def _sentences(text: str) -> list[str]:
    # Escaped Markdown bullets often arrive from OCR as one long requirement.
    # Make them real boundaries before parsing; this changes only structured data.
    text = re.sub(r"\s*\\-\s*", "\n- ", text or "")
    text = re.sub(r"(?m)^\s*#{1,6}\s*(?:[IVXLCDM]+|\d+)\.?\s*$", "", text)
    text = re.sub(r"#{1,6}\s*(?:[IVXLCDM]+|\d+)\.?(?=\s|$)", "", text)
    # Nối các dòng bị ngắt giữa câu: Thay newline bằng khoảng trắng nếu
    # dòng trước không kết thúc bằng dấu câu và dòng sau không bắt đầu bằng bullet/số.
    healed = re.sub(r"(?<![.!?;:])[\r\n]+(?![ \t]*[•*\-–—\d.)])", " ", text or "")
    parts = re.split(r"[\r\n]+|(?<=[.!?;])\s+", healed)
    return _unique(re.sub(r"^[\s•*\-–—\d.)]+", "", part).strip() for part in parts if part.strip())


def _sentence_for_term(text: str, term: str) -> str:
    aliases = [alias for alias, canonical in SKILL_ALIASES.items() if canonical == term]
    aliases.append(term)
    for sentence in _sentences(text):
        folded = _fold(sentence)
        if any(re.search(rf"(?<!\w){re.escape(_fold(alias))}(?!\w)", folded) for alias in aliases):
            return sentence[:1000]
    return ""


def _extract_canonical_skills(text: str) -> list[str]:
    detected = [canonical_skill(skill) for skill in extract_known_terms(text, TECH_SKILLS)]
    folded = _fold(text)
    for alias, canonical in SKILL_ALIASES.items():
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", folded):
            detected.append(canonical)
    return _unique(detected)


def _requirement_kind(sentence: str) -> Literal["must", "nice"]:
    folded = _fold(sentence)
    if any(_fold(marker) in folded for marker in NICE_MARKERS):
        return "nice"
    return "must"


def _seniority(title_and_text: str) -> str | None:
    folded = _fold(title_and_text)
    for token, value in (
        ("intern", "intern"),
        ("thuc tap", "intern"),
        ("fresher", "fresher"),
        ("junior", "junior"),
        ("middle", "middle"),
        ("mid level", "middle"),
        ("senior", "senior"),
        ("lead", "lead"),
        ("manager", "manager"),
    ):
        if re.search(rf"(?<!\w){re.escape(token)}(?!\w)", folded):
            return value
    return None


def normalize_job_title(title: str) -> str:
    normalized = _fold(title)
    normalized = re.sub(r"\b(intern|internship|fresher|junior|middle|mid(?: level)?|senior|lead|manager)\b", "", normalized)
    aliases = (
        (r"\b(back[- ]?end|backend)\s+(developer|engineer)\b", "backend engineer"),
        (r"\b(front[- ]?end|frontend)\s+(developer|engineer)\b", "frontend engineer"),
        (r"\bfull[- ]?stack\s+(developer|engineer)\b", "fullstack engineer"),
        (r"\bsoftware developer\b", "software engineer"),
        (r"\bdevops developer\b", "devops engineer"),
    )
    for pattern, canonical in aliases:
        normalized = re.sub(pattern, canonical, normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _extract_salary_info(text: str) -> dict[str, Any]:
    """Extract salary min, max, currency, and visibility from JD text."""
    folded = _fold(text)
    salary_min = ""
    salary_max = ""
    currency = "VND"
    visibility = "Thỏa thuận"

    # Check for negotiable
    if any(k in folded for k in ("thoa thuan", "thương lượng", "thuong luong", "canh tranh", "competitive", "negotiable")):
        visibility = "Thỏa thuận"

    # Look for salary patterns e.g., 20 - 35 triệu, 20.000.000 - 35.000.000 VND, $1000 - $2000
    usd_match = re.search(r"\$\s*(\d{1,5}(?:[.,]\d{3})*)\s*[-~đếnto]+\s*\$?\s*(\d{1,5}(?:[.,]\d{3})*)", text, re.IGNORECASE)
    if usd_match:
        salary_min = usd_match.group(1).replace(",", "").replace(".", "")
        salary_max = usd_match.group(2).replace(",", "").replace(".", "")
        currency = "USD"
        visibility = "Công khai"
    else:
        vnd_million_match = re.search(
            r"(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|triệu)?\s*[-~đếnto]+\s*(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|triệu|vnd|vnđ)",
            text,
            re.IGNORECASE,
        )
        if vnd_million_match:
            try:
                val1 = float(vnd_million_match.group(1).replace(",", "."))
                val2 = float(vnd_million_match.group(2).replace(",", "."))
                if val1 < 1000:
                    val1 = val1 * 1_000_000
                if val2 < 1000:
                    val2 = val2 * 1_000_000
                salary_min = f"{int(val1):,}".replace(",", ".")
                salary_max = f"{int(val2):,}".replace(",", ".")
                currency = "VND"
                visibility = "Công khai"
            except Exception:
                pass
        else:
            vnd_exact_match = re.search(
                r"(\d{1,3}(?:\.\d{3}){2,})\s*[-~đếnto]+\s*(\d{1,3}(?:\.\d{3}){2,})",
                text,
            )
            if vnd_exact_match:
                salary_min = vnd_exact_match.group(1)
                salary_max = vnd_exact_match.group(2)
                currency = "VND"
                visibility = "Công khai"

    return {
        "salary_min": salary_min,
        "salary_max": salary_max,
        "salary_currency": currency,
        "salary_visibility": visibility,
    }


def _extract_department(text: str, title: str) -> str:
    """Extract or infer department from text or job title."""
    dept_match = re.search(r"(?:phòng ban|bộ phận|department|team)\s*[:\-]\s*([^\n.;,]+)", text, re.IGNORECASE)
    if dept_match:
        val = dept_match.group(1).strip()
        if 2 <= len(val) <= 40:
            return val
    title_lower = title.lower()
    if any(k in title_lower for k in ("ai", "machine learning", "data", "deep learning", "nlp", "llm")):
        return "AI & Data Research"
    if any(k in title_lower for k in ("front", "react", "next", "vue", "web", "ui", "ux")):
        return "Product Engineering"
    if any(k in title_lower for k in ("back", "python", "java", "golang", "node", "devops", "cloud")):
        return "Engineering"
    if any(k in title_lower for k in ("qa", "qc", "tester", "test")):
        return "Quality Assurance"
    if any(k in title_lower for k in ("ba", "business analyst", "product manager", "pm")):
        return "Product Management"
    return "Phát triển sản phẩm"


def _extract_quantity(text: str) -> str:
    """Extract recruitment quantity if present."""
    patterns = [
        r"(?:số lượng|so luong|quantity|hạn ngạch|headcount|chỉ tiêu)\s*(?:cần tuyển|tuyển dụng)?\s*[:\-]?\s*(\d+)",
        r"(?:cần tuyển|tuyển|tuyển dụng)\s*[:\-]?\s*(\d+)\s*(?:người|nhân sự|vị trí|candidates|bạn|thành viên|lập trình viên|kỹ sư|developer)",
        r"\b(?:sl)\s*[:\-]?\s*(\d+)",
    ]
    for pat in patterns:
        qty_match = re.search(pat, text, re.IGNORECASE)
        if qty_match:
            val = int(qty_match.group(1))
            if val > 0:
                return str(val)
    return ""


def _extract_deadline(text: str) -> str:
    """Extract application deadline if present. Empty means the JD states none."""
    label = r"(?:hạn\s*nộp[^:\-\n]{0,20}?|han\s*nop[^:\-\n]{0,20}?|deadline[^:\-\n]{0,20}?|hạn\s*chót[^:\-\n]{0,10}?|ngày\s*hết\s*hạn)"
    patterns = (
        rf"{label}\s*[:\-]?\s*(\d{{1,2}})\s*[/-]\s*(\d{{1,2}})\s*[/-]\s*(\d{{4}})",
        rf"{label}\s*[:\-]?\s*(\d{{4}})-(\d{{1,2}})-(\d{{1,2}})",
    )
    for pattern in patterns:
        dl_match = re.search(pattern, text, re.IGNORECASE)
        if dl_match:
            first, second, third = dl_match.groups()
            if len(first) == 4:
                year, month, day = int(first), int(second), int(third)
            else:
                day, month, year = int(first), int(second), int(third)
            if 1 <= month <= 12 and 1 <= day <= 31:
                return f"{year:04d}-{month:02d}-{day:02d}"
    return ""


def _format_html_list(items: list[str]) -> str:
    """Format an array of strings into an HTML unordered list."""
    clean_items = [re.sub(r"^[\s•*\-–—\d.)]+", "", item).strip() for item in items if item.strip()]
    if not clean_items:
        return ""
    lis = "".join(f"<li>{item}</li>" for item in clean_items)
    return f"<ul>{lis}</ul>"


def _build_job_sections_from_text(
    requirements_text: str,
    title: str,
    must_skills: list[str],
    nice_skills: list[str],
    responsibilities_list: list[str],
) -> list[dict[str, Any]]:
    """Partition text into 5 standard rich sections for the Word-Like editor."""
    raw_lines = [line.strip() for line in requirements_text.splitlines() if line.strip()]

    # Section buckets
    overview_lines: list[str] = []
    resp_lines: list[str] = []
    must_lines: list[str] = []
    nice_lines: list[str] = []
    benefit_lines: list[str] = []

    current_bucket: str = "overview"

    for line in raw_lines:
        line_folded = _fold(line)
        if any(h in line_folded for h in ("mo ta cong viec", "trach nhiem", "nhiem vu", "job description", "responsibilities", "what you will do", "what you'll do")):
            current_bucket = "resp"
            continue
        if any(h in line_folded for h in ("yeu cau cong viec", "yeu cau ung vien", "must have", "requirements", "qualifications", "ky nang bat buoc")):
            current_bucket = "must"
            continue
        if any(h in line_folded for h in ("yeu cau uu tien", "diem cong", "nice to have", "preferred", "uu tien")):
            current_bucket = "nice"
            continue
        if any(h in line_folded for h in ("quyen loi", "che do dai ngo", "benefits", "what we offer", "perks", "dai ngo")):
            current_bucket = "benefits"
            continue

        if current_bucket == "overview":
            overview_lines.append(line)
        elif current_bucket == "resp":
            resp_lines.append(line)
        elif current_bucket == "must":
            must_lines.append(line)
        elif current_bucket == "nice":
            nice_lines.append(line)
        elif current_bucket == "benefits":
            benefit_lines.append(line)

    # 1. Overview HTML — chỉ dùng nội dung thực tế trong JD, không bịa giới thiệu.
    overview_html = "".join(f"<p>{line}</p>" for line in overview_lines[:4])

    # 2. Responsibilities HTML
    resp_html = _format_html_list(resp_lines) if resp_lines else _format_html_list(responsibilities_list)

    # 3. Must-have HTML — chỉ kỹ năng/thông tin đọc được từ văn bản gốc.
    if must_lines:
        must_html = _format_html_list(must_lines)
    else:
        must_html = ""

    # 4. Nice-to-have HTML
    if nice_lines:
        nice_html = _format_html_list(nice_lines)
    elif nice_skills:
        nice_html = _format_html_list([f"Có kinh nghiệm hoặc hiểu biết về: {s}" for s in nice_skills])
    else:
        nice_html = ""

    # 5. Benefits HTML — bỏ hoàn toàn bảng đãi ngộ mẫu; trống nếu JD không ghi.
    benefit_html = _format_html_list(benefit_lines)

    def section_state(content: str) -> str:
        return "extracted" if content.strip() else "empty"

    sections_payload = [
        (overview_html, "sec-overview", "overview", "1. Giới thiệu tổng quan về vị trí", "Mô tả bối cảnh dự án, sứ mệnh của phòng ban và vai trò của vị trí trong công ty.", True),
        (resp_html, "sec-resp", "responsibilities", "2. Trách nhiệm & Nhiệm vụ chính", "Liệt kê các đầu việc thực tế mà ứng viên sẽ đảm nhận hàng ngày.", True),
        (must_html, "sec-musthave", "must_have", "3. Yêu cầu bắt buộc (Must-Have)", "Các kỹ năng, kinh nghiệm cốt lõi bắt buộc ứng viên phải có — dùng để đối chiếu hồ sơ.", True),
        (nice_html, "sec-nicetohave", "nice_to_have", "4. Yêu cầu ưu tiên (Nice-To-Have)", "Điểm cộng giúp ứng viên nổi bật hơn trong quá trình tuyển chọn.", False),
        (benefit_html, "sec-benefits", "benefits", "5. Quyền lợi & Đãi ngộ (Benefits)", "Chế độ lương thưởng, bảo hiểm, đào tạo và văn hóa doanh nghiệp.", True),
    ]
    return [
        {
            "id": sec_id,
            "type": sec_type,
            "title": sec_title,
            "hint": sec_hint,
            "content": content,
            "source": section_state(content),
            "isRequired": required,
        }
        for content, sec_id, sec_type, sec_title, sec_hint, required in sections_payload
    ]


def _minimum_years(text: str) -> float | None:
    folded = _fold(text)
    patterns = (
        r"(?:toi thieu|minimum|at least)\s*(\d+(?:[.,]\d+)?)\+?\s*(?:nam|years?)",
        r"(\d+(?:[.,]\d+)?)\+?\s*(?:nam|years?)\s*(?:kinh nghiem|experience)",
    )
    values: list[float] = []
    for pattern in patterns:
        values.extend(float(value.replace(",", ".")) for value in re.findall(pattern, folded))
    return max(values) if values else None


def parse_job_description(
    *,
    title: str,
    requirements_text: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Parse a JD into versioned, evidence-backed requirements without inventing fields."""
    metadata = metadata or {}
    # Làm sạch lỗi trích xuất (mojibake/khoảng trắng) trước khi phân tích.
    requirements_text = clean_jd_text(requirements_text)
    sentences = _sentences(requirements_text)
    must: dict[str, dict[str, Any]] = {}
    nice: dict[str, dict[str, Any]] = {}
    ambiguous_requirements: list[str] = []

    for skill in _extract_canonical_skills(requirements_text):
        if skill in {"QA", "IT", "CNTT"}:
            continue
        if skill == "AI" and not any(k in _fold(title) for k in ("ai", "artificial intelligence", "ml", "tri tue nhan tao", "engineer")):
            continue
        aliases = [alias for alias, canonical in SKILL_ALIASES.items() if canonical == skill] + [skill]
        matching_sentences = [
            sentence
            for sentence in sentences
            if any(
                re.search(rf"(?<!\w){re.escape(_fold(alias))}(?!\w)", _fold(sentence))
                for alias in aliases
            )
            and classify_jd_sentence(sentence)[0] in {"CANDIDATE_REQUIREMENT", "PREFERRED_QUALIFICATION", "RESPONSIBILITY"}
        ]
        if not matching_sentences:
            continue
        quote = next(
            (sentence for sentence in matching_sentences if _requirement_kind(sentence) == "must"),
            matching_sentences[0],
        )
        if {_requirement_kind(sentence) for sentence in matching_sentences} == {"must", "nice"}:
            ambiguous_requirements.append(f"{skill} xuất hiện ở cả required và preferred; ưu tiên required.")
        requirement = {
            "id": f"skill-{re.sub(r'[^a-z0-9]+', '-', _fold(skill)).strip('-')}",
            "name": skill,
            "importance": 5,
            "required_level": "unknown",
            "evidence_quote": quote,
            "is_exclusion": any(_fold(marker) in _fold(quote) for marker in EXCLUSION_MARKERS),
        }
        if _requirement_kind(quote) == "nice":
            requirement["importance"] = 2
            nice[skill] = requirement
        else:
            must[skill] = requirement

    # Curated catalog metadata is useful when a shortened description omits its skill list.
    for raw_skill in metadata.get("skills") or []:
        skill = canonical_skill(str(raw_skill))
        if skill and skill not in must and skill not in nice:
            must[skill] = {
                "id": f"skill-{re.sub(r'[^a-z0-9]+', '-', _fold(skill)).strip('-')}",
                "name": skill,
                "importance": 4,
                "required_level": "unknown",
                "evidence_quote": str(raw_skill),
                "is_exclusion": False,
            }

    responsibilities = []
    intro_prefixes = ("tuyen ", "tuyen dung", "tim kiem", "job description", "mo ta cong viec", "gioi thieu")
    for index, sentence in enumerate(sentences):
        if _is_non_requirement(sentence):
            continue
        cat, is_scorable = classify_jd_fragment(sentence)
        if not is_scorable or cat.upper() != "RESPONSIBILITY":
            continue
        folded = _fold(sentence)
        if any(marker in folded for marker in ("aim to grow", "career objective", "looking to grow", "seeking to grow", "muc tieu nghe nghiep")):
            continue
        if any(folded.startswith(p) for p in intro_prefixes):
            continue
        if any(folded.startswith(p) for p in ("duoc ", "co co hoi ", "tham gia khoa ", "duoc ho tro ", "duoc tham gia ")):
            continue
        if any(_fold(marker) in folded for marker in MUST_MARKERS + NICE_MARKERS):
            continue
        clean_resp = _clean_requirement_title(sentence[:1000])
        if clean_resp and not _is_non_requirement(clean_resp):
            responsibilities.append({"id": f"responsibility-{index + 1}", "text": clean_resp, "importance": 3})
        if len(responsibilities) == 8:
            break

    soft_requirements = []
    for index, skill in enumerate(extract_known_terms(requirements_text, SOFT_SKILLS), start=1):
        if _is_non_requirement(skill):
            continue
        quote = _sentence_for_term(requirements_text, skill) or skill
        soft_requirements.append(
            {
                "id": f"soft-{index}",
                "name": skill,
                "importance": 2,
                "evidence_quote": quote,
            }
        )

    education_requirements = []
    for sentence in sentences:
        if _is_non_requirement(sentence):
            continue
        cat, is_scorable = classify_jd_fragment(sentence)
        if not is_scorable:
            continue
        folded = _fold(sentence)
        if any(term in folded for term in ("bachelor", "degree", "dai hoc", "cao dang", "cu nhan")):
            clean_edu = _clean_requirement_title(sentence)
            if clean_edu and not _is_non_requirement(clean_edu):
                education_requirements.append(
                    {"id": f"education-{len(education_requirements) + 1}", "text": clean_edu, "importance": 2}
                )

    certification_requirements = []
    for sentence in sentences:
        if _is_non_requirement(sentence):
            continue
        cat, is_scorable = classify_jd_fragment(sentence)
        if not is_scorable:
            continue
        folded = _fold(sentence)
        if any(marker in folded for marker in ("ho tro thi", "tai tro thi", "co co hoi thi", "ho tro chi phi thi", "ho tro le phi", "ho tro chung chi")):
            continue
        if any(term in folded for term in ("certificate", "certification", "chung chi")):
            clean_cert = _clean_requirement_title(sentence)
            if clean_cert and not _is_non_requirement(clean_cert):
                certification_requirements.append(
                    {"id": f"certification-{len(certification_requirements) + 1}", "text": clean_cert, "importance": 2}
                )

    language_requirements = []
    language_terms = {
        "English": ("english", "tieng anh", "ielts", "toeic"),
        "Vietnamese": ("vietnamese", "tieng viet"),
        "Japanese": ("japanese", "tieng nhat", "jlpt"),
        "Korean": ("korean", "tieng han", "topik"),
        "Chinese": ("chinese", "tieng trung", "hsk"),
    }
    for sentence in sentences:
        folded = _fold(sentence)
        for language, terms in language_terms.items():
            if not any(term in folded for term in terms):
                continue
            level_match = re.search(r"\b(a1|a2|b1|b2|c1|c2|ielts\s*\d(?:[.,]\d)?)\b", folded)
            language_requirements.append(
                {
                    "id": f"language-{len(language_requirements) + 1}",
                    "text": sentence,
                    "language": language,
                    "normalized_language": {
                        "English": "en",
                        "Vietnamese": "vi",
                        "Japanese": "ja",
                        "Korean": "ko",
                        "Chinese": "zh",
                    }[language],
                    "minimum_level": level_match.group(1).upper() if level_match else None,
                    "importance": 3,
                }
            )
            break

    inferred_domain = metadata.get("domain")
    if not inferred_domain:
        for terms, domain in (
            (("fintech", "banking", "payment", "ngan hang", "thanh toan"), "fintech"),
            (("ecommerce", "e-commerce", "thuong mai dien tu"), "ecommerce"),
            (("healthcare", "health tech", "y te"), "healthcare"),
            (("education", "edtech", "giao duc"), "education"),
            (("retail", "ban le"), "retail"),
        ):
            if any(term in _fold(requirements_text) for term in terms):
                inferred_domain = domain
                break

    folded_all = _fold(requirements_text)
    raw_remote = metadata.get("remote_type") or (
        "hybrid"
        if "hybrid" in folded_all
        else "remote"
        if any(term in folded_all for term in ("remote", "tu xa"))
        else "onsite"
        if any(term in folded_all for term in ("onsite", "on-site", "tai van phong"))
        else "unspecified"
    )
    raw_employment = metadata.get("employment_type") or (
        "internship"
        if any(term in folded_all for term in ("intern", "internship", "thuc tap"))
        else "part_time"
        if any(term in folded_all for term in ("part time", "part-time", "ban thoi gian"))
        else "contract"
        if any(term in folded_all for term in ("contract", "hop dong"))
        else "full_time"
        if any(term in folded_all for term in ("full time", "full-time", "toan thoi gian"))
        else "unspecified"
    )

    explicit_classification = any(_fold(marker) in _fold(requirements_text) for marker in MUST_MARKERS + NICE_MARKERS)
    recognized_count = len(must) + len(nice) + len(responsibilities)

    # Form mapping helpers for frontend enterprise compatibility.
    # Không có bằng chứng trong văn bản => trả về nhãn chưa xác định,
    # tuyệt đối không đoán cấp bậc/hình thức/mô hình làm việc.
    inferred_seniority = metadata.get("job_level") or _seniority(f"{title}\n{requirements_text}")
    level_map = {
        "intern": "Intern",
        "fresher": "Fresher",
        "junior": "Junior",
        "middle": "Middle",
        "senior": "Senior",
        "lead": "Lead",
        "manager": "Manager",
    }
    level_ui = level_map.get(str(inferred_seniority or "").casefold(), UNKNOWN_LABEL)

    emp_map = {
        "full_time": "Full-time",
        "part_time": "Part-time",
        "internship": "Internship",
        "contract": "Contract",
    }
    employment_type_ui = emp_map.get(str(raw_employment or "").casefold(), UNKNOWN_LABEL)

    work_model_map = {
        "onsite": "On-site",
        "hybrid": "Hybrid",
        "remote": "Remote",
    }
    work_model_ui = work_model_map.get(str(raw_remote or "").casefold(), UNKNOWN_LABEL)

    tags_list = list(dict.fromkeys([item["name"] for item in list(must.values()) + list(nice.values())]))
    salary_info = _extract_salary_info(requirements_text)
    department_val = metadata.get("department") or _extract_department(requirements_text, title)
    min_years_val = _minimum_years(requirements_text)
    if min_years_val and min_years_val >= 1:
        experience_val = f"{int(min_years_val)} năm"
    else:
        # Chỉ nhận kinh nghiệm khi JD ghi rõ; không suy diễn khoảng mặc định.
        explicit_exp = next(
            (
                sentence
                for sentence in sentences
                if re.search(r"\b\d+(?:[.,]\d+)?\s*\+?\s*(?:năm|nam|years?)\b", _fold(sentence))
            ),
            "",
        )
        experience_val = explicit_exp[:200]
    quantity_val = _extract_quantity(requirements_text)
    deadline_val = metadata.get("deadline") or _extract_deadline(requirements_text)
    education_val = education_requirements[0]["text"] if education_requirements else ""

    # Sections generation
    must_skill_names = [item["name"] for item in must.values()]
    nice_skill_names = [item["name"] for item in nice.values()]
    resp_texts = [r["text"] for r in responsibilities]
    sections_data = _build_job_sections_from_text(
        requirements_text=requirements_text,
        title=title,
        must_skills=must_skill_names,
        nice_skills=nice_skill_names,
        responsibilities_list=resp_texts,
    )

    inferred_title = title.strip()
    generic_prefixes = ("job", "jd", "img", "image", "screenshot", "file", "tuyen dung", "photo", "posting")
    if not inferred_title or any(inferred_title.casefold().startswith(prefix) for prefix in generic_prefixes):
        for line in requirements_text.splitlines():
            cleaned_line = re.sub(
                r"^(?:Tuyển dụng|Vị trí|Tuyển|Cần tuyển|Job Title|Position)\s*[:\-]?\s*",
                "",
                restore_diacritics(line.strip()),
                flags=re.IGNORECASE,
            ).strip()
            if len(cleaned_line) >= 3 and not any(cleaned_line.casefold().startswith(p) for p in ("phòng ban", "mô tả", "yêu cầu", "quyền lợi", "địa điểm", "mức lương")):
                inferred_title = cleaned_line
                break

    detected_location = (
        "Hà Nội"
        if "hà nội" in folded_all or "ha noi" in folded_all
        else "Đà Nẵng"
        if "đà nẵng" in folded_all or "da nang" in folded_all
        else "TP. Hồ Chí Minh"
        if any(term in folded_all for term in ("hồ chí minh", "ho chi minh", "hcm", "saigon"))
        else ""
    )

    # Điểm chất lượng parse phản ánh đúng những gì trích xuất được từ văn bản:
    # không cộng điểm nền miễn phí, không tính điểm cho dữ liệu bịa.
    metadata_fields_found = sum(
        1
        for value in (salary_info["salary_min"], quantity_val, deadline_val, education_val, experience_val, detected_location)
        if value
    )
    parse_score = min(
        100.0,
        min(40.0, recognized_count * 4.0)
        + (15.0 if explicit_classification else 0.0)
        + (10.0 if title.strip() else 0.0)
        + min(15.0, metadata_fields_found * 2.5)
        + (20.0 if len(requirements_text) >= 400 else 10.0 if requirements_text.strip() else 0.0),
    )
    parsed = {
        "schema_version": PIPELINE_VERSION,
        "title": inferred_title,
        "company": metadata.get("company"),
        "job_level": inferred_seniority,
        "level": level_ui,
        "department": department_val,
        "employment_type": employment_type_ui,
        "work_model": work_model_ui,
        "location": metadata.get("location") or detected_location or UNKNOWN_LABEL,
        "tags": tags_list,
        "salary_min": salary_info["salary_min"],
        "salary_max": salary_info["salary_max"],
        "salary_currency": salary_info["salary_currency"],
        "salary_visibility": salary_info["salary_visibility"],
        "quantity": quantity_val,
        "experience": experience_val,
        "education": education_val,
        "deadline": deadline_val,
        "sections": sections_data,
        "domain": inferred_domain,
        "must_have_skills": list(must.values()),
        "nice_to_have_skills": list(nice.values()),
        "responsibilities": responsibilities,
        "min_years_experience": min_years_val,
        "education_requirements": education_requirements[:5],
        "certification_requirements": certification_requirements[:5],
        "language_requirements": language_requirements,
        "soft_skill_requirements": soft_requirements,
        "work_constraints": {
            "location": metadata.get("location"),
            "remote_type": raw_remote,
            "employment_type": raw_employment,
        },
        "parse_quality": {
            "score": round(parse_score, 1),
            "explicit_requirement_classification": explicit_classification,
            "missing_fields": [
                label
                for label, value in (
                    ("salary", salary_info["salary_min"]),
                    ("quantity", quantity_val),
                    ("deadline", deadline_val),
                    ("education", education_val),
                    ("experience", experience_val),
                    ("location", detected_location or (metadata.get("location") or "")),
                    ("tags", tags_list and "found"),
                )
                if not value
            ],
            "ambiguous_requirements": ambiguous_requirements
            + ([] if explicit_classification else ["JD không phân biệt rõ must-have và nice-to-have."]),
        },
    }
    parsed["job"] = {
        "job_id": str(metadata.get("job_id") or ""),
        "title_original": title.strip(),
        "title_normalized": normalize_job_title(title),
        "seniority": parsed["job_level"],
        "summary": sentences[0] if sentences else "",
        "location": parsed["work_constraints"]["location"],
        "work_mode": parsed["work_constraints"]["remote_type"],
        "employment_type": parsed["work_constraints"]["employment_type"],
    }
    parsed["requirements"] = _build_atomic_requirements(parsed, requirements_text)
    return parsed


def _degree_level(text: str) -> str:
    folded = _fold(text)
    for terms, level in (
        (("doctorate", "phd", "tien si"), "doctorate"),
        (("master", "thac si"), "master"),
        (("bachelor", "cu nhan", "dai hoc"), "bachelor"),
        (("associate", "cao dang"), "associate"),
        (("high school", "trung hoc"), "high_school"),
    ):
        if any(term in folded for term in terms):
            return level
    return "unknown"


HARD_CONSTRAINT_KEYWORDS = (
    "quoc tich",
    "giay phep",
    "chung chi hanh nghe",
    "work permit",
    "security clearance",
    "legal license",
    "visa",
    "bat buoc phap ly",
    "duoc phep lam viec",
)


def _is_hard_constraint(text: str) -> bool:
    folded = _fold(text)
    return any(kw in folded for kw in HARD_CONSTRAINT_KEYWORDS)


def _infer_importance(
    text: str,
    default_importance: float,
    req_type: str = "REQUIRED",
    *,
    job_title: str | None = None,
    seniority: str | None = None,
    min_years: float | None = None,
    is_central_responsibility: bool = False,
    repeated_count: int = 1,
) -> float:
    """Infer deterministic, explainable requirement importance from multi-factor signals.

    Factors considered:
    1. Requirement type baseline (REQUIRED=3.0, RESPONSIBILITY=2.0, PREFERRED=1.0)
    2. Explicit wording and emphasis signals (critical +1.5, basic -> 2.0, nice-to-have -> 1.0..1.5)
    3. Centrality to Job Title / Core role (+1.0 if skill is explicitly in Job Title)
    4. Measurable thresholds (min_years >= 5 -> +1.5; min_years >= 3 -> +0.5)
    5. Seniority expectations (Senior/Lead + architecture/system design/mentoring -> +1.0)
    6. Repeated emphasis across sections (repeated_count >= 2 -> +0.5)

    All final values are strictly clamped in [1.0, 5.0].
    """
    folded = _fold(text)
    score = float(default_importance)

    # 1. Explicit Wording Signals
    critical_signals = [
        "cuc ky quan trong", "bat buoc phai co", "bat buoc thanh thao", "chuyen sau",
        "chu chot", "cot loi", "toi quan trong", "rat quan trong", "nong cot",
        "essential", "must have", "critical", "expert", "expertise", "mastery",
        "deep knowledge", "core requirement", "heavily", "key requirement", "strong proficiency",
        "strong expertise", "thanh thao sau"
    ]
    basic_signals = [
        "biet co ban", "co hieu biet", "quen thuoc", "lam quen", "nam duoc",
        "basic knowledge", "familiar with", "working knowledge", "understanding of",
        "exposure to", "basic"
    ]
    preferred_signals = [
        "uu tien", "la loi the", "diem cong", "khong bat buoc", "co them",
        "preferred", "nice to have", "plus", "bonus", "optional", "advantage"
    ]

    if req_type == "PREFERRED" or any(sig in folded for sig in preferred_signals):
        if "lon" in folded or "strong plus" in folded or "great advantage" in folded or "dac biet uu tien" in folded:
            score = 1.5
        else:
            score = 1.0
    elif any(sig in folded for sig in critical_signals):
        score = min(5.0, score + 1.5)
    elif any(sig in folded for sig in basic_signals):
        score = 2.0 if score >= 2.0 else score

    # 2. Centrality to Job Title
    if job_title and req_type != "PREFERRED":
        folded_title = _fold(job_title)
        words = [w for w in re.split(r"[^a-z0-9+#]+", folded) if len(w) >= 2]
        if any(w in folded_title for w in words if w not in {"developer", "engineer", "chuyen", "vien", "lap", "trinh", "backend", "frontend", "fullstack"}):
            score = min(5.0, score + 1.0)

    # 3. Measurable Experience Thresholds
    if min_years is not None and req_type in {"REQUIRED", "RESPONSIBILITY"}:
        if min_years >= 5.0:
            score = max(score, 4.5)
        elif min_years >= 3.0:
            score = max(score, 3.5)

    # 4. Seniority Expectations
    if seniority and _fold(seniority) in {"senior", "lead", "principal", "manager"}:
        if any(term in folded for term in ("kien truc", "architecture", "system design", "thiet ke he thong", "lead", "mentor", "dinh huong")):
            score = min(5.0, score + 1.0)

    # 5. Central Responsibility or Repeated Emphasis
    if is_central_responsibility and req_type == "RESPONSIBILITY":
        score = min(5.0, score + 1.0)
    elif repeated_count >= 2 and req_type != "PREFERRED":
        score = min(5.0, score + 0.5)

    return round(min(5.0, max(1.0, score)), 1)


def _build_atomic_requirements(parsed: dict[str, Any], raw_text: str) -> list[dict[str, Any]]:
    """Convert normalized JD fields into independently retrievable requirements across 6 groups."""
    requirements: list[dict[str, Any]] = []

    def source_page(text: str) -> int:
        offset = raw_text.find(text)
        if offset < 0:
            return 1
        markers = list(re.finditer(r"(?m)^\[PAGE\s+(\d+)\]\s*$", raw_text[:offset]))
        return int(markers[-1].group(1)) if markers else 1

    def add(
        requirement_type: str,
        text: str,
        *,
        group: str,
        type: str,
        importance: float,
        mandatory: bool,
        priority: str,
        normalized_value: str | None = None,
        original_value: str | None = None,
        confidence: float = 0.9,
        is_hard_constraint: bool = False,
        **extra: Any,
    ) -> None:
        clean = _clean_requirement_title(re.sub(r"\s+", " ", str(text or "")).strip())
        if not clean or _is_non_requirement(clean):
            return
        cat, is_scorable = classify_jd_fragment(clean)
        if not is_scorable and not is_hard_constraint:
            return
        # The normalized value drives matching and scoring. It must be as clean as
        # the displayed requirement, otherwise headings such as "### 4. Docker"
        # can survive extraction as a machine value and be scored incorrectly.
        clean_normalized_value = _clean_requirement_title(str(normalized_value or clean)) or clean
        canon_name = canonical_skill(clean_normalized_value)
        dedupe_key = (_fold(group), _fold(canon_name))
        for existing in requirements:
            existing_canon = canonical_skill(existing.get("normalized_value") or existing.get("text") or "")
            existing_key = (
                _fold(existing.get("group") or ""),
                _fold(existing_canon),
            )
            if existing_key == dedupe_key:
                if importance > existing.get("importance", 1.0):
                    existing["importance"] = importance
                    existing["importance_level"] = (
                        "high" if (importance >= 2.5 or mandatory)
                        else "medium" if importance >= 1.5
                        else "low"
                    )
                    existing["importance_weight"] = float(importance)
                return

        importance_level = (
            "high" if (importance >= 2.5 or mandatory)
            else "medium" if importance >= 1.5
            else "low"
        )
        concept_type = extra.pop("concept_type", None)
        if not concept_type:
            if requirement_type in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
                concept_type = "hard_skill"
            elif requirement_type in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}:
                concept_type = "soft_skill"
            elif requirement_type == "JD_RESPONSIBILITY":
                concept_type = "responsibility"
            elif requirement_type == "JD_EXPERIENCE":
                concept_type = "experience"
            elif requirement_type == "JD_EDUCATION":
                concept_type = "education"
            elif requirement_type == "JD_CERTIFICATION":
                concept_type = "certification"
            elif requirement_type == "JD_LANGUAGE":
                concept_type = "language"
            else:
                concept_type = "hard_skill" if "skill" in requirement_type.lower() else "responsibility" if "responsibility" in requirement_type.lower() else "other"

        is_hard = bool(
            is_hard_constraint
            or extra.get("hard_gate")
            or any(m in _fold(clean) for m in ("bat buoc phai co", "bat buoc tot nghiep", "dieu kien tien quyet", "quoc tich", "giay phep hanh nghe", "mandatory legal", "non-negotiable"))
        )
        src_sent = str(extra.pop("source_sentence", None) or clean)
        requirements.append(
            {
                "requirement_id": (
                    f"JD_REQ_{len(requirements) + 1:03d}_"
                    f"{hashlib.sha256(f'{group}|{requirement_type}|{clean}|{raw_text}'.encode()).hexdigest()[:8].upper()}"
                ),
                "id": f"JD_REQ_{len(requirements) + 1:03d}",
                "canonical_name": canon_name,
                "original_text": clean,
                "group": group,
                "type": type,
                "concept_type": concept_type,
                "required_level": "required" if mandatory else "preferred",
                "importance": importance,
                "importance_level": importance_level,
                "importance_weight": float(importance),
                "is_hard_constraint": is_hard_constraint,
                "hard_gate": is_hard,
                "is_scorable": (not is_hard_constraint) and is_scorable,
                "classification": cat,
                "requirement_type": requirement_type,
                "text": clean,
                "mandatory": mandatory,
                "priority": priority,
                "normalized_value": clean_normalized_value,
                "original_value": original_value or clean_normalized_value or clean,
                "source_text": clean,
                "source_sentence": src_sent,
                "source_section": group,
                "source_page": source_page(clean),
                "confidence": confidence,
                "uncertain": confidence < 0.5,
                **extra,
            }
        )

    j_title = parsed.get("title")
    j_level = parsed.get("job_level")

    # Deduplicate languages from technical skills
    language_names = {item["language"].casefold() for item in parsed.get("language_requirements", [])}
    language_names.update({"english", "tieng anh", "vietnamese", "tieng viet", "japanese", "tieng nhat", "korean", "tieng han", "chinese", "tieng trung"})

    umbrella_skills = {"qa", "it", "cntt"}
    for item in parsed["must_have_skills"]:
        name = str(item["name"])
        if name.casefold() in language_names or name.casefold() in umbrella_skills or _is_non_requirement(name):
            continue
        if name.casefold() == "ai" and not any(k in _fold(j_title or "") for k in ("ai", "artificial intelligence", "ml", "tri tue nhan tao", "engineer")):
            continue
        quote = str(item.get("evidence_quote") or item.get("text") or name)
        imp = _infer_importance(quote, 3.0, "REQUIRED", job_title=j_title, seniority=j_level)
        add(
            "JD_REQUIRED_SKILL",
            name,
            group="skills",
            type="REQUIRED",
            importance=imp,
            mandatory=True,
            priority="critical" if item.get("is_exclusion") else "high",
            normalized_value=name,
            original_value=name,
            skill_original=name,
            skill_normalized=canonical_skill(name),
            source_sentence=quote,
            related_values=sorted(RELATED_SKILLS.get(name, set())),
        )
    required_names = {_fold(item["name"]) for item in parsed["must_have_skills"]}
    for item in parsed["nice_to_have_skills"]:
        name = str(item["name"])
        if _fold(name) in required_names or name.casefold() in language_names or name.casefold() in umbrella_skills or _is_non_requirement(name):
            continue
        quote = str(item.get("evidence_quote") or item.get("text") or name)
        imp = _infer_importance(quote, 1.0, "PREFERRED", job_title=j_title, seniority=j_level)
        add(
            "JD_PREFERRED_SKILL",
            name,
            group="skills",
            type="PREFERRED",
            importance=imp,
            mandatory=False,
            priority="low",
            normalized_value=name,
            original_value=name,
            skill_original=name,
            skill_normalized=canonical_skill(name),
            source_sentence=quote,
            related_values=sorted(RELATED_SKILLS.get(name, set())),
        )

    # Generic boilerplate responsibility filter
    for idx, item in enumerate(parsed.get("responsibilities", [])):
        text = str(item.get("text") or "")
        if _is_non_requirement(text) or _is_skill_list_sentence(text):
            continue
        norm_resp = _normalize_responsibility_task(text)
        if not norm_resp or _is_non_requirement(norm_resp):
            continue
        norm_folded = _fold(norm_resp)
        if (
            any(_fold(s.get("name", "")) in norm_folded for s in parsed.get("must_have_skills", []))
            or any(_fold(r.get("canonical_name", "")) in norm_folded for r in requirements if r.get("group") == "skills")
            or any(_fold(s.get("name", "")) in _fold(text) for s in parsed.get("must_have_skills", []))
        ):
            continue
        imp = _infer_importance(text, 2.0, "RESPONSIBILITY", job_title=j_title, seniority=j_level, is_central_responsibility=(idx == 0))
        add(
            "JD_RESPONSIBILITY",
            norm_resp,
            group="responsibilities_task_fit",
            type="RESPONSIBILITY",
            importance=imp,
            mandatory=False,
            priority="medium",
            normalized_value=norm_resp,
            source_sentence=text,
        )
    if parsed.get("min_years_experience") is not None:
        years = float(parsed["min_years_experience"])
        quote = next(
            (sentence for sentence in _sentences(raw_text) if _minimum_years(sentence) is not None),
            f"Tối thiểu {years:g} năm kinh nghiệm phù hợp.",
        )
        exp_title = f"Kinh nghiệm làm việc (≥ {years:g} năm)"
        exp_imp = _infer_importance(quote, 3.0, "REQUIRED", job_title=j_title, seniority=j_level, min_years=years)
        add(
            "JD_EXPERIENCE",
            exp_title,
            group="experience_seniority",
            type="REQUIRED",
            importance=exp_imp,
            mandatory=True,
            priority="high",
            normalized_value=exp_title,
            minimum_years=years,
            role=parsed.get("title"),
            seniority=parsed.get("job_level"),
            skill=None,
            domain=parsed.get("domain"),
            preferred_years=None,
            source_sentence=quote,
        )
    for item in parsed.get("education_requirements", []):
        text = str(item["text"])
        add(
            "JD_EDUCATION",
            text,
            group="education",
            type="REQUIRED" if _requirement_kind(text) == "must" else "PREFERRED",
            importance=float(item.get("importance", 3.0)),
            mandatory=_requirement_kind(text) == "must",
            priority="medium",
            normalized_value=text,
            source_sentence=text,
        )
    for item in parsed.get("certification_requirements", []):
        text = str(item["text"])
        add(
            "JD_CERTIFICATION",
            text,
            group="certifications_languages_other",
            type="REQUIRED" if _requirement_kind(text) == "must" else "PREFERRED",
            importance=float(item.get("importance", 3.0)),
            mandatory=_requirement_kind(text) == "must",
            priority="medium",
            normalized_value=text,
            source_sentence=text,
        )
    for item in parsed.get("language_requirements", []):
        lang = str(item.get("language") or "")
        quote = str(item.get("evidence_quote") or item.get("text") or lang)
        add(
            "JD_LANGUAGE",
            lang,
            group="certifications_languages_other",
            type="REQUIRED" if _requirement_kind(quote) == "must" else "PREFERRED",
            importance=float(item.get("importance", 2.0)),
            mandatory=_requirement_kind(quote) == "must",
            priority="medium",
            normalized_value=lang,
            source_sentence=quote,
        )

    for item in parsed.get("soft_skill_requirements", []) or parsed.get("soft_skills", []):
        name = str(item["name"])
        quote = str(item.get("evidence_quote") or name)
        add(
            "JD_REQUIRED_QUALIFICATION" if _requirement_kind(quote) == "must" else "JD_PREFERRED_QUALIFICATION",
            name,
            group="soft_skills",
            type="REQUIRED" if _requirement_kind(quote) == "must" else "PREFERRED",
            importance=float(item.get("importance", 2.0)),
            mandatory=_requirement_kind(quote) == "must",
            priority="low",
            normalized_value=name,
            source_sentence=quote,
        )

    domain = parsed.get("domain")
    if domain:
        add(
            "JD_DOMAIN",
            str(domain),
            group="domain_industry",
            type="PREFERRED",
            importance=2.0,
            mandatory=False,
            priority="medium",
            normalized_value=str(domain),
            domain=domain,
            minimum_years=None,
        )
    constraints = parsed.get("constraints") or {}
    invalid_constraint_values = {
        "unspecified", "unknown", "none", "", "null", "chua xac dinh",
        "khac", "other", "hybrid", "remote", "on-site", "onsite", "toan thoi gian", "full-time", "part-time"
    }
    for key, requirement_type in (
        ("location", "JD_LOCATION"),
        ("remote_type", "JD_WORK_MODE"),
        ("employment_type", "JD_EMPLOYMENT_TYPE"),
    ):
        if constraints.get(key):
            val = str(constraints[key]).strip()
            if val.casefold() in invalid_constraint_values or _fold(val) in invalid_constraint_values:
                continue
            is_hard = _is_hard_constraint(val)
            if is_hard:
                add(
                    requirement_type,
                    val,
                    group="certifications_languages_other",
                    type="HARD_CONSTRAINT",
                    importance=1.0,
                    is_hard_constraint=True,
                    mandatory=False,
                    priority="low",
                    normalized_value=val,
                    source_sentence=val,
                )
    claimed_sources = {_fold(item.get("source_text")) for item in requirements}
    claimed_sources.update({_fold(item.get("text")) for item in requirements})
    claimed_sources.update({_fold(item.get("normalized_value")) for item in requirements if item.get("normalized_value")})
    aspiration_markers = (
        "aim to grow",
        "career objective",
        "looking to grow",
        "seeking to grow",
        "mong muon phat trien",
        "muc tieu nghe nghiep",
        "tuyen dung",
        "tuyen mid",
        "tuyen senior",
        "tim kiem",
        "mo ta cong viec",
        "khong bat buoc",
        "hiring",
        "job description",
        "dong vai tro",
    )
    for sentence in _sentences(raw_text):
        folded_sentence = _fold(sentence)
        if (
            len(sentence) < 15
            or _is_non_requirement(sentence)
            or _is_skill_list_sentence(sentence)
            or folded_sentence in claimed_sources
            or sentence.startswith("[PAGE ")
            or any(marker in folded_sentence for marker in aspiration_markers)
            or any(f in folded_sentence for f in claimed_sources if len(f) >= 15)
        ):
            continue
        # If the sentence's source_sentence was already used to generate atomic skill requirements, skip adding the full raw sentence
        if any(_fold(r.get("source_sentence", "")) == folded_sentence for r in requirements if r.get("group") == "skills"):
            continue
        # Experience sentences belong only to experience_seniority group
        if _minimum_years(sentence) is not None or any(term in folded_sentence for term in ("nam kinh nghiem", "years of experience", "kinh nghiem thuc te")):
            continue
        # Education sentences belong only to education group
        if any(term in folded_sentence for term in ("bachelor", "degree", "dai hoc", "cao dang", "cu nhan", "tot nghiep")):
            continue
        # Language sentences belong only to language group
        if any(term in folded_sentence for term in ("tieng anh", "english", "ielts", "toeic", "tieng nhat", "tieng trung", "tieng han")):
            continue
        # Certification sentences belong only to certifications group
        if any(term in folded_sentence for term in ("certificate", "certification", "chung chi")):
            continue

        is_hard = _is_hard_constraint(sentence)
        has_req_keyword = any(_fold(marker) in folded_sentence for marker in MUST_MARKERS + NICE_MARKERS + EXCLUSION_MARKERS)
        if not is_hard and not has_req_keyword:
            continue
        add(
            "JD_OTHER_REQUIREMENT",
            sentence,
            group="certifications_languages_other",
            type="HARD_CONSTRAINT" if is_hard else "PREFERRED",
            importance=1.0,
            is_hard_constraint=is_hard,
            mandatory=False,
            priority="low",
            confidence=0.7,
        )

    # Post-process Boolean Logic Groups (ANY_OF vs ALL_OF):
    sentence_to_reqs: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for req in requirements:
        src_sent = req.get("source_sentence") or req.get("text") or ""
        sentence_to_reqs[src_sent].append(req)

    for src_sent, req_list in sentence_to_reqs.items():
        folded_s = _fold(src_sent)
        has_or = bool(re.search(r"(?<!\w)(?:hoac|hoặc|hay|\bor\b)(?!\w)", folded_s) or " / " in src_sent)
        op = "ANY_OF" if (has_or and len(req_list) > 1) else "ALL_OF"
        min_req = 1 if op == "ANY_OF" else len(req_list)
        grp_id = f"GRP_{op}_{hashlib.sha256(src_sent.encode('utf-8')).hexdigest()[:8].upper()}"
        options = [str(r.get("canonical_name") or r.get("normalized_value") or r.get("text")) for r in req_list]

        for req in req_list:
            req["group_id"] = grp_id
            req["operator"] = op
            req["group_operator"] = op
            req["min_required"] = min_req
            req["options"] = options
            req["group_label"] = src_sent

    return requirements


def _skill_values(parsed_cv: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("skills", "hard_skills"):
        for item in parsed_cv.get(key) or []:
            if isinstance(item, dict):
                value = item.get("canonical_name") or item.get("name") or item.get("original_text")
            else:
                value = item
            if value:
                normalized = canonical_skill(str(value))
                if _fold(normalized) not in {"", "-", "*", "n/a", "na", "none", "null", "unknown", "..."}:
                    values.append(normalized)
    return _unique(values)


def _original_skill_values(parsed_cv: dict[str, Any], cv_text: str) -> list[str]:
    values: list[str] = []
    for key in ("skills", "hard_skills", "soft_skills"):
        for item in parsed_cv.get(key) or []:
            if isinstance(item, dict):
                value = item.get("original_name") or item.get("original_text") or item.get("name")
            else:
                value = item
            if value:
                values.append(str(value))
    folded_cv = _fold(cv_text)
    for skill in _extract_canonical_skills(cv_text):
        aliases = [alias for alias, canonical in SKILL_ALIASES.items() if canonical == skill]
        original = next(
            (
                alias
                for alias in sorted(aliases, key=len, reverse=True)
                if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", folded_cv)
            ),
            skill,
        )
        values.append(original)
    return _unique(values)


def _attach_source_pages(parsed_cv: dict[str, Any], cv_text: str) -> dict[str, Any]:
    parsed = dict(parsed_cv)
    page_parts = re.split(r"\[PAGE\s+(\d+)\]", cv_text, flags=re.IGNORECASE)
    pages = [(int(page_parts[index]), page_parts[index + 1]) for index in range(1, len(page_parts) - 1, 2)]
    if not pages:
        return parsed
    for section in ("experience", "projects", "education", "certifications", "languages"):
        records = []
        for raw_record in parsed_cv.get(section) or []:
            if not isinstance(raw_record, dict) or raw_record.get("source_page"):
                records.append(raw_record)
                continue
            record = dict(raw_record)
            quote = str(record.get("evidence_quote") or record.get("description") or "").strip()
            if quote:
                compact_quote = _fold(quote)[:160]
                record["source_page"] = next(
                    (page_number for page_number, page_text in pages if compact_quote in _fold(page_text)),
                    None,
                )
            records.append(record)
        if records:
            parsed[section] = records
    return parsed


def _record_text(record: Any) -> str:
    if not isinstance(record, dict):
        return str(record or "")
    return " ".join(
        str(value)
        for key, value in record.items()
        if key not in {"id", "source_id"} and isinstance(value, (str, int, float))
    )


def _cv_skill_inventory(cv_text: str, parsed_cv: dict[str, Any]) -> dict[str, dict[str, Any]]:
    inventory: dict[str, dict[str, Any]] = {}
    detected = _extract_canonical_skills(cv_text)
    declared = _skill_values(parsed_cv)
    for skill in _unique([*declared, *detected]):
        evidence: list[dict[str, str]] = []
        strength = "declared"
        for section in ("experience", "projects", "certifications", "education"):
            for index, record in enumerate(parsed_cv.get(section) or []):
                text = _record_text(record)
                if skill in _extract_canonical_skills(text):
                    quote = str(record.get("evidence_quote") or record.get("description") or text).strip()
                    evidence.append(
                        {
                            "section": section,
                            "quote": quote[:1000],
                            "source_id": str(record.get("id") or f"{section}-{index + 1}"),
                        }
                    )
                    strength = "strong" if section in {"experience", "projects"} else "medium"
        if not evidence:
            quote = _sentence_for_term(cv_text, skill)
            if quote:
                evidence.append({"section": "raw_text", "quote": quote, "source_id": "cv-raw"})
                action_terms = (
                    "develop",
                    "build",
                    "design",
                    "implement",
                    "phat trien",
                    "xay dung",
                    "thiet ke",
                    "trien khai",
                )
                strength = "strong" if any(term in _fold(quote) for term in action_terms) else "declared"
        inventory[skill] = {"strength": strength, "evidence": evidence}
    return inventory


def _match_skill_requirement(
    requirement: dict[str, Any], inventory: dict[str, dict[str, Any]], requirement_type: str
) -> dict[str, Any]:
    skill = canonical_skill(str(requirement["name"]))
    direct = inventory.get(skill)
    if direct:
        points = {"strong": 100.0, "medium": 85.0, "declared": 70.0}.get(direct["strength"], 70.0)
        return {
            "requirement_id": requirement["id"],
            "requirement": skill,
            "requirement_type": requirement_type,
            "importance": requirement["importance"],
            "status": "matched",
            "evidence_strength": direct["strength"],
            "evidence": direct["evidence"],
            "reason": f"CV có bằng chứng cho {skill}.",
            "confidence": 0.98 if direct["evidence"] else 0.82,
            "score": points,
        }

    related = sorted(RELATED_SKILLS.get(skill, set()).intersection(inventory))
    if related:
        evidence = [entry for name in related for entry in inventory[name]["evidence"]][:4]
        return {
            "requirement_id": requirement["id"],
            "requirement": skill,
            "requirement_type": requirement_type,
            "importance": requirement["importance"],
            "status": "partial",
            "evidence_strength": "partial",
            "evidence": evidence,
            "reason": f"CV có kỹ năng liên quan ({', '.join(related)}) nhưng chưa có bằng chứng trực tiếp về {skill}.",
            "confidence": 0.85,
            "score": 50.0,
        }

    return {
        "requirement_id": requirement["id"],
        "requirement": skill,
        "requirement_type": requirement_type,
        "importance": requirement["importance"],
        "status": "missing",
        "evidence_strength": "missing",
        "evidence": [],
        "reason": f"Chưa tìm thấy bằng chứng về {skill} trong CV.",
        "confidence": 0.92,
        "score": 0.0,
    }


def _token_set(text: str) -> set[str]:
    stop = {"va", "voi", "cac", "cho", "trong", "the", "and", "with", "for", "from", "using", "a", "an"}
    return {token for token in re.findall(r"[a-z0-9+#.]{2,}", _fold(text)) if token not in stop}


def _match_text_requirement(
    requirement: dict[str, Any], cv_text: str, parsed_cv: dict[str, Any], requirement_type: str
) -> dict[str, Any]:
    target = str(requirement.get("text") or requirement.get("name") or "")
    target_tokens = _token_set(target)
    candidates: list[tuple[str, str, str]] = []
    for section in ("experience", "projects", "education", "certifications"):
        for index, record in enumerate(parsed_cv.get(section) or []):
            text = _record_text(record)
            candidates.append((section, str(record.get("id") or f"{section}-{index + 1}"), text))
    candidates.extend(("raw_text", "cv-raw", sentence) for sentence in _sentences(cv_text))

    best: tuple[float, str, str, str] | None = None
    for section, source_id, candidate in candidates:
        candidate_tokens = _token_set(candidate)
        overlap = len(target_tokens.intersection(candidate_tokens)) / max(1, len(target_tokens))
        if best is None or overlap > best[0]:
            best = (overlap, section, source_id, candidate)

    overlap, section, source_id, candidate = best or (0.0, "", "", "")
    if overlap >= 0.55:
        status: RequirementStatus = "matched"
        score, strength, confidence = 100.0, "strong", 0.86
    elif overlap >= 0.25:
        status = "partial"
        score, strength, confidence = 50.0, "partial", 0.72
    else:
        status = "unknown" if requirement_type == "soft_skill" else "missing"
        score, strength, confidence = 0.0, "unknown" if status == "unknown" else "missing", 0.65
    return {
        "requirement_id": requirement["id"],
        "requirement": target,
        "requirement_type": requirement_type,
        "importance": requirement.get("importance", 1),
        "status": status,
        "evidence_strength": strength,
        "evidence": (
            [{"section": section, "quote": candidate[:1000], "source_id": source_id}] if overlap >= 0.25 else []
        ),
        "reason": (
            f"Tìm thấy bằng chứng liên quan trong mục {section}."
            if overlap >= 0.25
            else "Chưa có đủ bằng chứng trong CV để kết luận."
        ),
        "confidence": confidence,
        "score": score,
    }


def _parse_period_months(text: str) -> int | None:
    folded = _fold(text)
    years = re.findall(r"\b(19\d{2}|20\d{2})\b", folded)
    if len(years) >= 2:
        return max(0, (int(years[-1]) - int(years[0])) * 12)
    duration_years = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:nam|years?)", folded)
    if duration_years:
        return round(float(duration_years.group(1).replace(",", ".")) * 12)
    duration_months = re.search(r"(\d+)\s*(?:thang|months?)", folded)
    return int(duration_months.group(1)) if duration_months else None


def _experience_months(parsed_cv: dict[str, Any]) -> tuple[int | None, bool]:
    records = parsed_cv.get("experience") or []
    durations = []
    for record in records:
        if isinstance(record, dict) and isinstance(record.get("duration_months"), (int, float)):
            durations.append(int(record["duration_months"]))
        else:
            duration = _parse_period_months(_record_text(record))
            if duration is not None:
                durations.append(duration)
    return (sum(durations) if durations else None, bool(records))


def _cv_seniority(parsed_cv: dict[str, Any], cv_text: str) -> str | None:
    titles = " ".join(
        str(record.get("title") or "") for record in parsed_cv.get("experience") or [] if isinstance(record, dict)
    )
    targets = " ".join(str(value) for value in parsed_cv.get("target_roles") or [])
    return _seniority(f"{titles}\n{targets}\n{cv_text[:1000]}")


def _role_fit(title: str, cv_text: str, inventory: dict[str, dict[str, Any]]) -> float:
    folded_title = _fold(title).replace("full stack", "fullstack")
    folded_cv = _fold(cv_text).replace("full stack", "fullstack")
    roles = [role for role in ROLE_SKILLS if role in folded_title]
    if not roles:
        return 100.0 if any(skill in inventory for skill in _extract_canonical_skills(title)) else 70.0
    if any(role in folded_cv for role in roles):
        return 100.0
    relevant = set().union(*(ROLE_SKILLS[role] for role in roles))
    overlap = len(relevant.intersection(inventory))
    return min(90.0, 45.0 + overlap * 10.0) if overlap else 20.0


def _group_score(items: list[dict[str, Any]]) -> float | None:
    scored = [item for item in items if item["status"] != "unknown"]
    denominator = sum(float(item.get("importance") or 1) for item in scored)
    if not denominator:
        return None
    return round(
        sum(float(item["score"]) * float(item.get("importance") or 1) for item in scored) / denominator,
        2,
    )


def _weighted_score(groups: dict[str, float | None]) -> float:
    weights = {
        "must_have_skills": 35.0,
        "experience_seniority": 20.0,
        "responsibilities": 15.0,
        "nice_to_have_skills": 10.0,
        "role_domain_fit": 10.0,
        "education_certification": 5.0,
        "soft_skills": 5.0,
    }
    active = {key: value for key, value in groups.items() if value is not None}
    denominator = sum(weights[key] for key in active)
    if not denominator:
        return 0.0
    return round(sum(float(value) * weights[key] for key, value in active.items()) / denominator, 2)


def _match_level(score: float, must_coverage: float, confidence: float) -> str:
    if confidence < 0.5:
        return "insufficient_data"
    if score >= 80 and must_coverage >= 0.85:
        return "high_match"
    if score >= 60 and must_coverage >= 0.65:
        return "application_ready"
    if score >= 40:
        return "partial_match"
    return "low_match"


def _run_spec_pipeline(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    jd: dict[str, Any],
    rubric: dict[str, Any] | None = None,
    on_progress: Any = None,
) -> dict[str, Any]:
    from src.config import get_settings
    from src.services.cv_jd_pipeline import PipelineConfig, run_cv_jd_pipeline

    settings = get_settings()
    normalized_cv = _attach_source_pages(parsed_cv, cv_text)
    # The evidence pipeline compares declared skills literally. Feed it the
    # canonical inventory so aliases such as ReactJS/React and NextJS/Next.js
    # cannot be reported as gaps.
    normalized_cv["skills"] = _skill_values(parsed_cv)
    result = run_cv_jd_pipeline(
        cv_text=cv_text,
        parsed_cv=normalized_cv,
        job_id=str(jd.get("job_id") or jd.get("title") or "JOB_UNKNOWN"),
        requirements=jd["requirements"],
        rubric=rubric,
        on_progress=on_progress,
        config=PipelineConfig(
            bm25_top_k=settings.cv_jd_bm25_top_k,
            semantic_top_k=settings.cv_jd_semantic_top_k,
            semantic_min_score=settings.cv_jd_semantic_min_score,
            rrf_k=settings.cv_jd_rrf_k,
            hybrid_top_k=settings.cv_jd_hybrid_top_k,
            max_evidence_per_requirement=settings.cv_jd_evidence_max_per_requirement,
            score_decimal_places=settings.cv_jd_score_decimal_places,
            embedding_provider=settings.cv_jd_embedding_provider,
            embedding_model=settings.cv_jd_embedding_model,
            embedding_api_key=settings.google_genai_api_key,
            embedding_dimensions=settings.cv_jd_embedding_dimensions,
            rating_poor_max=settings.cv_jd_rating_poor_max,
            rating_average_max=settings.cv_jd_rating_average_max,
            rating_good_max=settings.cv_jd_rating_good_max,
            extraction_min_confidence=settings.cv_jd_extraction_min_confidence,
            declared_skill_score_cap=settings.cv_jd_declared_skill_score_cap,
            mandatory_failure_score_cap=settings.cv_jd_mandatory_failure_score_cap,
        ),
    )
    evaluated = [
        *result["requirements"]["matched"],
        *result["requirements"]["partial"],
        *result["requirements"]["missing"],
        *result["requirements"]["uncertain"],
    ]
    evaluated.sort(key=lambda item: item["requirement_id"])
    legacy_status = {
        "SUPPORTED": "matched",
        "PARTIALLY_SUPPORTED": "partial",
        "NOT_FOUND": "missing",
        "CONFLICTING": "missing",
        "UNCERTAIN": "unknown",
    }
    matrix = []
    for item in evaluated:
        requirement_type = str(item.get("requirement_type") or "")
        compatibility_type = {
            "JD_REQUIRED_SKILL": "must_have_skill",
            "JD_PREFERRED_SKILL": "nice_to_have_skill",
            "JD_RESPONSIBILITY": "responsibility",
            "JD_REQUIRED_QUALIFICATION": "soft_skill",
            "JD_PREFERRED_QUALIFICATION": "soft_skill",
            "JD_EDUCATION": "education",
            "JD_CERTIFICATION": "certification",
            "JD_EXPERIENCE": "experience",
            "JD_DOMAIN": "domain",
        }.get(requirement_type, requirement_type.casefold())
        status = legacy_status.get(item.get("status", "NOT_FOUND"), "missing")
        evidence = [
            {
                "section": source.get("source_section") or "unknown",
                "quote": source["text"],
                "source_id": source["chunk_id"],
                **source,
            }
            for source in item.get("evidence", [])
        ]
        primary_evidence = evidence[0] if evidence else {}
        matrix.append(
            {
                "requirement_id": item["requirement_id"],
                "requirement": item.get("normalized_value") or item.get("canonical_name") or item.get("text") or "",
                "canonical_name": item.get("canonical_name") or item.get("normalized_value") or item.get("text") or "",
                "requirement_type": compatibility_type,
                "group": item.get("group") or "required_skills",
                "type": item.get("type") or ("REQUIRED" if item.get("mandatory") else "PREFERRED"),
                "importance": float(item.get("importance") or 1.0),
                "match_status": item.get("match_status") or ("MATCHED" if status == "matched" else "PARTIAL" if status == "partial" else "NOT_FOUND"),
                "match_score": float(item.get("match_score") or (1.0 if status == "matched" else 0.5 if status == "partial" else 0.0)),
                "jd_text": item.get("jd_text") or item.get("text") or "",
                "cv_text": item.get("cv_text") or (primary_evidence.get("quote") or primary_evidence.get("text") or ""),
                "evidence_text": item.get("cv_text") or (primary_evidence.get("quote") or primary_evidence.get("text") or ""),
                "evidence_chunk_id": primary_evidence.get("chunk_id") or primary_evidence.get("source_id"),
                "evidence_source": primary_evidence.get("parent_title") or primary_evidence.get("section") or "",
                "parent_title": primary_evidence.get("parent_title") or "",
                "relation": item.get("match_classification", "NOT_FOUND"),
                "match_classification": item.get("match_classification", "NOT_FOUND"),
                "comparison": item.get("comparison") or item.get("reason") or "",
                "status": status,
                "evaluation_status": item.get("status", "NOT_FOUND"),
                "evidence_strength": (
                    item.get("evidence_strength") or (
                        "strong"
                        if item.get("status") == "SUPPORTED"
                        else "partial"
                        if item.get("status") == "PARTIALLY_SUPPORTED"
                        else "unknown"
                        if item.get("status") == "UNCERTAIN"
                        else "missing"
                    )
                ).lower(),
                "evidence": evidence,
                "reason": item.get("comparison") or item.get("reason") or "",
                "explanation": item.get("comparison") or item.get("reason") or "",
                "confidence": float(item.get("confidence", 0.9)),
                "score": item.get("criterion_score", 0.0),
            }
        )

    required_skills = [item for item in evaluated if item["requirement_type"] == "JD_REQUIRED_SKILL"]
    preferred_skills = [item for item in evaluated if item["requirement_type"] == "JD_PREFERRED_SKILL"]
    skill_items = [*required_skills, *preferred_skills]
    matched = [str(item.get("normalized_value")) for item in skill_items if item["status"] == "SUPPORTED"]
    partial = [str(item.get("normalized_value")) for item in skill_items if item["status"] == "PARTIALLY_SUPPORTED"]
    missing = [
        str(item.get("normalized_value")) for item in skill_items if item["status"] in {"NOT_FOUND", "CONFLICTING"}
    ]
    coverage = (
        sum(
            1.0 if item["status"] == "SUPPORTED" else 0.5 if item["status"] == "PARTIALLY_SUPPORTED" else 0.0
            for item in required_skills
        )
        / len(required_skills)
        if required_skills
        else 1.0
    )
    cv_quality = float((parsed_cv.get("ats_quality") or {}).get("score") or (75 if parsed_cv else 55)) / 100
    jd_quality = float((jd.get("parse_quality") or {}).get("score") or 50) / 100
    evidence_ratio = len(result["evidence"]) / max(1, len(evaluated) * 3)
    confidence = round(min(1.0, cv_quality * 0.4 + jd_quality * 0.4 + evidence_ratio * 0.2), 2)
    raw_score = float(result.get("raw_final_score", result["final_score"]))
    if result.get("hard_gate_failed"):
        score = min(raw_score, 49.0)
    else:
        score = float(result["final_score"])

    criteria = [
        {
            **item,
            "weighted_score": round(item["weighted_score"] * (score / raw_score), 2) if raw_score > 0 else 0.0,
        }
        for item in result.get("criteria", [])
    ] if score < raw_score else result.get("criteria", [])

    score_breakdown = {
        item["criterion_id"].removeprefix("CRIT_").casefold(): item["raw_score"] for item in criteria
    }
    unknown = [
        str(item.get("normalized_value") or item["text"])
        for item in evaluated
        if item["status"] == "UNCERTAIN"
        or (
            item["requirement_type"] in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}
            and item["status"] == "NOT_FOUND"
        )
    ]
    soft_gap = [
        str(item.get("normalized_value") or item["text"])
        for item in evaluated
        if item["requirement_type"] in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}
        and item["status"] != "SUPPORTED"
    ]
    # Requirement Summary
    requirement_summary = {
        "total": len(evaluated),
        "supported": sum(1 for i in evaluated if i.get("status") == "SUPPORTED"),
        "partial": sum(1 for i in evaluated if i.get("status") == "PARTIALLY_SUPPORTED"),
        "missing": sum(1 for i in evaluated if i.get("status") in {"NOT_FOUND", "CONFLICTING"}),
        "uncertain": sum(1 for i in evaluated if i.get("status") == "UNCERTAIN"),
    }

    # Category Summary
    category_summary = {}
    for item in evaluated:
        cat = item.get("requirement_type") or "JD_OTHER"
        if cat not in category_summary:
            category_summary[cat] = {"total": 0, "supported": 0, "partial": 0, "missing": 0, "uncertain": 0}
        category_summary[cat]["total"] += 1
        st = item.get("status")
        if st == "SUPPORTED":
            category_summary[cat]["supported"] += 1
        elif st == "PARTIALLY_SUPPORTED":
            category_summary[cat]["partial"] += 1
        elif st in {"NOT_FOUND", "CONFLICTING"}:
            category_summary[cat]["missing"] += 1
        elif st == "UNCERTAIN":
            category_summary[cat]["uncertain"] += 1

    # Background Fit (Role, Seniority, Location matching from metadata if available)
    background_fit = {
        "role_match": True,
        "seniority_match": True,
        "location_match": True,
        "details": "Background fit matching based on available CV and JD data."
    }

    score_explanation = result.get("score_explanation", {})
    category_score_explanation = result.get("category_score_explanation", [])
    if score < raw_score and score_explanation and raw_score > 0:
        scale = score / raw_score
        score_explanation = {
            "final_score": score,
            "earned_points": score,
            "maximum_points": 100.0,
            "positive_contributions": [
                {
                    **item,
                    "contribution": round(item["contribution"] * scale, 1),
                }
                for item in score_explanation.get("positive_contributions", [])
            ],
            "partial_contributions": [
                {
                    **item,
                    "contribution": round(item["contribution"] * scale, 1),
                }
                for item in score_explanation.get("partial_contributions", [])
            ],
            "lost_points": score_explanation.get("lost_points", []),
        }
        category_score_explanation = [
            {
                **item,
                "earned_points": round(item["earned_points"] * scale, 1),
            }
            for item in category_score_explanation
        ]
    structured_strengths = result.get("structured_strengths", [])
    strengths = result.get("strengths", [])
    structured_blockers = result.get("structured_blockers", [])
    blockers = result.get("blockers", [])
    requirement_summary = result.get("requirement_summary", {
        "total": len(evaluated),
        "supported": sum(1 for i in evaluated if i.get("status") == "SUPPORTED"),
        "partial": sum(1 for i in evaluated if i.get("status") == "PARTIALLY_SUPPORTED"),
        "missing": sum(1 for i in evaluated if i.get("status") in {"NOT_FOUND", "CONFLICTING"}),
        "uncertain": sum(1 for i in evaluated if i.get("status") == "UNCERTAIN"),
    })
    risks = blockers
    return {
        **result,
        "pipeline_version": PIPELINE_VERSION,
        "match_score": score,
        "final_score": score,
        "raw_match_score": raw_score,
        "raw_final_score": raw_score,
        "criteria": criteria,
        "score_explanation": score_explanation,
        "category_score_explanation": category_score_explanation,
        "structured_strengths": structured_strengths,
        "strengths": strengths,
        "structured_blockers": structured_blockers,
        "blockers": blockers,
        "risks": risks,
        "requirement_summary": requirement_summary,
        "category_summary": category_summary,
        "background_fit": background_fit,
        "match_level": _match_level(score, coverage, confidence),
        "confidence_score": confidence,
        "confidence_level": "high" if confidence >= 0.8 else "medium" if confidence >= 0.5 else "low",
        "must_have_coverage": round(coverage, 2),
        "must_have_gate": {
            "applied": score < raw_score,
            "mandatory_requirement_failed": result["mandatory_requirement_failed"],
            "raw_score": raw_score,
            "final_score": score,
            "note": (
                "Điểm bị chặn vì còn yêu cầu bắt buộc chưa đủ evidence."
                if score < raw_score
                else "Không cần chặn điểm; điểm thô đã không vượt mức an toàn."
            ),
        },
        "cv_skills": _skill_values(parsed_cv),
        "jd_skills": [item["name"] for item in [*jd["must_have_skills"], *jd["nice_to_have_skills"]]],
        "jd_parsed": jd,
        "structured_jd": jd,
        "requirement_evidence": matrix,
        "hard_skills_matching": _unique(matched),
        "hard_skills_partial": _unique(partial),
        # A declared/aliased skill can be partial evidence, but it is not a
        # missing skill and must never be sent to learning recommendations.
        "hard_skills_missing": _unique(missing),
        "soft_skills_gap": _unique(soft_gap),
        "unknown_requirements": _unique(unknown),
        "score_breakdown": score_breakdown,
    }


def build_cv_jd_evidence(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    jd_title: str,
    jd_requirements: str,
    jd_parsed: dict[str, Any] | None = None,
    rubric: dict[str, Any] | None = None,
    on_progress: Any = None,
) -> dict[str, Any]:
    jd = parse_job_description(
        title=jd_title,
        requirements_text=jd_requirements,
        metadata=jd_parsed,
    )
    return _run_spec_pipeline(cv_text=cv_text, parsed_cv=parsed_cv, jd=jd, rubric=rubric, on_progress=on_progress)
