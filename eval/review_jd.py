"""Interactive CLI Review Wizard for Layer A JD Ground Truth Annotation.

Usage:
    python eval/review_jd.py --jd JD-001
    python eval/review_jd.py --status
    python eval/review_jd.py --list
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any

# Ensure project root and backend are in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
backend_path = PROJECT_ROOT / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from eval.v1_eval.annotation_workspace import (
    allocate_next_gold_grp_id,
    allocate_next_gold_req_id,
    get_jd_annotation_status,
    remove_gold_group,
    remove_gold_requirement,
    save_jd_annotations_atomically,
    validate_jd_ground_truth,
)
from eval.v1_eval.schema import ParserErrorType

DEFAULT_DATASET_PATH = Path("eval/datasets/real_jd_requirement_annotations_v1.json")

ERROR_TYPE_CHOICES = [
    "NONE",
    "TOKENIZATION_ERROR",
    "HEADING_LEAK",
    "BENEFIT_LEAK",
    "APPLICATION_INSTRUCTION_LEAK",
    "UNDER_SPLIT",
    "OVER_SPLIT",
    "DUPLICATE_REQUIREMENT",
    "WRONG_REQUIRED_LEVEL",
    "HARD_GATE_OVERCLASSIFICATION",
    "BOOLEAN_OVERGROUP",
    "BOOLEAN_WRONG_OPERATOR",
    "MISSING_EXTRACTION",
    "OTHER",
]


def load_dataset(dataset_path: Path | str = DEFAULT_DATASET_PATH) -> list[dict[str, Any]]:
    p = Path(dataset_path)
    if not p.exists():
        raise FileNotFoundError(f"Dataset not found at {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def get_jd_by_id(dataset: list[dict[str, Any]], jd_id: str) -> dict[str, Any]:
    for jd in dataset:
        if jd.get("jd_id", "").upper() == jd_id.strip().upper():
            return jd
    raise ValueError(f"JD ID '{jd_id}' not found in dataset.")


def init_jd_reviewed_structures(jd_data: dict[str, Any]) -> None:
    """Initialize reviewed_requirements and reviewed_boolean_groups if not yet reviewed."""
    jd_data.setdefault("tombstoned_requirement_ids", [])
    jd_data.setdefault("tombstoned_group_ids", [])

    if not jd_data.get("reviewed_requirements"):
        reviewed = []
        for idx, p in enumerate(jd_data.get("proposed_requirements", [])):
            clean_jid = str(jd_data.get("jd_id", "")).replace("-", "").upper()
            rid = f"GOLD_{clean_jid}_REQ_{idx + 1:03d}"
            reviewed.append({
                "gold_requirement_id": rid,
                "canonical_name": p.get("canonical_name") or p.get("text") or "",
                "source_sentence": p.get("source_sentence") or p.get("text") or "",
                "source_proposal_ids": [p.get("requirement_id") or p.get("id")],
                "required_level": p.get("required_level") or ("REQUIRED" if p.get("mandatory") else "PREFERRED"),
                "expected_proficiency": p.get("expected_proficiency") or "UNSPECIFIED",
                "importance": float(p.get("importance", 1.0)),
                "hard_gate": bool(p.get("hard_gate", False)),
                "review_action": "APPROVE",
                "active": True,
                "error_type": None,
                "notes": "",
            })
        jd_data["reviewed_requirements"] = reviewed
        jd_data["next_gold_requirement_index"] = len(reviewed) + 1

    if not jd_data.get("reviewed_boolean_groups"):
        groups = []
        clean_jid = str(jd_data.get("jd_id", "")).replace("-", "").upper()
        # Filter out 1-member singletons from gold groups
        prop_multi = [g for g in jd_data.get("proposed_boolean_groups", []) if len(g.get("member_requirement_ids", [])) > 1]
        for idx, g in enumerate(prop_multi):
            gid = f"GOLD_{clean_jid}_GRP_{idx + 1:03d}"
            # map proposal member IDs to initial gold IDs
            members = []
            for pid in g.get("member_requirement_ids", []):
                for r in jd_data.get("reviewed_requirements", []):
                    if pid in (r.get("source_proposal_ids") or []):
                        members.append(r["gold_requirement_id"])
                        break
            groups.append({
                "gold_group_id": gid,
                "operator": g.get("operator", "ANY_OF"),
                "min_required": int(g.get("min_required", 1)),
                "member_gold_requirement_ids": members,
                "source_proposal_group_ids": [g.get("group_id")],
                "review_action": "APPROVE",
                "active": True,
                "notes": "",
            })
        jd_data["reviewed_boolean_groups"] = groups
        jd_data["next_gold_group_index"] = len(groups) + 1


# --- Functional Review Core Operations ---

def cli_approve_req(req: dict[str, Any]) -> dict[str, Any]:
    req["review_action"] = "APPROVE"
    req["active"] = True
    req["error_type"] = None
    return req


def cli_edit_req(
    req: dict[str, Any],
    canonical_name: str | None = None,
    required_level: str | None = None,
    expected_proficiency: str | None = None,
    importance: float | None = None,
    hard_gate: bool | None = None,
    error_type: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if canonical_name is not None:
        req["canonical_name"] = canonical_name.strip()
    if required_level is not None:
        req["required_level"] = required_level.strip().upper()
    if expected_proficiency is not None:
        req["expected_proficiency"] = expected_proficiency.strip().upper()
    if importance is not None:
        req["importance"] = float(importance)
    if hard_gate is not None:
        req["hard_gate"] = bool(hard_gate)
    if error_type is not None:
        req["error_type"] = None if error_type in {"", "NONE"} else error_type
    if notes is not None:
        req["notes"] = notes.strip()
    req["review_action"] = "EDIT"
    req["active"] = True
    return req


def cli_remove_req(
    jd_data: dict[str, Any],
    gold_req_id: str,
    error_type: str | None = None,
    notes: str = "",
) -> None:
    remove_gold_requirement(jd_data, gold_req_id)
    for r in jd_data.get("reviewed_requirements", []):
        if r.get("gold_requirement_id") == gold_req_id:
            r["error_type"] = error_type or "TOKENIZATION_ERROR"
            if notes:
                r["notes"] = notes
            break


def cli_merge_reqs(
    jd_data: dict[str, Any],
    source_gold_ids: list[str],
    merged_name: str,
    required_level: str = "REQUIRED",
    hard_gate: bool = False,
    importance: float = 1.0,
    expected_proficiency: str = "UNSPECIFIED",
    notes: str = "",
) -> str:
    """Merge multiple existing requirements into one new monotonic requirement."""
    new_gold_id = allocate_next_gold_req_id(jd_data)
    all_source_proposal_ids = []
    source_sentences = []

    for gid in source_gold_ids:
        for r in jd_data.get("reviewed_requirements", []):
            if r.get("gold_requirement_id") == gid:
                all_source_proposal_ids.extend(r.get("source_proposal_ids", []))
                if r.get("source_sentence") and r.get("source_sentence") not in source_sentences:
                    source_sentences.append(r["source_sentence"])
                # Tombstone source
                remove_gold_requirement(jd_data, gid)
                r["review_action"] = "MERGE"
                r["error_type"] = "DUPLICATE_REQUIREMENT"
                break

    new_req = {
        "gold_requirement_id": new_gold_id,
        "canonical_name": merged_name.strip(),
        "source_sentence": " ".join(source_sentences),
        "source_proposal_ids": list(dict.fromkeys(all_source_proposal_ids)),
        "required_level": required_level.upper(),
        "expected_proficiency": expected_proficiency.upper(),
        "importance": float(importance),
        "hard_gate": bool(hard_gate),
        "review_action": "MERGE",
        "active": True,
        "error_type": "DUPLICATE_REQUIREMENT",
        "notes": notes.strip() or f"Merged from {', '.join(source_gold_ids)}",
    }
    jd_data.setdefault("reviewed_requirements", []).append(new_req)
    return new_gold_id


def cli_split_req(
    jd_data: dict[str, Any],
    parent_gold_id: str,
    child_names: list[str],
    notes: str = "",
) -> list[str]:
    """Split 1 requirement into multiple new monotonic Gold requirements."""
    parent_req = None
    for r in jd_data.get("reviewed_requirements", []):
        if r.get("gold_requirement_id") == parent_gold_id:
            parent_req = r
            break
    if not parent_req:
        raise ValueError(f"Parent requirement {parent_gold_id} not found.")

    # Tombstone parent
    remove_gold_requirement(jd_data, parent_gold_id)
    parent_req["review_action"] = "SPLIT"
    parent_req["error_type"] = "UNDER_SPLIT"

    child_ids = []
    for c_name in child_names:
        if not c_name.strip():
            continue
        c_id = allocate_next_gold_req_id(jd_data)
        child_ids.append(c_id)
        jd_data.setdefault("reviewed_requirements", []).append({
            "gold_requirement_id": c_id,
            "canonical_name": c_name.strip(),
            "source_sentence": parent_req.get("source_sentence", ""),
            "source_proposal_ids": list(parent_req.get("source_proposal_ids", [])),
            "required_level": parent_req.get("required_level", "REQUIRED"),
            "expected_proficiency": parent_req.get("expected_proficiency", "UNSPECIFIED"),
            "importance": float(parent_req.get("importance", 1.0)),
            "hard_gate": bool(parent_req.get("hard_gate", False)),
            "review_action": "SPLIT",
            "active": True,
            "error_type": "UNDER_SPLIT",
            "notes": notes.strip() or f"Split from parent {parent_gold_id}",
        })
    return child_ids


def cli_add_req(
    jd_data: dict[str, Any],
    canonical_name: str,
    source_sentence: str = "",
    required_level: str = "REQUIRED",
    hard_gate: bool = False,
    importance: float = 1.0,
    expected_proficiency: str = "UNSPECIFIED",
    notes: str = "",
) -> str:
    new_id = allocate_next_gold_req_id(jd_data)
    jd_data.setdefault("reviewed_requirements", []).append({
        "gold_requirement_id": new_id,
        "canonical_name": canonical_name.strip(),
        "source_sentence": source_sentence.strip(),
        "source_proposal_ids": [],
        "required_level": required_level.upper(),
        "expected_proficiency": expected_proficiency.upper(),
        "importance": float(importance),
        "hard_gate": bool(hard_gate),
        "review_action": "ADD",
        "active": True,
        "error_type": "MISSING_EXTRACTION",
        "notes": notes.strip(),
    })
    return new_id


# --- Interactive CLI Helper and Prompts ---

def _prompt_choice(prompt_text: str, choices: list[str], default: str) -> str:
    print(f"\n{prompt_text}")
    for i, c in enumerate(choices, 1):
        print(f"  [{i}] {c}")
    val = input(f"Select choice [default={default}]: ").strip()
    if not val:
        return default
    if val.isdigit() and 1 <= int(val) <= len(choices):
        return choices[int(val) - 1]
    for c in choices:
        if c.lower() == val.lower() or (len(val) == 1 and c.lower().startswith(val.lower())):
            return c
    return default


def _prompt_error_type(default: str = "NONE") -> str:
    return _prompt_choice("Select Parser Error Type:", ERROR_TYPE_CHOICES, default=default)


def print_status_summary(dataset_path: Path | str = DEFAULT_DATASET_PATH) -> None:
    s = get_jd_annotation_status(dataset_path)
    jds = load_dataset(dataset_path)

    error_counts: dict[str, int] = {}
    active_reqs_total = 0
    active_grps_total = 0

    for jd in jds:
        for r in jd.get("reviewed_requirements", []):
            if r.get("active", True) and r.get("review_action") != "REMOVE":
                active_reqs_total += 1
            if r.get("error_type"):
                error_counts[r["error_type"]] = error_counts.get(r["error_type"], 0) + 1
        for g in jd.get("reviewed_boolean_groups", []):
            if g.get("active", True) and g.get("review_action") != "REMOVE":
                active_grps_total += 1

    print("=" * 60)
    print("      REAL V1 BENCHMARK: LAYER A (JD REVIEW) STATUS")
    print("=" * 60)
    print(f"Total Unique JDs:           {s['total_unique_jds']}")
    print(f"Completed / Adjudicated:    {s['completed_jds']} / {s['adjudicated_jds']} ({s['completion_pct']}%)")
    print(f"Pending Review:             {s['total_unique_jds'] - s['completed_jds']}")
    print(f"Total Proposed Reqs:        {s['total_proposed_requirements']}")
    print(f"Total Active Gold Reqs:     {active_reqs_total}")
    print(f"Total Active Boolean Groups:{active_grps_total}")
    print("-" * 60)
    print("Detected Parser Errors:")
    if error_counts:
        for err, cnt in sorted(error_counts.items(), key=lambda x: -x[1]):
            print(f"  - {err:<30}: {cnt}")
    else:
        print("  (None recorded yet)")
    print("=" * 60)


def review_single_jd_cli(
    jd_id: str,
    dataset_path: Path | str = DEFAULT_DATASET_PATH,
) -> None:
    dataset = load_dataset(dataset_path)
    jd_data = get_jd_by_id(dataset, jd_id)
    init_jd_reviewed_structures(jd_data)

    print("\n" + "=" * 70)
    print(f"  REVIEWING JD: {jd_data.get('jd_id')} - {jd_data.get('jd_title')}")
    print(f"  Company: {jd_data.get('company_name')} | Domain: {jd_data.get('domain_category')} | Level: {jd_data.get('job_level')}")
    print("=" * 70)

    # 1. Review Requirements Loop
    req_index = 0
    while True:
        active_reqs = [r for r in jd_data.get("reviewed_requirements", []) if r.get("active", True) and r.get("review_action") != "REMOVE"]
        all_reqs = jd_data.get("reviewed_requirements", [])
        if req_index >= len(all_reqs):
            break

        r = all_reqs[req_index]
        if not r.get("active", True) or r.get("review_action") == "REMOVE":
            req_index += 1
            continue

        print("\n" + "-" * 70)
        print(f"Requirement [{req_index + 1}/{len(all_reqs)}]  ID: {r.get('gold_requirement_id')}")
        print(f"  Canonical Name:  {r.get('canonical_name')}")
        print(f"  Source Sentence: \"{r.get('source_sentence')}\"")
        print(f"  Level:           {r.get('required_level')} | Hard Gate: {r.get('hard_gate')} | Importance: {r.get('importance')}")
        print(f"  Current Action:  {r.get('review_action')} | Error: {r.get('error_type') or 'NONE'}")
        print("-" * 70)
        print("Actions: [1] APPROVE   [2] EDIT   [3] REMOVE   [4] MERGE   [5] SPLIT   [6] SKIP   [A] ADD REQ   [Q] QUIT")

        choice = input("Enter action [1-6/A/Q, default=1]: ").strip().upper() or "1"

        if choice in {"1", "APPROVE"}:
            cli_approve_req(r)
            print(f"-> Marked {r['gold_requirement_id']} as APPROVED.")
            req_index += 1

        elif choice in {"2", "EDIT"}:
            name = input(f"Canonical Name [{r.get('canonical_name')}]: ").strip() or r.get("canonical_name")
            lvl_c = _prompt_choice("Required Level:", ["REQUIRED", "PREFERRED"], default=r.get("required_level", "REQUIRED"))
            prof_c = _prompt_choice("Proficiency:", ["UNSPECIFIED", "INTERN", "JUNIOR", "MIDDLE", "SENIOR", "LEAD"], default=r.get("expected_proficiency", "UNSPECIFIED"))
            imp = input(f"Importance 1-5 [{r.get('importance')}]: ").strip()
            imp_val = float(imp) if imp else r.get("importance", 1.0)
            hg_in = input(f"Hard Gate (y/N) [{r.get('hard_gate')}]: ").strip().lower()
            hg_val = hg_in.startswith("y") if hg_in else r.get("hard_gate", False)
            err_val = _prompt_error_type(r.get("error_type") or "NONE")
            notes = input(f"Notes [{r.get('notes')}]: ").strip() or r.get("notes", "")

            cli_edit_req(
                r,
                canonical_name=name,
                required_level=lvl_c,
                expected_proficiency=prof_c,
                importance=imp_val,
                hard_gate=hg_val,
                error_type=err_val,
                notes=notes,
            )
            print(f"-> Saved EDIT for {r['gold_requirement_id']}.")
            req_index += 1

        elif choice in {"3", "REMOVE"}:
            err_val = _prompt_error_type("TOKENIZATION_ERROR")
            notes = input("Reason / notes for removal: ").strip()
            cli_remove_req(jd_data, r["gold_requirement_id"], error_type=err_val, notes=notes)
            print(f"-> REMOVED {r['gold_requirement_id']} (Tombstoned with error {err_val}).")
            req_index += 1

        elif choice in {"4", "MERGE"}:
            print("\nAvailable Active Requirements to Merge:")
            for idx_a, ar in enumerate(active_reqs, 1):
                print(f"  [{idx_a}] {ar['gold_requirement_id']} - {ar['canonical_name']}")
            indices_str = input("Enter requirement numbers to merge together (e.g. 1, 2): ").strip()
            if indices_str:
                selected_nums = [int(x.strip()) for x in indices_str.replace(",", " ").split() if x.strip().isdigit()]
                selected_ids = [active_reqs[n - 1]["gold_requirement_id"] for n in selected_nums if 1 <= n <= len(active_reqs)]
                if r["gold_requirement_id"] not in selected_ids:
                    selected_ids.append(r["gold_requirement_id"])
                if len(selected_ids) >= 2:
                    merged_name = input("Enter canonical name for merged requirement: ").strip()
                    lvl_c = _prompt_choice("Required Level:", ["REQUIRED", "PREFERRED"], default="REQUIRED")
                    hg_in = input("Hard Gate (y/N) [False]: ").strip().lower().startswith("y")
                    new_gid = cli_merge_reqs(
                        jd_data,
                        source_gold_ids=selected_ids,
                        merged_name=merged_name,
                        required_level=lvl_c,
                        hard_gate=hg_in,
                    )
                    print(f"-> MERGED {selected_ids} into new Gold Requirement: {new_gid}")
                    req_index = 0  # Restart active view
                    continue

        elif choice in {"5", "SPLIT"}:
            print("\nEnter canonical names for each split child requirement (comma separated):")
            names_input = input("Child names (e.g. Python, FastAPI): ").strip()
            if names_input:
                child_names = [x.strip() for x in names_input.split(",") if x.strip()]
                if len(child_names) >= 2:
                    c_ids = cli_split_req(jd_data, r["gold_requirement_id"], child_names)
                    print(f"-> SPLIT {r['gold_requirement_id']} into {c_ids}")
                    continue

        elif choice in {"A", "ADD"}:
            c_name = input("Canonical Name: ").strip()
            c_sent = input("Source Sentence: ").strip()
            c_lvl = _prompt_choice("Required Level:", ["REQUIRED", "PREFERRED"], default="REQUIRED")
            c_hg = input("Hard Gate (y/N) [False]: ").strip().lower().startswith("y")
            new_id = cli_add_req(jd_data, canonical_name=c_name, source_sentence=c_sent, required_level=c_lvl, hard_gate=c_hg)
            print(f"-> ADDED Missing Gold Requirement: {new_id}")

        elif choice in {"6", "SKIP"}:
            req_index += 1

        elif choice in {"Q", "QUIT"}:
            print("Exiting review wizard. Progress is saved.")
            break

        # Save atomically after each action
        save_jd_annotations_atomically(dataset, dataset_path, create_backup=False)

    # 2. Review Boolean Groups Loop
    print("\n" + "=" * 70)
    print("  BOOLEAN LOGICAL GROUPS REVIEW")
    print("=" * 70)

    bg_groups = jd_data.get("reviewed_boolean_groups", [])
    active_req_map = {r["gold_requirement_id"]: r["canonical_name"] for r in jd_data.get("reviewed_requirements", []) if r.get("active", True)}

    for g_idx, g in enumerate(bg_groups):
        if not g.get("active", True) or g.get("review_action") == "REMOVE":
            continue

        # Clean members that might have been tombstoned
        g["member_gold_requirement_ids"] = [m for m in g.get("member_gold_requirement_ids", []) if m in active_req_map]

        print("\n" + "-" * 70)
        print(f"Boolean Group [{g_idx + 1}/{len(bg_groups)}] ID: {g.get('gold_group_id')}")
        print(f"  Operator: {g.get('operator')} | Min Required: {g.get('min_required')}")
        print("  Members:")
        for mid in g.get("member_gold_requirement_ids", []):
            print(f"    - {mid}: {active_req_map.get(mid, 'UNKNOWN')}")
        print("-" * 70)
        print("Actions: [1] APPROVE   [2] REMOVE   [3] CHANGE OPERATOR   [4] EDIT MEMBERS   [5] SKIP")

        b_choice = input("Enter choice [1-5, default=1]: ").strip() or "1"

        if b_choice in {"1", "APPROVE"}:
            g["review_action"] = "APPROVE"
            g["active"] = True
            print(f"-> APPROVED group {g['gold_group_id']}")

        elif b_choice in {"2", "REMOVE"}:
            remove_gold_group(jd_data, g["gold_group_id"])
            print(f"-> REMOVED group {g['gold_group_id']}")

        elif b_choice in {"3", "CHANGE"}:
            op = _prompt_choice("Select Operator:", ["ANY_OF", "ALL_OF"], default=g.get("operator", "ANY_OF"))
            mr = input(f"Min required [{g.get('min_required')}]: ").strip()
            g["operator"] = op
            g["min_required"] = int(mr) if mr.isdigit() else g.get("min_required", 1)
            g["review_action"] = "CHANGE_OPERATOR"
            print(f"-> Updated operator for {g['gold_group_id']}")

        elif b_choice in {"4", "MEMBERS"}:
            print("\nAvailable Active Requirements:")
            active_list = list(active_req_map.items())
            for idx_m, (arid, arname) in enumerate(active_list, 1):
                is_in = " [X]" if arid in g.get("member_gold_requirement_ids", []) else " [ ]"
                print(f"  [{idx_m}]{is_in} {arid} ({arname})")
            sel = input("Enter numbers of members for this group (e.g. 1, 3): ").strip()
            if sel:
                nums = [int(x) for x in sel.replace(",", " ").split() if x.isdigit()]
                g["member_gold_requirement_ids"] = [active_list[n - 1][0] for n in nums if 1 <= n <= len(active_list)]
                g["review_action"] = "EDIT"
                print(f"-> Updated members for {g['gold_group_id']}")

        save_jd_annotations_atomically(dataset, dataset_path, create_backup=False)

    # 3. Print Final Summary & Mark Complete Option
    active_final_reqs = [r for r in jd_data.get("reviewed_requirements", []) if r.get("active", True) and r.get("review_action") != "REMOVE"]
    active_final_grps = [g for g in jd_data.get("reviewed_boolean_groups", []) if g.get("active", True) and g.get("review_action") != "REMOVE"]
    tombstoned_reqs = jd_data.get("tombstoned_requirement_ids", [])

    print("\n" + "=" * 70)
    print(f"  SUMMARY FOR {jd_data.get('jd_id')}")
    print("=" * 70)
    print(f"Active Gold Requirements ({len(active_final_reqs)}):")
    for r in active_final_reqs:
        print(f"  * {r['gold_requirement_id']}: {r['canonical_name']} [{r['required_level']}, HardGate={r['hard_gate']}] ({r['review_action']})")

    print(f"\nActive Boolean Groups ({len(active_final_grps)}):")
    for g in active_final_grps:
        print(f"  * {g['gold_group_id']}: {g['operator']} (min {g['min_required']}) -> {g['member_gold_requirement_ids']}")

    print(f"\nRemoved / Tombstoned ({len(tombstoned_reqs)}):")
    for tid in tombstoned_reqs:
        r_match = next((x for x in jd_data.get("reviewed_requirements", []) if x.get("gold_requirement_id") == tid), None)
        err = r_match.get("error_type") if r_match else "REMOVED"
        name = r_match.get("canonical_name") if r_match else ""
        print(f"  * {tid}: {name} ({err})")

    print("=" * 70)
    complete_in = input(f"Mark {jd_data.get('jd_id')} complete? [y/N]: ").strip().lower()
    if complete_in.startswith("y"):
        jd_data["review_status"] = "COMPLETED"
        jd_data["adjudicated"] = True
        save_jd_annotations_atomically(dataset, dataset_path, create_backup=True)
        print(f"\n[SUCCESS] {jd_data.get('jd_id')} marked as COMPLETED and saved.")
    else:
        save_jd_annotations_atomically(dataset, dataset_path, create_backup=False)
        print(f"\n[INFO] {jd_data.get('jd_id')} saved with review_status: {jd_data.get('review_status')}.")


def print_jd_summary(
    jd_id: str,
    dataset_path: Path | str = DEFAULT_DATASET_PATH,
) -> None:
    """Print read-only comprehensive summary of a JD's proposals, gold state, and parser warnings."""
    dataset = load_dataset(dataset_path)
    jd_data = get_jd_by_id(dataset, jd_id)

    jid = jd_data.get("jd_id", "")
    title = jd_data.get("jd_title", "")
    company = jd_data.get("company_name", "")
    domain = jd_data.get("domain_category", "")
    level = jd_data.get("job_level", "UNSPECIFIED")
    status = jd_data.get("review_status", "PENDING")
    adjudicated = jd_data.get("adjudicated", False)

    # 1. Header
    print("=" * 80)
    print(f"  JD SUMMARY: {jid} - {title}")
    print(f"  Company: {company} | Domain: {domain} | Level: {level}")
    print(f"  Review Status: {status} | Adjudicated: {adjudicated}")
    print("=" * 80)

    # 2. Original Relevant JD Text
    req_text = jd_data.get("requirements_text") or jd_data.get("original_jd_text") or ""
    print("\nORIGINAL RELEVANT JD TEXT:")
    print("-" * 80)
    print(req_text.strip() if req_text else "(No original text provided)")
    print("-" * 80)

    # 3. Proposed Requirements Table
    props = jd_data.get("proposed_requirements", [])
    prop_groups = jd_data.get("proposed_boolean_groups", [])

    # Map requirement ID to group info
    req_to_group: dict[str, str] = {}
    for g in prop_groups:
        gid = g.get("group_id", "")
        op = g.get("operator", "ANY_OF")
        for mid in g.get("member_requirement_ids", []):
            req_to_group[mid] = f"{gid} ({op})"

    print(f"\nPROPOSED REQUIREMENTS ({len(props)}):")
    print(f"{'#':<3} {'PROPOSAL ID':<22} {'CANONICAL NAME':<24} {'PROPOSED GROUP':<20} {'SOURCE SENTENCE'}")
    print("-" * 100)
    for idx, p in enumerate(props, 1):
        pid = p.get("requirement_id") or p.get("id") or f"P_{idx}"
        cname = p.get("canonical_name") or p.get("text") or ""
        sent = (p.get("source_sentence") or "").replace("\n", " ")
        grp_str = req_to_group.get(pid, "-")
        print(f"{idx:<3} {pid:<22} {cname[:22]:<24} {grp_str:<20} {sent[:30] + '...' if len(sent) > 30 else sent}")

    # 4. Proposed Boolean Groups
    print(f"\nPROPOSED BOOLEAN GROUPS ({len(prop_groups)}):")
    if prop_groups:
        req_name_map = {
            (p.get("requirement_id") or p.get("id") or ""): (p.get("canonical_name") or p.get("text") or "")
            for p in props
        }
        for g in prop_groups:
            gid = g.get("group_id", "")
            op = g.get("operator", "ANY_OF")
            min_req = g.get("min_required", 1)
            member_names = [f"{mid} ({req_name_map.get(mid, 'unknown')})" for mid in g.get("member_requirement_ids", [])]
            print(f"  * {gid:<24} | {op:<8} | min={min_req} | members: {', '.join(member_names)}")
    else:
        print("  (None proposed)")

    # 5. Current Human Gold State (if any)
    reviewed_reqs = jd_data.get("reviewed_requirements", [])
    active_gold = [r for r in reviewed_reqs if r.get("active", True) and r.get("review_action") != "REMOVE"]
    removed_gold = [r for r in reviewed_reqs if not r.get("active", True) or r.get("review_action") == "REMOVE"]
    reviewed_groups = jd_data.get("reviewed_boolean_groups", [])
    active_groups = [g for g in reviewed_groups if g.get("active", True) and g.get("review_action") != "REMOVE"]

    print("\nCURRENT HUMAN GOLD STATE:")
    if not reviewed_reqs and not reviewed_groups:
        print(f"  (No human review performed yet - status: {status})")
    else:
        print(f"  Active Gold Requirements ({len(active_gold)}):")
        for r in active_gold:
            act = r.get("review_action", "APPROVE")
            lvl = r.get("required_level", "REQUIRED")
            hg = r.get("hard_gate", False)
            err = f" [err: {r['error_type']}]" if r.get("error_type") else ""
            print(f"    - {r.get('gold_requirement_id')}: {r.get('canonical_name')} [{lvl}, HardGate={hg}] ({act}){err}")

        print(f"  Removed / Tombstoned Requirements ({len(removed_gold)}):")
        for r in removed_gold:
            err = r.get("error_type", "REMOVED")
            print(f"    - {r.get('gold_requirement_id')}: {r.get('canonical_name')} ({err})")

        print(f"  Active Boolean Groups ({len(active_groups)}):")
        for g in active_groups:
            print(f"    - {g.get('gold_group_id')}: {g.get('operator')} (min={g.get('min_required')}) -> {g.get('member_gold_requirement_ids')}")

    # 6. Parser Warnings
    warnings = []
    # Singleton Boolean groups
    for g in prop_groups:
        mems = g.get("member_requirement_ids", [])
        if len(mems) == 1:
            warnings.append(f"Singleton Boolean group '{g.get('group_id')}' with only 1 member: {mems[0]}")

    # Repeated source sentence
    from collections import Counter
    sent_counts = Counter(p.get("source_sentence", "").strip() for p in props if p.get("source_sentence", "").strip())
    for s_text, count in sent_counts.items():
        if count >= 3:
            preview = s_text[:50] + "..." if len(s_text) > 50 else s_text
            warnings.append(f"Sentence split into {count} requirements: \"{preview}\"")

    # e.g. list split
    for p in props:
        sent = (p.get("source_sentence") or "").lower()
        if any(marker in sent for marker in ["e.g.", "for example", "such as", "ví dụ", "như:"]):
            if sent_counts.get(p.get("source_sentence", "").strip(), 0) >= 2:
                preview = p.get("source_sentence", "")[:50]
                msg = f"Potential example list split: \"{preview}...\""
                if msg not in warnings:
                    warnings.append(msg)

    # Suspicious short canonical names
    ALLOWED_SHORT_CANONICALS = {
        "AI", "C", "C#", "C++", "GO", "R", "SQL", "AWS", "GCP", "GIT", "PHP",
        "UI", "UX", "QA", "QC", "CSS", "HTML", "JS", "TS", "VUE", "NET",
    }
    for p in props:
        cname = (p.get("canonical_name") or p.get("text") or "").strip()
        pid = p.get("requirement_id") or p.get("id") or ""
        if len(cname) <= 3 and cname.upper() not in ALLOWED_SHORT_CANONICALS:
            warnings.append(f"Suspicious very short canonical name: '{cname}' in {pid}")

    print("\nPARSER WARNINGS (From Proposal Structure):")
    if warnings:
        for w in warnings:
            print(f"  [!] {w}")
    else:
        print("  (None detected)")
    print("=" * 80 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Interactive CLI Review Wizard for Layer A JD Annotations.")
    parser.add_argument("--jd", type=str, default=None, help="JD ID to review (e.g. JD-001)")
    parser.add_argument("--summary", type=str, default=None, help="Print read-only summary for a JD (e.g. JD-002)")
    parser.add_argument("--status", action="store_true", help="Print annotation progress and error summary")
    parser.add_argument("--list", action="store_true", help="List all JDs with their status")
    parser.add_argument("--dataset", type=str, default=str(DEFAULT_DATASET_PATH), help="Path to JD annotations dataset")

    args = parser.parse_args()

    if args.summary:
        print_jd_summary(args.summary, args.dataset)
        return

    if args.status:
        print_status_summary(args.dataset)
        return

    if args.list:
        jds = load_dataset(args.dataset)
        print(f"{'JD ID':<10} {'STATUS':<12} {'PROPOSED':<10} {'ACTIVE GOLD':<12} {'TITLE'}")
        print("-" * 75)
        for j in jds:
            active_cnt = sum(1 for r in j.get("reviewed_requirements", []) if r.get("active", True) and r.get("review_action") != "REMOVE")
            print(f"{j.get('jd_id'):<10} {j.get('review_status', 'PENDING'):<12} {len(j.get('proposed_requirements', [])):<10} {active_cnt:<12} {j.get('jd_title', '')[:30]}")
        return

    if args.jd:
        review_single_jd_cli(args.jd, args.dataset)
        return

    # If no flag, show interactive prompt
    print_status_summary(args.dataset)
    jd_input = input("\nEnter JD ID to review (e.g. JD-001) or press Enter to exit: ").strip()
    if jd_input:
        review_single_jd_cli(jd_input, args.dataset)


if __name__ == "__main__":
    main()
