"""Annotation workspace manager and gold dataset exporter."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from eval.v1_eval.schema import (
    BenchmarkCase,
    BenchmarkRequirement,
    BooleanGroupGroundTruth,
    EvidenceSpan,
)

logger = logging.getLogger(__name__)


def get_annotation_status(annotation_json_path: Path | str) -> dict[str, Any]:
    """Inspect and report the human annotation progress of a benchmark workspace."""
    p = Path(annotation_json_path)
    if not p.exists():
        raise FileNotFoundError(f"Annotation workspace file not found at {p}")

    cases = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(cases, list):
        raise ValueError(f"Annotation file {p} must be a JSON list of cases.")

    total_pairs = len(cases)
    total_requirements = 0
    requirements_reviewed = 0
    requirements_pending = 0

    total_boolean_groups = 0
    boolean_groups_reviewed = 0
    boolean_groups_pending = 0

    cases_fully_annotated = 0
    cases_adjudicated = 0
    cases_ready_for_gold = 0

    for c in cases:
        reqs = c.get("proposed_requirements", []) or c.get("requirements", [])
        total_requirements += len(reqs)

        case_reqs_reviewed = 0
        for r in reqs:
            is_rev = (
                r.get("review_status") not in {None, "PENDING"}
                or r.get("evidence_relation") is not None
                or r.get("requirement_outcome") is not None
            )
            if is_rev:
                requirements_reviewed += 1
                case_reqs_reviewed += 1
            else:
                requirements_pending += 1

        bgs = c.get("boolean_groups", [])
        total_boolean_groups += len(bgs)
        for bg in bgs:
            if bg.get("human_group_status") is not None or bg.get("review_status") not in {None, "PENDING"}:
                boolean_groups_reviewed += 1
            else:
                boolean_groups_pending += 1

        is_adjudicated = bool(c.get("adjudicated", False))
        if is_adjudicated:
            cases_adjudicated += 1

        is_fully_annotated = (case_reqs_reviewed == len(reqs) and len(reqs) > 0)
        if is_fully_annotated:
            cases_fully_annotated += 1

        if is_fully_annotated and (is_adjudicated or c.get("human_review_status") == "COMPLETED") and c.get("human_overall_score") is not None:
            cases_ready_for_gold += 1

    return {
        "dataset_path": str(p),
        "selected_pairs": total_pairs,
        "requirements_total": total_requirements,
        "requirements_reviewed": requirements_reviewed,
        "requirements_pending": requirements_pending,
        "requirements_completion_pct": round((requirements_reviewed / max(1, total_requirements)) * 100, 2),
        "boolean_groups_total": total_boolean_groups,
        "boolean_groups_reviewed": boolean_groups_reviewed,
        "boolean_groups_pending": boolean_groups_pending,
        "cases_fully_annotated": cases_fully_annotated,
        "cases_adjudicated": cases_adjudicated,
        "cases_ready_for_gold": cases_ready_for_gold,
    }


def export_gold_benchmark(
    annotation_json_path: Path | str,
    gold_output_path: Path | str,
) -> list[BenchmarkCase]:
    """Export only reviewed, validated, and adjudicated cases to a gold benchmark dataset."""
    p = Path(annotation_json_path)
    if not p.exists():
        raise FileNotFoundError(f"Annotation file not found at {p}")

    cases_data = json.loads(p.read_text(encoding="utf-8"))
    gold_cases: list[BenchmarkCase] = []
    excluded_cases: list[str] = []

    for c in cases_data:
        case_id = c.get("case_id", "")
        # Inclusion criteria:
        # 1. adjudicated == True or human_review_status == "COMPLETED"
        # 2. Has human_overall_score
        # 3. All non-rejected requirements have evidence_relation and requirement_outcome
        is_ready = bool(c.get("adjudicated", False)) or c.get("human_review_status") == "COMPLETED"
        if not is_ready:
            excluded_cases.append(f"{case_id} (not adjudicated or completed)")
            continue

        if c.get("human_overall_score") is None and c.get("human_overall_rating") is None:
            excluded_cases.append(f"{case_id} (missing human overall score)")
            continue

        raw_reqs = c.get("proposed_requirements", []) or c.get("requirements", [])
        gold_reqs: list[BenchmarkRequirement] = []
        has_incomplete_req = False

        for r in raw_reqs:
            if r.get("review_status") == "REJECTED":
                continue

            ev_rel = r.get("evidence_relation") or r.get("human_label")
            req_out = r.get("requirement_outcome")

            if not ev_rel or not req_out:
                has_incomplete_req = True
                break

            spans = []
            for s in r.get("expected_evidence", []):
                if isinstance(s, dict):
                    spans.append(EvidenceSpan.from_dict(s))
                elif isinstance(s, EvidenceSpan):
                    spans.append(s)

            gold_reqs.append(
                BenchmarkRequirement(
                    requirement_id=str(r.get("requirement_id", "")),
                    canonical_name=str(r.get("canonical_name", "")),
                    required_level=str(r.get("required_level", "REQUIRED")),
                    expected_proficiency=str(r.get("expected_proficiency", "UNSPECIFIED")),
                    importance=float(r.get("importance", 1.0)),
                    text=str(r.get("source_sentence") or r.get("text", "")),
                    hard_gate=bool(r.get("hard_gate", False)),
                    human_is_critical_gap=r.get("human_is_critical_gap"),
                    group_id=r.get("group_id"),
                    group_operator=r.get("group_operator"),
                    evidence_relation=ev_rel,
                    requirement_outcome=req_out,
                    expected_evidence=spans,
                    adjudicated=True,
                    notes=str(r.get("notes") or ""),
                )
            )

        if has_incomplete_req or not gold_reqs:
            excluded_cases.append(f"{case_id} (incomplete requirement labels)")
            continue

        # Process Boolean groups
        gold_bgs: list[BooleanGroupGroundTruth] = []
        for bg in c.get("boolean_groups", []):
            if bg.get("human_group_status"):
                gold_bgs.append(
                    BooleanGroupGroundTruth(
                        group_id=str(bg.get("group_id", "")),
                        operator=str(bg.get("operator", "ANY_OF")),
                        min_required=int(bg.get("min_required", 1)),
                        member_requirement_ids=list(bg.get("member_requirement_ids", [])),
                        human_group_status=bg.get("human_group_status"),
                        expected_satisfied_by=list(bg.get("expected_satisfied_by", [])),
                        notes=str(bg.get("notes") or ""),
                    )
                )

        b_case = BenchmarkCase(
            case_id=case_id,
            cv_id=str(c.get("cv_id", "")),
            jd_id=str(c.get("jd_id", "")),
            data_origin="REAL",
            source_dataset=str(c.get("source_dataset", "real_annotated")),
            requirements=gold_reqs,
            boolean_groups=gold_bgs,
            human_overall_score=c.get("human_overall_score"),
            human_overall_rating=c.get("human_overall_rating"),
            cv_text=str(c.get("cv_text", "")),
            cv_parsed=dict(c.get("cv_parsed", {})),
            jd_title=str(c.get("jd_title", "")),
            jd_requirements=str(c.get("jd_requirements", "")),
            domain=str(c.get("domain", "")),
            seniority=str(c.get("seniority", "")),
            notes=str(c.get("notes") or "Gold adjudicated benchmark case."),
        )
        gold_cases.append(b_case)

    # Save to gold output path
    out_p = Path(gold_output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with open(out_p, "w", encoding="utf-8") as f:
        json.dump([gc.to_dict() for gc in gold_cases], f, indent=2, ensure_ascii=False)

    logger.info("Exported %d gold benchmark cases to %s (%d excluded as pending).", len(gold_cases), out_p, len(excluded_cases))
    return gold_cases


def get_jd_annotation_status(jd_annotation_path: Path | str) -> dict[str, Any]:
    """Inspect and report the status of Layer A JD requirement annotations."""
    p = Path(jd_annotation_path)
    if not p.exists():
        raise FileNotFoundError(f"JD annotation workspace file not found at {p}")

    jds = json.loads(p.read_text(encoding="utf-8"))
    total_jds = len(jds)
    completed_jds = 0
    adjudicated_jds = 0

    total_proposed_reqs = 0
    total_reviewed_gold_reqs = 0
    total_reviewed_gold_groups = 0

    for jd in jds:
        total_proposed_reqs += len(jd.get("proposed_requirements", []))
        rev_reqs = jd.get("reviewed_requirements", [])
        total_reviewed_gold_reqs += len(rev_reqs)
        total_reviewed_gold_groups += len(jd.get("reviewed_boolean_groups", []))

        is_completed = jd.get("review_status") == "COMPLETED" or len(rev_reqs) > 0
        if is_completed:
            completed_jds += 1
        if bool(jd.get("adjudicated", False)):
            adjudicated_jds += 1

    return {
        "dataset_path": str(p),
        "total_unique_jds": total_jds,
        "completed_jds": completed_jds,
        "adjudicated_jds": adjudicated_jds,
        "completion_pct": round((completed_jds / max(1, total_jds)) * 100, 2),
        "total_proposed_requirements": total_proposed_reqs,
        "total_reviewed_gold_requirements": total_reviewed_gold_reqs,
        "total_reviewed_gold_boolean_groups": total_reviewed_gold_groups,
    }


def resolve_git_metadata() -> tuple[str | None, bool]:
    """Resolve the real Git commit SHA and working tree dirty status."""
    import subprocess
    git_sha = None
    git_dirty = False
    try:
        res = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
        git_sha = res.stdout.strip() or None
    except Exception:
        git_sha = None

    try:
        res_status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
        git_dirty = bool(res_status.stdout.strip())
    except Exception:
        git_dirty = False

    return git_sha, git_dirty


def compute_parser_config_hash(config: dict[str, Any]) -> str:
    """Compute deterministic SHA256 hash for parser configuration."""
    import hashlib
    raw = json.dumps(config, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def allocate_next_gold_req_id(
    jd_data_or_id: dict[str, Any] | str,
    existing_ids: list[str] | None = None,
) -> str:
    """Allocate a strictly monotonic, immutable gold requirement ID from persistent counter."""
    if isinstance(jd_data_or_id, dict):
        jd_data = jd_data_or_id
        jid = str(jd_data.get("jd_id", "")).replace("-", "").upper()
        current_counter = int(jd_data.get("next_gold_requirement_index", 1))

        existing_req_ids = [r.get("gold_requirement_id", "") for r in jd_data.get("reviewed_requirements", [])]
        tombstoned_req_ids = list(jd_data.get("tombstoned_requirement_ids", []))
        all_ids = existing_req_ids + tombstoned_req_ids

        pattern = re.compile(rf"^GOLD_{re.escape(jid)}_REQ_(\d+)$")
        for eid in all_ids:
            m = pattern.match(eid.strip())
            if m:
                current_counter = max(current_counter, int(m.group(1)) + 1)

        allocated_id = f"GOLD_{jid}_REQ_{current_counter:03d}"
        jd_data["next_gold_requirement_index"] = current_counter + 1
        return allocated_id

    # Fallback for string ID and list
    jid = jd_data_or_id.replace("-", "").upper()
    prefix = f"GOLD_{jid}_REQ_"
    max_idx = 0
    pattern = re.compile(rf"^GOLD_{re.escape(jid)}_REQ_(\d+)$")
    for eid in (existing_ids or []):
        m = pattern.match(eid.strip())
        if m:
            max_idx = max(max_idx, int(m.group(1)))
    return f"{prefix}{max_idx + 1:03d}"


def allocate_next_gold_grp_id(
    jd_data_or_id: dict[str, Any] | str,
    existing_ids: list[str] | None = None,
) -> str:
    """Allocate a strictly monotonic, immutable gold boolean group ID from persistent counter."""
    if isinstance(jd_data_or_id, dict):
        jd_data = jd_data_or_id
        jid = str(jd_data.get("jd_id", "")).replace("-", "").upper()
        current_counter = int(jd_data.get("next_gold_group_index", 1))

        existing_grp_ids = [g.get("gold_group_id", "") for g in jd_data.get("reviewed_boolean_groups", [])]
        tombstoned_grp_ids = list(jd_data.get("tombstoned_group_ids", []))
        all_ids = existing_grp_ids + tombstoned_grp_ids

        pattern = re.compile(rf"^GOLD_{re.escape(jid)}_GRP_(\d+)$")
        for eid in all_ids:
            m = pattern.match(eid.strip())
            if m:
                current_counter = max(current_counter, int(m.group(1)) + 1)

        allocated_id = f"GOLD_{jid}_GRP_{current_counter:03d}"
        jd_data["next_gold_group_index"] = current_counter + 1
        return allocated_id

    jid = jd_data_or_id.replace("-", "").upper()
    prefix = f"GOLD_{jid}_GRP_"
    max_idx = 0
    pattern = re.compile(rf"^GOLD_{re.escape(jid)}_GRP_(\d+)$")
    for eid in (existing_ids or []):
        m = pattern.match(eid.strip())
        if m:
            max_idx = max(max_idx, int(m.group(1)))
    return f"{prefix}{max_idx + 1:03d}"


def remove_gold_requirement(jd_data: dict[str, Any], gold_req_id: str) -> None:
    """Tombstone a gold requirement ID, preserve review history with active=false, and detach from groups."""
    jd_data.setdefault("tombstoned_requirement_ids", [])
    if gold_req_id not in jd_data["tombstoned_requirement_ids"]:
        jd_data["tombstoned_requirement_ids"].append(gold_req_id)

    # Preserve history: mark active=False and review_action="REMOVE"
    found = False
    for r in jd_data.get("reviewed_requirements", []):
        if r.get("gold_requirement_id") == gold_req_id:
            r["review_action"] = "REMOVE"
            r["active"] = False
            found = True
            break
    if not found:
        jd_data.setdefault("reviewed_requirements", []).append({
            "gold_requirement_id": gold_req_id,
            "review_action": "REMOVE",
            "active": False,
        })

    # Detach from all Boolean groups
    for g in jd_data.get("reviewed_boolean_groups", []):
        g["member_gold_requirement_ids"] = [
            mid for mid in g.get("member_gold_requirement_ids", [])
            if mid != gold_req_id
        ]


def remove_gold_group(jd_data: dict[str, Any], gold_group_id: str) -> None:
    """Tombstone a gold Boolean group ID, preserve review history with active=false."""
    jd_data.setdefault("tombstoned_group_ids", [])
    if gold_group_id not in jd_data["tombstoned_group_ids"]:
        jd_data["tombstoned_group_ids"].append(gold_group_id)

    found = False
    for g in jd_data.get("reviewed_boolean_groups", []):
        if g.get("gold_group_id") == gold_group_id:
            g["review_action"] = "REMOVE"
            g["active"] = False
            found = True
            break
    if not found:
        jd_data.setdefault("reviewed_boolean_groups", []).append({
            "gold_group_id": gold_group_id,
            "review_action": "REMOVE",
            "active": False,
        })


def validate_jd_ground_truth(jd_data: dict[str, Any]) -> list[str]:
    """Validate a single JD ground truth structure before saving or freezing."""
    from collections import Counter
    errors = []
    jid = jd_data.get("jd_id", "")

    # Sync tombstoned requirement IDs
    jd_data.setdefault("tombstoned_requirement_ids", [])
    for r in jd_data.get("reviewed_requirements", []):
        rid = r.get("gold_requirement_id")
        if (r.get("review_action") == "REMOVE" or r.get("active") is False) and rid:
            if rid not in jd_data["tombstoned_requirement_ids"]:
                jd_data["tombstoned_requirement_ids"].append(rid)

    # Sync tombstoned group IDs
    jd_data.setdefault("tombstoned_group_ids", [])
    for g in jd_data.get("reviewed_boolean_groups", []):
        gid = g.get("gold_group_id")
        if (g.get("review_action") == "REMOVE" or g.get("active") is False) and gid:
            if gid not in jd_data["tombstoned_group_ids"]:
                jd_data["tombstoned_group_ids"].append(gid)

    active_gold_reqs = [
        r for r in jd_data.get("reviewed_requirements", [])
        if r.get("review_action") != "REMOVE" and r.get("active") is not False
    ]
    active_gold_ids = [r.get("gold_requirement_id", "") for r in active_gold_reqs]

    id_counts = Counter(active_gold_ids)
    for gid, cnt in id_counts.items():
        if cnt > 1:
            errors.append(f"JD {jid}: Duplicate active gold_requirement_id '{gid}' found {cnt} times.")

    active_id_set = set(active_gold_ids)
    tombstoned_set = set(jd_data.get("tombstoned_requirement_ids", []))

    active_groups = [
        g for g in jd_data.get("reviewed_boolean_groups", [])
        if g.get("review_action") != "REMOVE" and g.get("active") is not False
    ]

    for g in active_groups:
        gid = g.get("gold_group_id", "")
        members = g.get("member_gold_requirement_ids", [])
        for m in members:
            if m not in active_id_set:
                errors.append(f"JD {jid}: Boolean group '{gid}' references nonexistent gold requirement '{m}'.")
            if m in tombstoned_set:
                errors.append(f"JD {jid}: Boolean group '{gid}' references removed/tombstoned requirement '{m}'.")

    return errors


def save_jd_annotations_atomically(
    jd_annotations_data: list[dict[str, Any]],
    file_path: Path | str,
    create_backup: bool = True,
) -> None:
    """Validate and atomically save JD annotation workspace with automated backup."""
    import shutil
    import time

    p = Path(file_path)
    all_errors = []
    for jd in jd_annotations_data:
        errs = validate_jd_ground_truth(jd)
        all_errors.extend(errs)

    if all_errors:
        raise ValueError("Validation failed on JD ground truth:\n" + "\n".join(all_errors))

    if create_backup and p.exists():
        backup_path = p.with_suffix(f".bak.{int(time.time())}")
        shutil.copy2(p, backup_path)

    temp_path = p.with_suffix(".tmp")
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(jd_annotations_data, f, indent=2, ensure_ascii=False)
    temp_path.replace(p)


def export_jd_gold(
    jd_annotation_path: Path | str,
    gold_output_path: Path | str,
    enforce_complete: bool = False,
) -> list[dict[str, Any]]:
    """Freeze and export reviewed JD ground truth structure with stable gold IDs."""
    p = Path(jd_annotation_path)
    if not p.exists():
        raise FileNotFoundError(f"JD annotation file not found at {p}")

    jds_data = json.loads(p.read_text(encoding="utf-8"))
    gold_jds: list[dict[str, Any]] = []

    # Validate before export
    all_errors = []
    for jd in jds_data:
        errs = validate_jd_ground_truth(jd)
        all_errors.extend(errs)

    if all_errors:
        raise ValueError(f"Cannot export JD gold due to validation errors:\n" + "\n".join(all_errors))

    for jd in jds_data:
        jid = jd.get("jd_id", "")
        is_ready = jd.get("review_status") == "COMPLETED" or jd.get("adjudicated") or len(jd.get("reviewed_requirements", [])) > 0
        if not is_ready:
            if enforce_complete:
                raise ValueError(f"Cannot freeze JD gold: JD {jid} review is incomplete.")
            continue

        gold_jds.append({
            "jd_id": jid,
            "jd_title": jd.get("jd_title", ""),
            "company_name": jd.get("company_name", ""),
            "domain_category": jd.get("domain_category", ""),
            "original_jd_text": jd.get("original_jd_text", ""),
            "requirements_text": jd.get("requirements_text", ""),
            "gold_requirements": [
                r for r in jd.get("reviewed_requirements", [])
                if r.get("review_action") != "REMOVE" and r.get("active") is not False
            ],
            "gold_boolean_groups": [
                g for g in jd.get("reviewed_boolean_groups", [])
                if g.get("review_action") != "REMOVE" and g.get("active") is not False
            ],
            "proposed_requirements": jd.get("proposed_requirements", []),
            "proposed_boolean_groups": jd.get("proposed_boolean_groups", []),
            "adjudicated": bool(jd.get("adjudicated", False)),
            "notes": jd.get("notes", ""),
        })

    if not gold_jds:
        raise ValueError("Cannot export empty gold benchmark: no reviewed JDs found.")

    out_p = Path(gold_output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with open(out_p, "w", encoding="utf-8") as f:
        json.dump(gold_jds, f, indent=2, ensure_ascii=False)

    logger.info("Exported %d frozen gold JDs to %s.", len(gold_jds), out_p)
    return gold_jds


def refresh_pair_workspace_from_jd_gold(
    jd_gold_path: Path | str,
    pair_workspace_path: Path | str,
    output_path: Path | str | None = None,
) -> list[dict[str, Any]]:
    """Refresh pair annotation workspace so all pairs reference frozen Gold requirement IDs."""
    p_gold = Path(jd_gold_path)
    p_pairs = Path(pair_workspace_path)
    if not p_gold.exists():
        raise FileNotFoundError(f"Gold JD file not found at {p_gold}")
    if not p_pairs.exists():
        raise FileNotFoundError(f"Pair workspace file not found at {p_pairs}")

    gold_jds = json.loads(p_gold.read_text(encoding="utf-8"))
    pairs_data = json.loads(p_pairs.read_text(encoding="utf-8"))

    gold_jd_map = {g["jd_id"]: g for g in gold_jds}
    refreshed_pairs: list[dict[str, Any]] = []

    for p in pairs_data:
        jid = p.get("jd_id", "")
        g_jd = gold_jd_map.get(jid)
        if not g_jd:
            logger.warning("JD %s not found in gold JD dataset. Keeping existing requirements.", jid)
            refreshed_pairs.append(p)
            continue

        active_gold_reqs = [
            r for r in g_jd.get("gold_requirements", [])
            if r.get("review_action") != "REMOVE"
        ]

        req_results = []
        for gr in active_gold_reqs:
            req_results.append({
                "gold_requirement_id": gr.get("gold_requirement_id"),
                "canonical_name": gr.get("canonical_name"),
                "evidence_relation": None,
                "requirement_outcome": None,
                "expected_evidence": [],
                "human_is_critical_gap": None,
                "annotations": [],
                "adjudicated": False,
                "notes": None,
            })

        refreshed_pairs.append({
            "case_id": p.get("case_id"),
            "cv_id": p.get("cv_id"),
            "jd_id": jid,
            "domain": p.get("domain"),
            "data_origin": "REAL",
            "source_dataset": p.get("source_dataset", "vietnam_tech_recruitment_2026"),
            "possible_test_leakage": bool(p.get("possible_test_leakage", False)),
            "cv_text": p.get("cv_text", ""),
            "cv_parsed": p.get("cv_parsed", {}),
            "requirement_results": req_results,
            "human_overall_score": None,
            "human_review_status": "PENDING",
            "adjudicated": False,
            "notes": None,
        })

    out_p = Path(output_path or pair_workspace_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with open(out_p, "w", encoding="utf-8") as f:
        json.dump(refreshed_pairs, f, indent=2, ensure_ascii=False)

    logger.info("Refreshed %d pair workspace cases against gold JD requirements.", len(refreshed_pairs))
    return refreshed_pairs


def generate_parser_baseline(
    gold_jd_path: Path | str,
    baseline_output_path: Path | str,
) -> dict[str, Any]:
    """Run production parser against frozen gold JDs and compute baseline metrics."""
    import datetime
    from eval.v1_eval.metrics import calculate_parser_metrics
    from eval.v1_eval.schema import ParserVersionSnapshot

    p = Path(gold_jd_path)
    if not p.exists():
        raise FileNotFoundError(f"Gold JD file not found at {p}")

    gold_jds = json.loads(p.read_text(encoding="utf-8"))
    if not gold_jds:
        raise ValueError("Cannot generate parser baseline from empty Gold JD benchmark.")

    git_sha, git_dirty = resolve_git_metadata()

    parser_config = {
        "model": "heuristic+regex",
        "pipeline_version": "v1.0",
        "language_support": ["vi", "en"],
        "normalisation": "canonical_skill+alias_table",
    }

    snapshot = ParserVersionSnapshot(
        parser_version="1.0.0",
        git_commit=git_sha,
        git_dirty=git_dirty,
        evaluation_timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        parser_configuration=parser_config,
        parser_config_hash=compute_parser_config_hash(parser_config),
        matching_schema_version="1.0.0",
        benchmark_gold_version="v1.0",
    )

    metrics = calculate_parser_metrics(gold_jds, parser_snapshot=snapshot)

    out_p = Path(baseline_output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with open(out_p, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    logger.info("Saved parser baseline metrics to %s.", out_p)
    return metrics


