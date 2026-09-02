"""Builder for REAL V1 CV-JD Benchmark Datasets using existing project data."""

from __future__ import annotations

import csv
import json
import logging
import re
from collections import Counter
from pathlib import Path
from typing import Any

from src.services.cv_jd_matching import parse_job_description

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
CVS_CSV_PATH = ROOT / "data" / "clean" / "cvs_clean.csv"
JDS_JSON_PATH = ROOT / "data" / "clean" / "jds_clean.json"

CV_SOURCES_OUT = ROOT / "eval" / "datasets" / "real_cv_sources_v1.json"
JD_SOURCES_OUT = ROOT / "eval" / "datasets" / "real_jd_sources_v1.json"
MANIFEST_OUT = ROOT / "eval" / "datasets" / "real_benchmark_v1_manifest.json"
ANNOTATION_WORKSPACE_OUT = ROOT / "eval" / "datasets" / "real_benchmark_v1_annotation.json"
GOLD_EXPORT_OUT = ROOT / "eval" / "datasets" / "real_benchmark_v1_gold.json"


def _clean_pii(text: str) -> str:
    """Mask unnecessary PII like phone numbers and personal emails while preserving skill text."""
    # Mask emails
    text = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[EMAIL_REDACTED]", text)
    # Mask 10-11 digit phone numbers
    text = re.sub(r"(?:\+84|0)\s*(?:[0-9]\s*){9,10}", "[PHONE_REDACTED]", text)
    return text


def load_and_validate_source_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """Load and validate all 560 real CVs and 91 real JDs."""
    if not CVS_CSV_PATH.exists():
        raise FileNotFoundError(f"CV source file not found at {CVS_CSV_PATH}")
    if not JDS_JSON_PATH.exists():
        raise FileNotFoundError(f"JD source file not found at {JDS_JSON_PATH}")

    # 1. Load CVs
    with open(CVS_CSV_PATH, encoding="utf-8", errors="replace") as f:
        cv_rows = list(csv.DictReader(f))

    # 2. Load JDs
    with open(JDS_JSON_PATH, encoding="utf-8") as f:
        jd_rows = json.load(f)

    # Validation & statistics
    vn_regex = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.IGNORECASE)

    cv_stats = {
        "total_loaded": len(cv_rows),
        "valid_count": 0,
        "excluded_count": 0,
        "categories": dict(Counter(r.get("category") for r in cv_rows)),
        "languages": dict(Counter("VI" if vn_regex.search(r.get("full_text", "")) else "EN" for r in cv_rows)),
        "avg_length": sum(len(r.get("full_text", "")) for r in cv_rows) / max(1, len(cv_rows)),
    }

    valid_cvs: list[dict[str, Any]] = []
    for r in cv_rows:
        raw_id = r.get("cv_id") or r.get("\ufeffcv_id") or ""
        full_text = str(r.get("full_text", "")).strip()
        if not raw_id or not full_text or len(full_text) < 50:
            cv_stats["excluded_count"] += 1
            continue
        valid_cvs.append({
            "cv_id": raw_id,
            "candidate_name": r.get("candidate_name", "Anonymous Candidate"),
            "category": r.get("category", "INFORMATION-TECHNOLOGY"),
            "target_role": r.get("target_role", ""),
            "skills": [s.strip() for s in str(r.get("skills", "")).split(",") if s.strip()],
            "summary": r.get("summary", ""),
            "full_text": full_text,
            "language": "VI" if vn_regex.search(full_text) else "EN",
            "source": r.get("source", "Kaggle/GitHub Resume.csv"),
        })
    cv_stats["valid_count"] = len(valid_cvs)

    jd_stats = {
        "total_loaded": len(jd_rows),
        "valid_count": 0,
        "excluded_count": 0,
        "domains": dict(Counter(j.get("domain_category") or "Unknown" for j in jd_rows)),
        "languages": dict(Counter("VI" if vn_regex.search(str(j.get("clean_description", "")) + str(j.get("requirements", ""))) else "EN" for j in jd_rows)),
        "avg_length": sum(len(j.get("clean_description") or str(j.get("requirements", ""))) for j in jd_rows) / max(1, len(jd_rows)),
    }

    valid_jds: list[dict[str, Any]] = []
    for j in jd_rows:
        jid = str(j.get("job_id", "")).strip()
        title = str(j.get("job_title", "")).strip()
        reqs = j.get("requirements", [])
        req_text = "\n".join(reqs) if isinstance(reqs, list) else str(reqs)
        full_desc = str(j.get("clean_description") or req_text).strip()

        if not jid or not title or not full_desc:
            jd_stats["excluded_count"] += 1
            continue

        # Parse proposed requirements via production parser (proposal only)
        parsed = parse_job_description(title=title, requirements_text=req_text or full_desc, metadata=j)

        proposed_reqs = []
        for r in parsed.get("requirements", []):
            proposed_reqs.append({
                "requirement_id": r.get("requirement_id"),
                "canonical_name": r.get("canonical_name") or r.get("normalized_value") or r.get("text"),
                "source_sentence": r.get("source_sentence") or r.get("text"),
                "required_level": "REQUIRED" if str(r.get("type", "REQUIRED")).upper() in {"REQUIRED", "MANDATORY"} else "PREFERRED",
                "expected_proficiency": str(j.get("job_level") or "UNSPECIFIED").upper(),
                "importance": float(r.get("importance", 1.0)),
                "hard_gate": bool(r.get("mandatory", False)),
                "group_id": r.get("group_id"),
                "group_operator": r.get("group_operator"),
                "min_required": r.get("min_required", 1),
            })

        valid_jds.append({
            "jd_id": jid,
            "job_title": title,
            "company_name": j.get("company_name", "Unknown Company"),
            "domain_category": j.get("domain_category", "Backend"),
            "job_level": j.get("job_level", "Not Specified"),
            "location": j.get("location", []),
            "skills": j.get("skills", []),
            "requirements_text": req_text,
            "responsibilities": j.get("responsibilities", []),
            "clean_description": full_desc,
            "language": "VI" if vn_regex.search(full_desc) else "EN",
            "proposed_requirements": proposed_reqs,
            "source": j.get("source", "Market Scraped"),
            "source_url": j.get("source_url", ""),
        })
    jd_stats["valid_count"] = len(valid_jds)

    stats = {"cv_stats": cv_stats, "jd_stats": jd_stats}
    return valid_cvs, valid_jds, stats


