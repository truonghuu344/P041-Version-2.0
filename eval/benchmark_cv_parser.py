"""Deterministic CV parser benchmark over a frozen bilingual fixture set."""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from src.services.cv_parser import parse_cv_locally  # noqa: E402

CASES_PATH = ROOT / "eval" / "cv_parser_cases.json"
RESULT_PATH = ROOT / "eval" / "results" / "cv_parser_report.json"


def run_benchmark() -> dict:
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    total = passed = 0
    rows = []
    for case in cases:
        parsed = parse_cv_locally(case["text"])
        checks = {
            "name": parsed["personal_info"]["full_name"] == case["name"],
            "email": parsed["personal_info"]["email"] == case["email"],
            "phone": parsed["personal_info"]["phone"] == case["phone"],
            "skills": set(case["skills"]).issubset(parsed["skills"]),
            "sections": all(bool(parsed[section]) for section in case["sections"]),
        }
        total += len(checks)
        passed += sum(checks.values())
        rows.append({"id": case["id"], "checks": checks, "passed": all(checks.values())})

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "dataset": "frozen synthetic bilingual fixtures",
        "sample_count": len(cases),
        "assertion_count": total,
        "passed_assertions": passed,
        "accuracy_percent": round(100 * passed / total, 2),
        "limitations": "Synthetic fixtures validate regressions only; a labeled real-CV set is required for a production accuracy claim.",
        "cases": rows,
    }
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    result = run_benchmark()
    print(json.dumps(result, ensure_ascii=False, indent=2))
