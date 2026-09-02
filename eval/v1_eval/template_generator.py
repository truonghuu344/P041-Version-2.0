"""Benchmark template generator and dataset loader for Audited V1 CV-JD Evaluation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from eval.v1_eval.schema import (
    BenchmarkCase,
    BenchmarkRequirement,
    BooleanGroupGroundTruth,
    DataOrigin,
    EvidenceRelation,
    EvidenceSpan,
    ExpectedProficiency,
    RequiredLevel,
    RequirementOutcome,
)

ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = ROOT / "eval" / "datasets" / "benchmark_dataset_v1.json"
SYNTHETIC_TEMPLATE_OUT_PATH = ROOT / "eval" / "benchmark_template_50_pairs.json"
REAL_MANIFEST_OUT_PATH = ROOT / "eval" / "real_benchmark_manifest.json"
GOLDEN_SAMPLE_PATH = ROOT / "eval" / "v1_golden_sample.json"


def generate_unlabeled_benchmark_template(
    source_json_path: Path | str = DATASET_PATH,
    output_path: Path | str = SYNTHETIC_TEMPLATE_OUT_PATH,
) -> list[BenchmarkCase]:
    """Generate benchmark template with 51 CV-JD pairs explicitly tagged as SYNTHETIC.

    All human ground truth fields are left unpopulated (null) for manual annotation.
    """
    src = Path(source_json_path)
    if not src.exists():
        raise FileNotFoundError(f"Source dataset not found at {src}")

    data = json.loads(src.read_text(encoding="utf-8"))
    cases: list[BenchmarkCase] = []

    for job in data.get("jobs", []):
        job_id = job.get("job_id", "")
        title = job.get("title", "")
        domain = job.get("domain", "")
        seniority_raw = str(job.get("seniority", "middle")).upper()
        raw_jd = job.get("raw_jd_text", "")
        job_reqs = job.get("requirements", [])

        # Map seniority to expected proficiency
        if seniority_raw in {"SENIOR", "LEAD"}:
            prof = ExpectedProficiency.SENIOR.value
        elif seniority_raw in {"JUNIOR", "INTERN", "FRESHER"}:
            prof = ExpectedProficiency.JUNIOR.value
        elif seniority_raw in {"EXPERT", "PRINCIPAL"}:
            prof = ExpectedProficiency.EXPERT.value
        elif seniority_raw in {"MIDDLE", "MID"}:
            prof = ExpectedProficiency.MIDDLE.value
        else:
            prof = ExpectedProficiency.UNSPECIFIED.value

        for cand in job.get("candidates", []):
            cv_id = cand.get("cv_id", "")
            case_id = f"CASE_{job_id}_{cv_id}"

            bench_reqs: list[BenchmarkRequirement] = []
            for r in job_reqs:
                is_req = str(r.get("type", "REQUIRED")).upper() in {"REQUIRED", "MANDATORY"}
                req_level = RequiredLevel.REQUIRED.value if is_req else RequiredLevel.PREFERRED.value

                req_obj = BenchmarkRequirement(
                    requirement_id=str(r.get("requirement_id", "")),
                    canonical_name=str(r.get("normalized_value") or r.get("canonical_name") or r.get("text", "")),
                    required_level=req_level,
                    expected_proficiency=prof,
                    importance=float(r.get("importance", 1.0)),
                    text=str(r.get("text", "")),
                    group=str(r.get("group", "skills")),
                    hard_gate=bool(r.get("mandatory", False)),
                    human_is_critical_gap=None,  # Null for manual labeling
                    evidence_relation=None,  # Null for manual labeling
                    requirement_outcome=None,  # Null for manual labeling
                    expected_evidence=[],  # Empty for manual span labeling
                    expected_evidence_chunk_ids=[],
                    group_id=r.get("group_id"),
                    group_operator=r.get("group_operator"),
                    notes="",
                )
                bench_reqs.append(req_obj)

            b_case = BenchmarkCase(
                case_id=case_id,
                cv_id=cv_id,
                jd_id=job_id,
                data_origin=DataOrigin.SYNTHETIC.value,
                source_dataset="benchmark_dataset_v1",
                requirements=bench_reqs,
                boolean_groups=[],
                human_overall_score=None,  # Null for manual rating
                cv_text=str(cand.get("cv_text", "")),
                cv_parsed=dict(cand.get("cv_parsed", {})),
                jd_title=title,
                jd_requirements=raw_jd,
                domain=domain,
                seniority=seniority_raw.lower(),
                notes=str(cand.get("notes", "")),
            )
            cases.append(b_case)

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump([c.to_dict() for c in cases], f, indent=2, ensure_ascii=False)

    return cases


def create_real_benchmark_manifest(
    output_path: Path | str = REAL_MANIFEST_OUT_PATH,
) -> list[BenchmarkCase]:
    """Create a structured REAL benchmark manifest with recommended domain compositions.

    Covers:
    - Backend / Full-stack
    - AI / ML
    - Data Engineering
    - DevOps / Cloud Infrastructure
    - Mobile (iOS/Android/Flutter)
    - Frontend (React/Vue/Next.js)
    - Vietnamese and English CV/JDs
    - Exact matches, aliases, inferred skills, adjacent skills, true missing skills,
      experience duration, language, soft skills, ANY_OF, ALL_OF, hard gates, messy formatting.

    All human ground truth fields are left un-populated for human annotators.
    """
    manifest_specs = [
        # 1. Backend / Fullstack (Vietnamese + English, Hard Gate, ANY_OF Database)
        {
            "case_id": "REAL_BE_VN_001",
            "cv_id": "REAL_CV_BE_001",
            "jd_id": "REAL_JD_BE_001",
            "domain": "backend",
            "seniority": "senior",
            "jd_title": "Senior Java/Golang Backend Engineer",
            "jd_requirements": "Bắt buộc có giấy phép lao động hợp lệ. Tối thiểu 5 năm kinh nghiệm backend. Yêu cầu Java hoặc Golang. Thành thạo PostgreSQL hoặc MySQL. Kinh nghiệm Docker và CI/CD.",
            "cv_text": "Họ và tên: Nguyễn Văn A. Vị trí: Backend Developer (5 năm kinh nghiệm). Công nghệ: Java Core, Spring Boot, MySQL, Docker, GitLab CI/CD. Đã tham gia triển khai microservices.",
            "cv_parsed": {
                "skills": ["Java", "Spring Boot", "MySQL", "Docker", "GitLab CI"],
                "experience": [{"title": "Senior Backend Developer", "duration_months": 60, "description": "Lập trình backend hệ thống ngân hàng bằng Java Spring Boot và MySQL."}],
            },
            "requirements": [
                {"requirement_id": "REQ_WORK_PERMIT", "canonical_name": "Work Permit", "required_level": "REQUIRED", "expected_proficiency": "UNSPECIFIED", "hard_gate": True, "text": "Bắt buộc có giấy phép lao động hợp lệ"},
                {"requirement_id": "REQ_EXP_5Y", "canonical_name": "Backend Experience", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "hard_gate": True, "text": "Tối thiểu 5 năm kinh nghiệm backend"},
                {"requirement_id": "REQ_LANG_JAVA", "canonical_name": "Java", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "group_id": "GRP_LANG", "group_operator": "ANY_OF", "text": "Lập trình Java backend"},
                {"requirement_id": "REQ_LANG_GO", "canonical_name": "Golang", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "group_id": "GRP_LANG", "group_operator": "ANY_OF", "text": "Lập trình Golang backend"},
                {"requirement_id": "REQ_DB_PG", "canonical_name": "PostgreSQL", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "group_id": "GRP_DB", "group_operator": "ANY_OF", "text": "Cơ sở dữ liệu PostgreSQL"},
                {"requirement_id": "REQ_DB_MYSQL", "canonical_name": "MySQL", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "group_id": "GRP_DB", "group_operator": "ANY_OF", "text": "Cơ sở dữ liệu MySQL"},
                {"requirement_id": "REQ_DOCKER", "canonical_name": "Docker", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Containerization với Docker"},
            ],
            "boolean_groups": [
                {"group_id": "GRP_LANG", "operator": "ANY_OF", "min_required": 1, "member_requirement_ids": ["REQ_LANG_JAVA", "REQ_LANG_GO"]},
                {"group_id": "GRP_DB", "operator": "ANY_OF", "min_required": 1, "member_requirement_ids": ["REQ_DB_PG", "REQ_DB_MYSQL"]},
            ],
        },
        # 2. AI / ML (English, Inferred RAG, Adjacent ML, Messy formatting)
        {
            "case_id": "REAL_AI_EN_002",
            "cv_id": "REAL_CV_AI_002",
            "jd_id": "REAL_JD_AI_002",
            "domain": "ai",
            "seniority": "middle",
            "jd_title": "Generative AI & LLM Engineer",
            "jd_requirements": "Looking for Mid AI Engineer. Must know Python and PyTorch. Experience in building RAG systems with Vector DB (Milvus/Qdrant/Pinecone). English communication fluent.",
            "cv_text": "AI Engineer (2.5 years). Developed enterprise document Q&A assistant using LangChain, OpenAI API, and Chroma vector store on Python backend. TOEIC 850.",
            "cv_parsed": {
                "skills": ["Python", "LangChain", "OpenAI API", "ChromaDB", "LLM"],
                "experience": [{"title": "AI Engineer", "duration_months": 30, "description": "Built semantic search and question answering pipeline on PDF documents using LangChain and Chroma."}],
            },
            "requirements": [
                {"requirement_id": "REQ_PYTHON", "canonical_name": "Python", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Proficient in Python"},
                {"requirement_id": "REQ_PYTORCH", "canonical_name": "PyTorch", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Hands-on PyTorch"},
                {"requirement_id": "REQ_RAG", "canonical_name": "RAG", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Retrieval-Augmented Generation (RAG)"},
                {"requirement_id": "REQ_VECTOR_DB", "canonical_name": "Vector Database", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Vector Database (Milvus/Qdrant/Pinecone)"},
                {"requirement_id": "REQ_ENGLISH", "canonical_name": "English", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Fluent English communication"},
            ],
        },
        # 3. Data Engineering (Vietnamese, Duration gap vs Skill match, Spark/Airflow)
        {
            "case_id": "REAL_DATA_VN_003",
            "cv_id": "REAL_CV_DATA_003",
            "jd_id": "REAL_JD_DATA_003",
            "domain": "data",
            "seniority": "senior",
            "jd_title": "Senior Data Engineer (ETL/Lakehouse)",
            "jd_requirements": "Yêu cầu 4+ năm kinh nghiệm Data Engineering. Bắt buộc Apache Spark, PySpark, Airflow và Cloud Data Warehouse (BigQuery hoặc Snowflake).",
            "cv_text": "Kỹ sư dữ liệu 2 năm kinh nghiệm. Xây dựng pipeline xử lý dữ liệu với PySpark trên Apache Spark, lập lịch bằng Airflow, tải dữ liệu vào Google BigQuery.",
            "cv_parsed": {
                "skills": ["PySpark", "Apache Spark", "Airflow", "BigQuery", "SQL"],
                "experience": [{"title": "Data Engineer", "duration_months": 24, "description": "Phát triển ETL pipeline với PySpark và Airflow, tối ưu hóa BigQuery."}],
            },
            "requirements": [
                {"requirement_id": "REQ_EXP_4Y", "canonical_name": "Data Engineering Experience", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "hard_gate": True, "text": "Tối thiểu 4 năm kinh nghiệm Data Engineering"},
                {"requirement_id": "REQ_SPARK", "canonical_name": "Apache Spark", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "text": "Thành thạo Apache Spark / PySpark"},
                {"requirement_id": "REQ_AIRFLOW", "canonical_name": "Apache Airflow", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Quản lý pipeline với Airflow"},
                {"requirement_id": "REQ_DWH", "canonical_name": "BigQuery", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Cloud Data Warehouse (BigQuery/Snowflake)"},
            ],
        },
        # 4. DevOps / Cloud (English, AWS vs GCP Adjacent, Kubernetes, Terraform)
        {
            "case_id": "REAL_DEVOPS_EN_004",
            "cv_id": "REAL_CV_DEVOPS_004",
            "jd_id": "REAL_JD_DEVOPS_004",
            "domain": "devops",
            "seniority": "senior",
            "jd_title": "Senior AWS Cloud DevOps Engineer",
            "jd_requirements": "Senior DevOps Engineer with 5+ yrs experience. Deep expertise in AWS (EKS, VPC, RDS), Kubernetes cluster management, and Terraform IaC.",
            "cv_text": "Senior Cloud Infrastructure Engineer 5 years. Proficient in Google Cloud Platform (GKE, VPC), Kubernetes, Docker, Helm, and Terraform.",
            "cv_parsed": {
                "skills": ["GCP", "Kubernetes", "Docker", "Terraform", "Helm", "GKE"],
                "experience": [{"title": "Senior Cloud Engineer", "duration_months": 60, "description": "Architected multi-tenant Kubernetes clusters on GCP with Terraform."}],
            },
            "requirements": [
                {"requirement_id": "REQ_AWS", "canonical_name": "AWS", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "text": "Expertise in AWS cloud services"},
                {"requirement_id": "REQ_K8S", "canonical_name": "Kubernetes", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "text": "Kubernetes cluster administration"},
                {"requirement_id": "REQ_TERRAFORM", "canonical_name": "Terraform", "required_level": "REQUIRED", "expected_proficiency": "SENIOR", "text": "Infrastructure as Code with Terraform"},
            ],
        },
        # 5. Mobile (Vietnamese + English, Flutter / React Native / iOS)
        {
            "case_id": "REAL_MOBILE_VN_005",
            "cv_id": "REAL_CV_MOBILE_005",
            "jd_id": "REAL_JD_MOBILE_005",
            "domain": "mobile",
            "seniority": "middle",
            "jd_title": "Mobile App Developer (Flutter / React Native)",
            "jd_requirements": "Tuyển dụng Lập trình viên Mobile. Yêu cầu Flutter hoặc React Native. Có ứng dụng đã publish trên App Store hoặc Google Play. Ưu tiên có kiến thức Native iOS (Swift).",
            "cv_text": "Lập trình viên Flutter 3 năm. Đã phát hành 3 ứng dụng thương mại điện tử trên Google Play và App Store. Có kinh nghiệm viết plugin Native Java/Kotlin.",
            "cv_parsed": {
                "skills": ["Flutter", "Dart", "Google Play", "App Store", "Android", "Kotlin"],
                "experience": [{"title": "Flutter Developer", "duration_months": 36, "description": "Phát triển app bán hàng đa nền tảng bằng Flutter, publish App Store và Play Store."}],
            },
            "requirements": [
                {"requirement_id": "REQ_FRAMEWORK_FLUTTER", "canonical_name": "Flutter", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "group_id": "GRP_MOB", "group_operator": "ANY_OF", "text": "Lập trình mobile Flutter"},
                {"requirement_id": "REQ_FRAMEWORK_RN", "canonical_name": "React Native", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "group_id": "GRP_MOB", "group_operator": "ANY_OF", "text": "Lập trình mobile React Native"},
                {"requirement_id": "REQ_PUBLISH", "canonical_name": "App Store / Google Play", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Kinh nghiệm publish app lên store"},
                {"requirement_id": "PREF_IOS_SWIFT", "canonical_name": "Swift", "required_level": "PREFERRED", "expected_proficiency": "MIDDLE", "text": "Kinh nghiệm Native iOS Swift"},
            ],
            "boolean_groups": [
                {"group_id": "GRP_MOB", "operator": "ANY_OF", "min_required": 1, "member_requirement_ids": ["REQ_FRAMEWORK_FLUTTER", "REQ_FRAMEWORK_RN"]},
            ],
        },
        # 6. Frontend (English, Next.js / React / TypeScript / Redux)
        {
            "case_id": "REAL_FE_EN_006",
            "cv_id": "REAL_CV_FE_006",
            "jd_id": "REAL_JD_FE_006",
            "domain": "frontend",
            "seniority": "middle",
            "jd_title": "Frontend Engineer (React / Next.js)",
            "jd_requirements": "Looking for Frontend Engineer with strong React, Next.js, TypeScript, Tailwind CSS and State Management (Redux/Zustand).",
            "cv_text": "Frontend Web Developer with 3 years experience. Skilled in ReactJS, NextJS, TypeScript, TailwindCSS, and Redux Toolkit. Built responsive dashboards.",
            "cv_parsed": {
                "skills": ["ReactJS", "NextJS", "TypeScript", "TailwindCSS", "Redux Toolkit"],
                "experience": [{"title": "Frontend Developer", "duration_months": 36, "description": "Built high-performance dashboard using Next.js, TypeScript and Tailwind CSS."}],
            },
            "requirements": [
                {"requirement_id": "REQ_REACT", "canonical_name": "React", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "React web development"},
                {"requirement_id": "REQ_NEXTJS", "canonical_name": "Next.js", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Next.js SSR/SSG"},
                {"requirement_id": "REQ_TS", "canonical_name": "TypeScript", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "TypeScript"},
                {"requirement_id": "REQ_TAILWIND", "canonical_name": "Tailwind", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "Tailwind CSS"},
                {"requirement_id": "REQ_STATE", "canonical_name": "Redux", "required_level": "REQUIRED", "expected_proficiency": "MIDDLE", "text": "State management with Redux or Zustand"},
            ],
        },
    ]

    cases: list[BenchmarkCase] = []
    for spec in manifest_specs:
        req_objs = []
        for r in spec.get("requirements", []):
            req_objs.append(
                BenchmarkRequirement(
                    requirement_id=str(r.get("requirement_id", "")),
                    canonical_name=str(r.get("canonical_name", "")),
                    required_level=str(r.get("required_level", "REQUIRED")),
                    expected_proficiency=str(r.get("expected_proficiency", "UNSPECIFIED")),
                    importance=float(r.get("importance", 1.0)),
                    text=str(r.get("text", "")),
                    hard_gate=bool(r.get("hard_gate", False)),
                    group_id=r.get("group_id"),
                    group_operator=r.get("group_operator"),
                    human_is_critical_gap=None,  # Intentionally null for human annotator
                    evidence_relation=None,  # Intentionally null for human annotator
                    requirement_outcome=None,  # Intentionally null for human annotator
                    expected_evidence=[],  # Intentionally empty for human annotator
                )
            )
        bg_objs = []
        for bg in spec.get("boolean_groups", []):
            bg_objs.append(
                BooleanGroupGroundTruth(
                    group_id=str(bg.get("group_id", "")),
                    operator=str(bg.get("operator", "ANY_OF")),
                    min_required=int(bg.get("min_required", 1)),
                    member_requirement_ids=list(bg.get("member_requirement_ids", [])),
                    human_group_status=None,  # Intentionally null for human annotator
                )
            )

        b_case = BenchmarkCase(
            case_id=str(spec.get("case_id", "")),
            cv_id=str(spec.get("cv_id", "")),
            jd_id=str(spec.get("jd_id", "")),
            data_origin=DataOrigin.REAL.value,
            source_dataset="real_recruitment_manifest",
            requirements=req_objs,
            boolean_groups=bg_objs,
            human_overall_score=None,  # Intentionally null for human annotator
            cv_text=str(spec.get("cv_text", "")),
            cv_parsed=dict(spec.get("cv_parsed", {})),
            jd_title=str(spec.get("jd_title", "")),
            jd_requirements=str(spec.get("jd_requirements", "")),
            domain=str(spec.get("domain", "")),
            seniority=str(spec.get("seniority", "")),
            notes="Target real case manifest for human expert annotation.",
        )
        cases.append(b_case)

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump([c.to_dict() for c in cases], f, indent=2, ensure_ascii=False)

    return cases


def load_benchmark_cases(file_path: Path | str) -> list[BenchmarkCase]:
    """Load benchmark cases from a JSON file."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Benchmark file not found at {path}")

    raw_data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw_data, list):
        raise ValueError(f"Benchmark file {path} must contain a list of cases.")

    return [BenchmarkCase.from_dict(item) for item in raw_data]


