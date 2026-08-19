import re
from copy import deepcopy
from typing import Any


def enrich_parsed_cv_from_raw_text(parsed_cv: dict[str, Any], raw_text: str | None = None) -> dict[str, Any]:
    """Fallback extraction of summary, projects, or experience if parsed_cv is missing them."""
    enriched = dict(parsed_cv or {})
    if not raw_text:
        return enriched
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")

    # 1. Summary
    if not enriched.get("summary") or len(str(enriched.get("summary", "")).strip()) < 30 or "[PAGE" in str(enriched.get("summary", "")):
        summary_match = re.search(
            r"(?:PROFESSIONAL SUMMARY|SUMMARY|OBJECTIVE|MỤC TIÊU NGHỀ NGHIỆP|TÓM TẮT)\s*\n+(.*?)(?=\n+[A-Z\s]{4,}|\n+TECHNICAL SKILLS|\n+SKILLS|\n+EXPERIENCE|\n+PROJECTS|\n+EDUCATION|$)",
            text,
            re.DOTALL | re.IGNORECASE,
        )
        if summary_match:
            enriched["summary"] = summary_match.group(1).strip()

    # 2. Projects
    if not enriched.get("projects"):
        projects_match = re.search(
            r"(?:FEATURED PROJECTS|PROJECTS|DỰ ÁN TIÊU BIỂU|DỰ ÁN)\s*\n+(.*?)(?=\n+EDUCATION|\n+HỌC VẤN|\n+CERTIFICATIONS|\n+ACTIVITIES|\n+[A-Z\s]{5,}\n+|$)",
            text,
            re.DOTALL | re.IGNORECASE,
        )
        if projects_match:
            proj_text = projects_match.group(1).strip()
            items = []
            chunks = re.split(r"\n{2,}", proj_text)
            for chunk in chunks:
                lines = [line.strip() for line in chunk.split("\n") if line.strip() and line.strip() != "•"]
                if lines:
                    title = lines[0]
                    desc = " ".join(lines[1:]) if len(lines) > 1 else title
                    items.append(
                        {
                            "name": title,
                            "title": title,
                            "description": desc,
                            "summary": desc,
                            "bullets": [line for line in lines[1:] if len(line) > 15],
                        }
                    )
            if items:
                enriched["projects"] = items

    # 3. Experience
    if not enriched.get("experience"):
        exp_match = re.search(
            r"(?:WORK EXPERIENCE|EXPERIENCE|KINH NGHIỆM LÀM VIỆC|KINH NGHIỆM)\s*\n+(.*?)(?=\n+EDUCATION|\n+PROJECTS|\n+HỌC VẤN|\n+CERTIFICATIONS|\n+[A-Z\s]{5,}\n+|$)",
            text,
            re.DOTALL | re.IGNORECASE,
        )
        if exp_match:
            exp_text = exp_match.group(1).strip()
            items = []
            chunks = re.split(r"\n{2,}", exp_text)
            for chunk in chunks:
                lines = [line.strip() for line in chunk.split("\n") if line.strip() and line.strip() != "•"]
                if lines:
                    company = lines[0]
                    desc = " ".join(lines[1:]) if len(lines) > 1 else company
                    items.append(
                        {
                            "company": company,
                            "position": lines[1] if len(lines) > 1 else "Software Engineer",
                            "description": desc,
                            "summary": desc,
                            "bullets": [line for line in lines[1:] if len(line) > 15],
                        }
                    )
            if items:
                enriched["experience"] = items
    return enriched


def build_cv_blocks(parsed_cv: dict[str, Any], raw_text: str | None = None) -> list[dict[str, Any]]:
    """Create stable, patchable blocks without changing the CV section order."""
    if raw_text:
        parsed_cv = enrich_parsed_cv_from_raw_text(parsed_cv, raw_text)
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
            seen_item_texts: set[str] = set()
            for field in ("description", "summary", "details"):
                val = str(item.get(field) or "").strip()
                if val and val not in seen_item_texts:
                    seen_item_texts.add(val)
                    add(f"{prefix}-{field}", section, val, [section, item_index - 1, field])
            bullets = item.get("bullets")
            if isinstance(bullets, list):
                for bullet_index, bullet in enumerate(bullets, start=1):
                    b_val = str(bullet or "").strip()
                    if b_val and b_val not in seen_item_texts:
                        seen_item_texts.add(b_val)
                        add(
                            f"{prefix}-bullet-{bullet_index:03d}",
                            section,
                            b_val,
                            [section, item_index - 1, "bullets", bullet_index - 1],
                        )
    return blocks


def public_cv_blocks(parsed_cv: dict[str, Any], raw_text: str | None = None) -> list[dict[str, str]]:
    return [
        {"block_id": item["block_id"], "section": item["section"], "text": item["text"]}
        for item in build_cv_blocks(parsed_cv, raw_text)
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
        optimized = str(patch.get("optimized_text") or patch.get("optimized") or "").strip()
        section = str(patch.get("section") or "").strip()
        if (
            not block
            or block_id in seen
            or (section and section != block["section"])
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
