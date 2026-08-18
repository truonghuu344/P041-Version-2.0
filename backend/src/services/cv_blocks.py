from __future__ import annotations

from copy import deepcopy
from typing import Any


def build_cv_blocks(parsed_cv: dict[str, Any]) -> list[dict[str, Any]]:
    """Create stable, patchable blocks without changing the CV section order."""
    blocks: list[dict[str, Any]] = []

    def add(block_id: str, section: str, text: Any, path: list[str | int], value_type: str = "text") -> None:
        value = str(text or "").strip()
        if value:
            blocks.append(
                {
                    "block_id": block_id,
                    "section": section,
                    "text": value,
                    "path": path,
                    "value_type": value_type,
                }
            )

    summary_key = "summary" if parsed_cv.get("summary") is not None else "professional_summary"
    add("summary-001", "summary", parsed_cv.get(summary_key), [summary_key])

    skills = parsed_cv.get("skills")
    if isinstance(skills, list):
        add("skills-001", "skills", ", ".join(str(item).strip() for item in skills if str(item).strip()), ["skills"], "list")
    elif isinstance(skills, str):
        add("skills-001", "skills", skills, ["skills"])

    for section in ("experience", "projects", "education", "certifications"):
        items = parsed_cv.get(section)
        if not isinstance(items, list):
            continue
        for item_index, item in enumerate(items, start=1):
            prefix = f"{section}-{item_index:03d}"
            if isinstance(item, str):
                add(prefix, section, item, [section, item_index - 1])
                continue
            if not isinstance(item, dict):
                continue
            for field in ("description", "summary", "details"):
                add(f"{prefix}-{field}", section, item.get(field), [section, item_index - 1, field])
            bullets = item.get("bullets")
            if isinstance(bullets, list):
                for bullet_index, bullet in enumerate(bullets, start=1):
                    add(
                        f"{prefix}-bullet-{bullet_index:03d}",
                        section,
                        bullet,
                        [section, item_index - 1, "bullets", bullet_index - 1],
                    )
    return blocks


def public_cv_blocks(parsed_cv: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"block_id": item["block_id"], "section": item["section"], "text": item["text"]}
        for item in build_cv_blocks(parsed_cv)
    ]


def apply_cv_block_patches(
    parsed_cv: dict[str, Any], patches: list[dict[str, Any]]
) -> tuple[dict[str, Any], list[str], list[str]]:
    """Apply valid patches to a deep copy and report applied/invalid block IDs."""
    exported = deepcopy(parsed_cv)
    lookup = {item["block_id"]: item for item in build_cv_blocks(parsed_cv)}
    applied: list[str] = []
    invalid: list[str] = []
    seen: set[str] = set()

    for patch in patches:
        block_id = str(patch.get("block_id") or "").strip()
        block = lookup.get(block_id)
        original = str(patch.get("original_text") or patch.get("original") or "").strip()
        optimized = str(patch.get("optimized_text") or patch.get("optimized") or "").strip()
        section = str(patch.get("section") or "").strip()
        if (
            not block
            or block_id in seen
            or original != block["text"]
            or section != block["section"]
            or not optimized
        ):
            invalid.append(block_id)
            continue
        seen.add(block_id)
        target: Any = exported
        path = block["path"]
        try:
            for key in path[:-1]:
                target = target[key]
            value: Any = optimized
            if block["value_type"] == "list":
                value = [part.strip() for part in optimized.replace("\n", ",").split(",") if part.strip()]
            target[path[-1]] = value
            applied.append(block_id)
        except (KeyError, IndexError, TypeError):
            invalid.append(block_id)
    return exported, applied, invalid