def create_golden_sample_benchmark(
    output_path: Path | str = GOLDEN_SAMPLE_PATH,
) -> list[BenchmarkCase]:
    """Create a verified sample benchmark dataset with human labels, evidence spans, and outcomes."""
    sample_cases = [
        BenchmarkCase(
            case_id="CASE_SAMPLE_001_SENIOR_BE",
            cv_id="CV_SAMPLE_BE_01",
            jd_id="JD_SAMPLE_BE_01",
            data_origin=DataOrigin.SYNTHETIC.value,
            source_dataset="sample_reference",
            jd_title="Senior Python Backend Engineer",
            jd_requirements="Yêu cầu Python, FastAPI, PostgreSQL, Docker. Ưu tiên Redis, Kafka, AWS.",
            cv_text="Senior Backend Developer với 5 năm kinh nghiệm chuyên sâu Python, FastAPI, PostgreSQL và Docker. Thiết kế microservices tích hợp Redis cache và Kafka trên AWS.",
            cv_parsed={
                "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "Kafka", "AWS"],
                "experience": [
                    {
                        "title": "Senior Backend Engineer",
                        "duration_months": 60,
                        "description": "Thiết kế kiến trúc microservices bằng Python và FastAPI, tối ưu hóa PostgreSQL, quản lý Docker trên AWS.",
                    }
                ],
                "projects": [
                    {
                        "name": "E-Commerce Microservices",
                        "description": "Xây dựng hệ thống backend chịu tải cao bằng FastAPI và PostgreSQL, kết nối Redis và Kafka.",
                    }
                ],
                "ats_quality": {"score": 92},
            },
            human_overall_score=95.0,
            domain="backend",
            seniority="senior",
            requirements=[
                BenchmarkRequirement(
                    requirement_id="REQ_PY",
                    canonical_name="Python",
                    required_level="REQUIRED",
                    expected_proficiency="SENIOR",
                    evidence_relation="DIRECT",
                    requirement_outcome="SATISFIED",
                    expected_evidence=[
                        EvidenceSpan(
                            section="experience",
                            parent_title="Senior Backend Engineer",
                            quote="5 năm kinh nghiệm chuyên sâu Python, FastAPI, PostgreSQL và Docker",
                        )
                    ],
                    importance=4.5,
                    hard_gate=True,
                    human_is_critical_gap=False,
                    text="Thành thạo Python backend",
                ),
                BenchmarkRequirement(
                    requirement_id="REQ_FASTAPI",
                    canonical_name="FastAPI",
                    required_level="REQUIRED",
                    expected_proficiency="SENIOR",
                    evidence_relation="DIRECT",
                    requirement_outcome="SATISFIED",
                    expected_evidence=[
                        EvidenceSpan(
                            section="experience",
                            parent_title="Senior Backend Engineer",
                            quote="Thiết kế kiến trúc microservices bằng Python và FastAPI",
                        )
                    ],
                    importance=4.0,
                    hard_gate=True,
                    human_is_critical_gap=False,
                    text="Kinh nghiệm chuyên sâu với FastAPI",
                ),
                BenchmarkRequirement(
                    requirement_id="REQ_PG",
                    canonical_name="PostgreSQL",
                    required_level="REQUIRED",
                    expected_proficiency="SENIOR",
                    evidence_relation="DIRECT",
                    requirement_outcome="SATISFIED",
                    expected_evidence=[
                        EvidenceSpan(
                            section="experience",
                            parent_title="Senior Backend Engineer",
                            quote="tối ưu hóa PostgreSQL",
                        )
                    ],
                    importance=3.5,
                    hard_gate=True,
                    human_is_critical_gap=False,
                    text="Thành thạo PostgreSQL",
                ),
                BenchmarkRequirement(
                    requirement_id="REQ_DOCKER",
                    canonical_name="Docker",
                    required_level="REQUIRED",
                    expected_proficiency="MIDDLE",
                    evidence_relation="DIRECT",
                    requirement_outcome="SATISFIED",
                    expected_evidence=[
                        EvidenceSpan(
                            section="experience",
                            parent_title="Senior Backend Engineer",
                            quote="quản lý Docker trên AWS",
                        )
                    ],
                    importance=3.0,
                    hard_gate=True,
                    human_is_critical_gap=False,
                    text="Kinh nghiệm Docker",
                ),
                BenchmarkRequirement(
                    requirement_id="PREF_REDIS",
                    canonical_name="Redis",
                    required_level="PREFERRED",
                    expected_proficiency="MIDDLE",
                    evidence_relation="DIRECT",
                    requirement_outcome="SATISFIED",
                    expected_evidence=[
                        EvidenceSpan(
                            section="projects",
                            parent_title="E-Commerce Microservices",
                            quote="kết nối Redis và Kafka",
                        )
                    ],
                    importance=1.0,
                    hard_gate=False,
                    human_is_critical_gap=False,
                    text="Kinh nghiệm Redis",
                ),
                BenchmarkRequirement(
                    requirement_id="REQ_K8S",
                    canonical_name="Kubernetes",
                    required_level="PREFERRED",
                    expected_proficiency="MIDDLE",
                    evidence_relation="NO_EVIDENCE",
                    requirement_outcome="UNSATISFIED",
                    expected_evidence=[],
                    importance=2.0,
                    hard_gate=False,
                    human_is_critical_gap=False,
                    text="Kinh nghiệm Kubernetes k8s",
                ),
            ],
        ),
        # Case 2: Duration gap vs Skill presence (Python exists DIRECT, but outcome UNSATISFIED due to experience duration)
        BenchmarkCase(
            case_id="CASE_SAMPLE_002_DURATION_GAP",
            cv_id="CV_SAMPLE_JR_02",
            jd_id="JD_SAMPLE_SR_02",
            data_origin=DataOrigin.REAL.value,
            source_dataset="sample_reference_real",
            jd_title="Senior Backend Developer (4+ years Python)",
            jd_requirements="Tuyển Senior Python Backend. Bắt buộc 4+ năm kinh nghiệm Python và PostgreSQL.",
            cv_text="Backend Developer với 1 năm kinh nghiệm phát triển REST API với Python và PostgreSQL.",
            cv_parsed={
                "skills": ["Python", "PostgreSQL", "REST API"],
                "experience": [
                    {
                        "title": "Junior Python Developer",
                        "duration_months": 12,
                        "description": "Lập trình backend bằng Python và PostgreSQL trong 1 năm.",
                    }
                ],
                "ats_quality": {"score": 75},
            },
            human_overall_score=40.0,
            domain="backend",
            seniority="senior",
            requirements=[
                BenchmarkRequirement(
                    requirement_id="REQ_PY_EXP",
                    canonical_name="Python Experience",
                    required_level="REQUIRED",
                    expected_proficiency="SENIOR",
                    evidence_relation="DIRECT",  # Evidence exists
                    requirement_outcome="UNSATISFIED",  # But duration is 1 yr vs 4+ yrs required
                    expected_evidence=[
                        EvidenceSpan(
                            section="experience",
                            parent_title="Junior Python Developer",
                            quote="Lập trình backend bằng Python và PostgreSQL trong 1 năm.",
                        )
                    ],
                    importance=4.5,
                    hard_gate=True,
                    human_is_critical_gap=True,
                    text="Tối thiểu 4 năm kinh nghiệm Python",
                ),
                BenchmarkRequirement(
                    requirement_id="REQ_PG",
                    canonical_name="PostgreSQL",
                    required_level="REQUIRED",
                    expected_proficiency="SENIOR",
                    evidence_relation="DIRECT",
                    requirement_outcome="SATISFIED",
                    expected_evidence=[
                        EvidenceSpan(
                            section="experience",
                            parent_title="Junior Python Developer",
                            quote="Lập trình backend bằng Python và PostgreSQL trong 1 năm.",
                        )
                    ],
                    importance=3.5,
                    hard_gate=False,
                    human_is_critical_gap=False,
                    text="Thành thạo PostgreSQL",
                ),
            ],
        ),
    ]

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump([c.to_dict() for c in sample_cases], f, indent=2, ensure_ascii=False)

    return sample_cases