def build_canonical_sources() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Create and persist stable canonical source datasets."""
    cvs, jds, stats = load_and_validate_source_data()

    CV_SOURCES_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(CV_SOURCES_OUT, "w", encoding="utf-8") as f:
        json.dump(cvs, f, indent=2, ensure_ascii=False)

    with open(JD_SOURCES_OUT, "w", encoding="utf-8") as f:
        json.dump(jds, f, indent=2, ensure_ascii=False)

    logger.info("Saved %d CV sources and %d JD sources.", len(cvs), len(jds))
    return cvs, jds


def select_benchmark_pairs(cvs: list[dict[str, Any]], jds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Select exactly 80 representative CV-JD benchmark pairs across the 5 sampling strata.

    Target distribution:
    - 20 strong-match candidates
    - 20 medium-match candidates
    - 15 weak-match candidates
    - 15 clear mismatches (cross-domain negatives)
    - 10 semantic / edge cases
    """
    it_cvs = [c for c in cvs if c["category"] == "INFORMATION-TECHNOLOGY"]
    non_it_cvs = [c for c in cvs if c["category"] != "INFORMATION-TECHNOLOGY"]

    # Index JDs by domain
    jds_by_domain: dict[str, list[dict[str, Any]]] = {}
    for j in jds:
        d = j["domain_category"]
        jds_by_domain.setdefault(d, []).append(j)

    backend_jds = jds_by_domain.get("Backend", [])
    frontend_jds = jds_by_domain.get("Frontend", [])
    ai_data_jds = jds_by_domain.get("AI/Data", [])
    qa_jds = jds_by_domain.get("QA/QC", [])
    devops_jds = jds_by_domain.get("DevOps", [])
    mobile_jds = jds_by_domain.get("Mobile", [])

    # Index CVs by keywords
    def _find_cvs(keywords: list[str], pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
        matches = []
        for c in pool:
            txt = (c["full_text"] + " " + " ".join(c.get("skills", []))).lower()
            if any(k.lower() in txt for k in keywords):
                matches.append(c)
        return matches

    py_be_cvs = _find_cvs(["python", "fastapi", "django", "flask", "postgresql"], it_cvs)
    java_cvs = _find_cvs(["java", "spring", "spring boot"], it_cvs)
    fe_react_cvs = _find_cvs(["react", "javascript", "typescript", "vue", "html", "css"], it_cvs)
    ai_ml_cvs = _find_cvs(["machine learning", "deep learning", "pytorch", "tensorflow", "nlp", "ai"], it_cvs)
    data_cvs = _find_cvs(["spark", "hadoop", "sql", "airflow", "data pipeline", "etl", "bigquery"], it_cvs)
    devops_cvs = _find_cvs(["docker", "kubernetes", "aws", "terraform", "ci/cd", "jenkins"], it_cvs)
    qa_cvs = _find_cvs(["selenium", "automation", "test case", "qa", "testing", "playwright"], it_cvs)
    mobile_cvs = _find_cvs(["flutter", "react native", "android", "ios", "swift", "kotlin"], it_cvs)

    def _safe_get(pool: list[dict[str, Any]], idx: int, fallback: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        if pool and 0 <= idx < len(pool):
            return pool[idx]
        if pool:
            return pool[idx % len(pool)]
        if fallback and fallback:
            return fallback[idx % len(fallback)]
        return cvs[idx % len(cvs)]

    def _safe_jd(pool: list[dict[str, Any]], idx: int) -> dict[str, Any]:
        if pool and 0 <= idx < len(pool):
            return pool[idx]
        if pool:
            return pool[idx % len(pool)]
        return jds[idx % len(jds)]

    # 1. STRONG_CANDIDATE (Target: 20 pairs)
    strong_pairs: list[dict[str, Any]] = []
    # Backend (5)
    for i in range(5):
        strong_pairs.append({
            "cv": _safe_get(py_be_cvs + java_cvs, i, it_cvs),
            "jd": _safe_jd(backend_jds, i),
            "stratum": "STRONG_CANDIDATE",
            "reason": "Direct backend match: Python/Java developer with core database and REST API stack.",
        })
    # Frontend (5)
    for i in range(5):
        strong_pairs.append({
            "cv": _safe_get(fe_react_cvs, i, it_cvs),
            "jd": _safe_jd(frontend_jds, i),
            "stratum": "STRONG_CANDIDATE",
            "reason": "Direct frontend match: React/TypeScript developer matching modern web UI requirements.",
        })
    # AI/Data (4)
    for i in range(4):
        strong_pairs.append({
            "cv": _safe_get(ai_ml_cvs + data_cvs, i, it_cvs),
            "jd": _safe_jd(ai_data_jds, i),
            "stratum": "STRONG_CANDIDATE",
            "reason": "Direct AI/Data match: Machine learning / ETL pipeline developer matching data engineering role.",
        })
    # DevOps (3)
    for i in range(3):
        strong_pairs.append({
            "cv": _safe_get(devops_cvs, i, it_cvs),
            "jd": _safe_jd(devops_jds, i),
            "stratum": "STRONG_CANDIDATE",
            "reason": "Direct DevOps match: Cloud engineer matching Docker, Kubernetes, CI/CD infrastructure requirements.",
        })
    # QA (3)
    for i in range(3):
        strong_pairs.append({
            "cv": _safe_get(qa_cvs, i, it_cvs),
            "jd": _safe_jd(qa_jds, i),
            "stratum": "STRONG_CANDIDATE",
            "reason": "Direct QA match: Test automation engineer matching Selenium, API testing specifications.",
        })

    # 2. MEDIUM_CANDIDATE (Target: 20 pairs) - Partial stack or level differences
    medium_pairs: list[dict[str, Any]] = []
    for i in range(5):
        medium_pairs.append({
            "cv": _safe_get(py_be_cvs, i + 5, it_cvs),
            "jd": _safe_jd(frontend_jds, i),
            "stratum": "MEDIUM_CANDIDATE",
            "reason": "Partial stack: Backend developer applying for Fullstack/Frontend role.",
        })
    for i in range(5):
        medium_pairs.append({
            "cv": _safe_get(fe_react_cvs, i + 5, it_cvs),
            "jd": _safe_jd(backend_jds, i),
            "stratum": "MEDIUM_CANDIDATE",
            "reason": "Partial stack: Frontend developer with JavaScript applying for Backend/Node.js context.",
        })
    for i in range(4):
        medium_pairs.append({
            "cv": _safe_get(data_cvs, i + 4, it_cvs),
            "jd": _safe_jd(backend_jds, i + 2),
            "stratum": "MEDIUM_CANDIDATE",
            "reason": "Adjacent role: Data engineer with SQL/ETL applying for Backend developer.",
        })
    for i in range(3):
        medium_pairs.append({
            "cv": _safe_get(ai_ml_cvs, i + 4, it_cvs),
            "jd": _safe_jd(devops_jds, i),
            "stratum": "MEDIUM_CANDIDATE",
            "reason": "Transferable tools: Python AI engineer with Docker knowledge applying for DevOps.",
        })
    for i in range(3):
        medium_pairs.append({
            "cv": _safe_get(mobile_cvs, i, it_cvs),
            "jd": _safe_jd(mobile_jds or frontend_jds, i),
            "stratum": "MEDIUM_CANDIDATE",
            "reason": "Mobile developer matching cross-platform mobile / UI requirements.",
        })

    # 3. WEAK_CANDIDATE (Target: 15 pairs) - Transferable skills only
    weak_pairs: list[dict[str, Any]] = []
    designer_cvs = [c for c in non_it_cvs if c["category"] == "DESIGNER"]
    engineering_cvs = [c for c in non_it_cvs if c["category"] == "ENGINEERING"]

    for i in range(5):
        weak_pairs.append({
            "cv": _safe_get(designer_cvs, i, non_it_cvs),
            "jd": _safe_jd(frontend_jds, i),
            "stratum": "WEAK_CANDIDATE",
            "reason": "Transferable: UI/UX Designer with basic HTML/CSS applying for Frontend Engineer.",
        })
    for i in range(5):
        weak_pairs.append({
            "cv": _safe_get(engineering_cvs, i, non_it_cvs),
            "jd": _safe_jd(backend_jds, i),
            "stratum": "WEAK_CANDIDATE",
            "reason": "Transferable: Mechanical/Hardware engineer with basic C/C++ applying for Backend Engineer.",
        })
    for i in range(5):
        weak_pairs.append({
            "cv": _safe_get(qa_cvs, i + 5, it_cvs),
            "jd": _safe_jd(ai_data_jds, i),
            "stratum": "WEAK_CANDIDATE",
            "reason": "Weak match: QA Manual tester applying for Data/AI Engineer.",
        })

    # 4. NEGATIVE_CANDIDATE (Target: 15 pairs) - Clear cross-domain mismatch
    negative_pairs: list[dict[str, Any]] = []
    biz_cvs = [c for c in non_it_cvs if c["category"] == "BUSINESS-DEVELOPMENT"]
    media_cvs = [c for c in non_it_cvs if c["category"] == "DIGITAL-MEDIA"]

    for i in range(5):
        negative_pairs.append({
            "cv": _safe_get(biz_cvs, i, non_it_cvs),
            "jd": _safe_jd(backend_jds, i),
            "stratum": "NEGATIVE_CANDIDATE",
            "reason": "Cross-domain negative: Business Development candidate applying for Backend Engineer.",
        })
    for i in range(5):
        negative_pairs.append({
            "cv": _safe_get(media_cvs, i, non_it_cvs),
            "jd": _safe_jd(ai_data_jds, i),
            "stratum": "NEGATIVE_CANDIDATE",
            "reason": "Cross-domain negative: Digital Media candidate applying for AI/ML Engineer.",
        })
    for i in range(5):
        negative_pairs.append({
            "cv": _safe_get(designer_cvs, i + 5, non_it_cvs),
            "jd": _safe_jd(devops_jds, i),
            "stratum": "NEGATIVE_CANDIDATE",
            "reason": "Cross-domain negative: Graphic Designer applying for DevOps Cloud Engineer.",
        })

    # 5. EDGE_CASE (Target: 10 pairs) - Hard semantic cases
    edge_pairs: list[dict[str, Any]] = []
    vn_jds = [j for j in jds if j["language"] == "VI"]

    edge_definitions = [
        ("Alias/Equivalent: Candidate uses 'Amazon Web Services' / 'Postgres' vs JD 'AWS' / 'PostgreSQL'.", it_cvs, backend_jds),
        ("Alias/Equivalent: Candidate uses 'ReactJS' / 'NextJS' vs JD 'React' / 'Next.js'.", it_cvs, frontend_jds),
        ("Semantic Inferred: Candidate mentions building semantic search pipeline vs JD 'RAG'.", it_cvs, ai_data_jds),
        ("Adjacent skill: Candidate has MySQL knowledge vs JD requiring PostgreSQL.", it_cvs, backend_jds),
        ("Duration gap: Candidate has matching stack but 1 yr experience vs senior requirement.", it_cvs, backend_jds),
        ("Skills-only: Skill listed in summary but without project backing.", it_cvs, frontend_jds),
        ("Bilingual match: Vietnamese Job Description matched against English CV.", it_cvs, vn_jds or jds),
        ("Bilingual match: Vietnamese Job Description with technical terms vs English CV.", it_cvs, vn_jds or jds),
        ("Boolean Group ANY_OF: Alternative database choice between PostgreSQL and MySQL.", it_cvs, backend_jds),
        ("Hard gate test: Mandatory cloud certification / seniority blocker.", it_cvs, devops_jds),
    ]

    for idx, (reason_desc, cv_sub, jd_sub) in enumerate(edge_definitions):
        edge_pairs.append({
            "cv": _safe_get(cv_sub, idx + 10, it_cvs),
            "jd": _safe_jd(jd_sub, idx),
            "stratum": "EDGE_CASE",
            "reason": reason_desc,
        })

    # Assemble all 80 pairs
    all_staged = strong_pairs[:20] + medium_pairs[:20] + weak_pairs[:15] + negative_pairs[:15] + edge_pairs[:10]

    selected_pairs: list[dict[str, Any]] = []
    for item in all_staged:
        cv_obj = item["cv"]
        jd_obj = item["jd"]
        selected_pairs.append({
            "case_id": f"CASE_{jd_obj['jd_id']}_{cv_obj['cv_id']}",
            "cv_id": cv_obj["cv_id"],
            "jd_id": jd_obj["jd_id"],
            "cv_category": cv_obj["category"],
            "jd_domain": jd_obj["domain_category"],
            "sampling_stratum": item["stratum"],
            "sampling_reason": item["reason"],
            "cv_obj": cv_obj,
            "jd_obj": jd_obj,
        })

    return selected_pairs


def build_annotation_workspace(
    selected_pairs: list[dict[str, Any]],
    backend_test_text: str = "",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Generate the pair manifest and human annotation workspace files."""
    manifest_records: list[dict[str, Any]] = []
    annotation_cases: list[dict[str, Any]] = []

    for pair in selected_pairs:
        cid = pair["cv_id"]
        jid = pair["jd_id"]
        cv = pair["cv_obj"]
        jd = pair["jd_obj"]
        stratum = pair["sampling_stratum"]
        reason = pair["sampling_reason"]

        # Check leakage
        has_leakage = (jid in backend_test_text) or (cid in backend_test_text)

        manifest_records.append({
            "case_id": pair["case_id"],
            "cv_id": cid,
            "jd_id": jid,
            "cv_category": cv["category"],
            "jd_domain": jd["domain_category"],
            "sampling_stratum": stratum,
            "sampling_reason": reason,
            "possible_test_leakage": has_leakage,
        })

        # Format unannotated requirements workspace
        req_workspace = []
        for pr in jd.get("proposed_requirements", []):
            req_workspace.append({
                "requirement_id": pr["requirement_id"],
                "canonical_name": pr["canonical_name"],
                "source_sentence": pr["source_sentence"],
                "review_status": "PENDING",  # PENDING | APPROVED | EDITED | REJECTED
                "required_level": None,  # REQUIRED | PREFERRED (null for human reviewer)
                "expected_proficiency": None,  # JUNIOR | MIDDLE | SENIOR | EXPERT | UNSPECIFIED (null for human reviewer)
                "hard_gate": None,  # True | False (null for human reviewer)
                "importance": pr["importance"],
                "group_id": pr.get("group_id"),
                "group_operator": pr.get("group_operator"),
                "min_required": pr.get("min_required", 1),
                "evidence_relation": None,  # DIRECT | EQUIVALENT | INFERRED | ADJACENT | WEAK_EVIDENCE | NO_EVIDENCE
                "requirement_outcome": None,  # SATISFIED | PARTIAL | UNSATISFIED | UNKNOWN
                "expected_evidence": [],  # list of {section, parent_title, quote, start_offset, end_offset}
                "human_is_critical_gap": None,  # True | False
                "notes": None,
                "annotations": [],
                "adjudicated": False,
            })

        # Boolean groups
        bg_workspace = []
        seen_grps = set()
        for pr in jd.get("proposed_requirements", []):
            gid = pr.get("group_id")
            if gid and gid not in seen_grps:
                seen_grps.add(gid)
                members = [r["requirement_id"] for r in jd.get("proposed_requirements", []) if r.get("group_id") == gid]
                bg_workspace.append({
                    "group_id": gid,
                    "operator": pr.get("group_operator", "ANY_OF"),
                    "min_required": pr.get("min_required", 1),
                    "member_requirement_ids": members,
                    "human_group_status": None,  # SATISFIED | PARTIAL | UNSATISFIED
                    "expected_satisfied_by": [],
                    "review_status": "PENDING",
                    "notes": None,
                })

        annotation_cases.append({
            "case_id": pair["case_id"],
            "cv_id": cid,
            "jd_id": jid,
            "domain": jd["domain_category"],
            "data_origin": "REAL",
            "source_dataset": "vietnam_tech_recruitment_2026",
            "possible_test_leakage": has_leakage,
            "cv_text": _clean_pii(cv["full_text"]),
            "cv_parsed": {
                "candidate_name": _clean_pii(cv.get("candidate_name", "")),
                "category": cv.get("category", ""),
                "target_role": cv.get("target_role", ""),
                "skills": cv.get("skills", []),
                "summary": _clean_pii(cv.get("summary", "")),
            },
            "jd_title": jd["job_title"],
            "jd_requirements": jd["requirements_text"],
            "jd_full_description": jd["clean_description"],
            "proposed_requirements": req_workspace,
            "boolean_groups": bg_workspace,
            "human_overall_score": None,  # 0..100 canonical scale (null for human reviewer)
            "human_review_status": "PENDING",  # PENDING | IN_PROGRESS | COMPLETED
            "adjudicated": False,
            "notes": None,
        })

    # Save to disk
    MANIFEST_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_OUT, "w", encoding="utf-8") as f:
        json.dump(manifest_records, f, indent=2, ensure_ascii=False)

    with open(ANNOTATION_WORKSPACE_OUT, "w", encoding="utf-8") as f:
        json.dump(annotation_cases, f, indent=2, ensure_ascii=False)

    logger.info("Saved %d pairs in manifest and annotation workspace.", len(annotation_cases))
    return manifest_records, annotation_cases


def generate_real_v1_benchmark() -> dict[str, Any]:
    """Execute complete real-world V1 benchmark preparation pipeline."""
    cvs, jds, stats = load_and_validate_source_data()

    CV_SOURCES_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(CV_SOURCES_OUT, "w", encoding="utf-8") as f:
        json.dump(cvs, f, indent=2, ensure_ascii=False)

    with open(JD_SOURCES_OUT, "w", encoding="utf-8") as f:
        json.dump(jds, f, indent=2, ensure_ascii=False)

    # Read backend tests to check test leakage
    backend_test_text = ""
    for tf in (ROOT / "backend" / "tests").rglob("*.py"):
        backend_test_text += tf.read_text(encoding="utf-8", errors="ignore") + "\n"

    pairs = select_benchmark_pairs(cvs, jds)
    manifest, annotation_cases = build_annotation_workspace(pairs, backend_test_text)

    # Compute stratum breakdown
    strata_counts = Counter(m["sampling_stratum"] for m in manifest)
    domain_counts = Counter(m["jd_domain"] for m in manifest)
    category_counts = Counter(m["cv_category"] for m in manifest)
    leakage_count = sum(1 for m in manifest if m["possible_test_leakage"])

    return {
        "cv_stats": stats["cv_stats"],
        "jd_stats": stats["jd_stats"],
        "selected_pair_count": len(manifest),
        "strata_distribution": dict(strata_counts),
        "domain_distribution": dict(domain_counts),
        "cv_category_distribution": dict(category_counts),
        "leakage_count": leakage_count,
        "files_created": [
            str(CV_SOURCES_OUT),
            str(JD_SOURCES_OUT),
            str(MANIFEST_OUT),
            str(ANNOTATION_WORKSPACE_OUT),
        ],
    }
