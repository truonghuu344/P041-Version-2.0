"""Create a manual label sheet from an exported Top Jobs API response."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recommendations", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    response = json.loads(args.recommendations.read_text(encoding="utf-8"))
    items = response.get("items") or []
    sheet = {
        "cv_snapshot_id": "PASTE_CV_SNAPSHOT_ID_HERE",
        "instructions": "Set label to relevant or not_relevant. Set mandatory_gap_expected true only when you judge the job unsuitable because a mandatory requirement is missing.",
        "labels": [
            {
                "job_id": str(item.get("job_id") or ""),
                "title": str(item.get("title") or ""),
                "label": "not_relevant",
                "mandatory_gap_expected": False,
                "note": "",
            }
            for item in items[:20]
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(sheet, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Created {len(sheet['labels'])} labels: {args.output}")


if __name__ == "__main__":
    main()
