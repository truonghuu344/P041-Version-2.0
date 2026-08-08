"""
Script chạy LLM-as-Judge evaluation.

Cách dùng:
  # Eval Gap Analysis
  python eval/scripts/run_judge.py \\
    --dataset eval/datasets/cv_gap_golden.jsonl \\
    --type gap_analysis \\
    --output eval/results/gap_eval_20260808.json

  # Eval STAR Interview scoring (calibration mode)
  python eval/scripts/run_judge.py \\
    --dataset eval/datasets/interview_qa_golden.jsonl \\
    --type star_scoring \\
    --mode calibration \\
    --output eval/results/star_calibration.json

  # Dùng model khác
  python eval/scripts/run_judge.py \\
    --dataset eval/datasets/cv_gap_golden.jsonl \\
    --type gap_analysis \\
    --judge-model claude-3-5-sonnet-20241022 \\
    --output eval/results/gap_eval_claude.json
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Thêm project root vào path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    print("ERROR: langchain_openai chưa được cài. Chạy: pip install langchain-openai")
    sys.exit(1)


# ─── Prompt Templates ─────────────────────────────────────────────────────────

GAP_ANALYSIS_JUDGE_PROMPT = """
Bạn là chuyên gia tuyển dụng và AI evaluation có kinh nghiệm.

CV của sinh viên:
{cv_json}

Job Description:
{jd_text}

Kết quả Gap Analysis của hệ thống cần đánh giá:
{system_output}

Chấm điểm hệ thống theo 4 tiêu chí (0-10 mỗi tiêu chí):

1. Accuracy: Match score và gap skills có chính xác không?
2. Integrity: Hệ thống có BỊA thêm thông tin không có trong CV không? (10 = hoàn toàn liêm chính)
3. Relevance: Suggestions có liên quan đến JD không?
4. Actionability: Gợi ý có cụ thể, thực hiện được không?

Trả về JSON THUẦN TÚY (không có markdown, không có ```):
{{
  "accuracy": <0-10>,
  "integrity": <0-10>,
  "relevance": <0-10>,
  "actionability": <0-10>,
  "mean_score": <trung bình>,
  "reasoning": "<giải thích ngắn gọn>",
  "critical_issues": []
}}
"""

STAR_JUDGE_PROMPT = """
Bạn là chuyên gia phỏng vấn tuyển dụng và career coach.

Vị trí ứng tuyển: {jd_context}
CV summary: {cv_summary}
Câu hỏi: {question}
Câu trả lời của sinh viên: {student_answer}

Chấm điểm theo rubric STAR (0-10 mỗi thành phần):
- S (Situation): Bối cảnh có rõ ràng và cụ thể không?
- T (Task): Nhiệm vụ và vai trò cá nhân có rõ không?
- A (Action): Hành động cụ thể và có chiều sâu kỹ thuật không?
- R (Result): Kết quả có định lượng và impact không?

Trả về JSON THUẦN TÚY:
{{
  "situation": <0-10>,
  "task": <0-10>,
  "action": <0-10>,
  "result": <0-10>,
  "total_score": <(S+T+A+R)/4*10>,
  "star_feedback": {{
    "strengths": ["..."],
    "improvements": ["..."],
    "follow_up_needed": <true/false>
  }}
}}
"""


# ─── Judge Runner ─────────────────────────────────────────────────────────────

class LLMJudge:
    def __init__(self, model: str = "gpt-4o"):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "OPENAI_API_KEY chưa được set. Thêm vào .env hoặc environment."
            )
        self.llm = ChatOpenAI(model=model, temperature=0)
        self.model = model

    async def judge_gap_analysis(self, eval_case: dict, system_output: dict) -> dict:
        """Chấm điểm 1 kết quả Gap Analysis."""
        prompt = GAP_ANALYSIS_JUDGE_PROMPT.format(
            cv_json=json.dumps(eval_case["cv"], ensure_ascii=False, indent=2),
            jd_text=eval_case["jd"],
            system_output=json.dumps(system_output, ensure_ascii=False, indent=2),
        )

        response = await self.llm.ainvoke(prompt)
        raw_content = response.content.strip()

        try:
            scores = json.loads(raw_content)
        except json.JSONDecodeError:
            # Thử extract JSON từ response nếu có markdown wrapper
            import re
            json_match = re.search(r"\{.*\}", raw_content, re.DOTALL)
            if json_match:
                scores = json.loads(json_match.group())
            else:
                scores = {
                    "accuracy": 0,
                    "integrity": 0,
                    "relevance": 0,
                    "actionability": 0,
                    "mean_score": 0,
                    "reasoning": "Parse error",
                    "raw_response": raw_content,
                }

        return {
            "eval_id": eval_case["eval_id"],
            "model": self.model,
            "timestamp": datetime.now().isoformat(),
            "scores": scores,
            "expected_score_range": eval_case.get("expected_output", {}).get(
                "expected_judge_score_range", {}
            ),
        }

    async def judge_star_answer(self, eval_case: dict) -> dict:
        """Chấm điểm 1 câu trả lời phỏng vấn theo STAR."""
        prompt = STAR_JUDGE_PROMPT.format(
            jd_context=eval_case["context"]["jd"],
            cv_summary=", ".join(eval_case["context"].get("cv_skills", [])),
            question=eval_case["question"],
            student_answer=eval_case["student_answer"],
        )

        response = await self.llm.ainvoke(prompt)
        raw_content = response.content.strip()

        try:
            scores = json.loads(raw_content)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r"\{.*\}", raw_content, re.DOTALL)
            scores = json.loads(json_match.group()) if json_match else {"error": raw_content}

        golden = eval_case.get("judge_evaluation", {})
        return {
            "eval_id": eval_case["eval_id"],
            "model": self.model,
            "timestamp": datetime.now().isoformat(),
            "judge_scores": scores,
            "golden_scores": {
                "situation": golden.get("star_situation_score"),
                "task": golden.get("star_task_score"),
                "action": golden.get("star_action_score"),
                "result": golden.get("star_result_score"),
                "total": golden.get("total_score"),
            },
            "expected_range": eval_case.get("expected_judge_score_range", {}),
        }


# ─── Dataset Loader ───────────────────────────────────────────────────────────

def load_dataset(path: str) -> list[dict]:
    """Load JSONL dataset (bỏ qua dòng metadata đầu tiên)."""
    cases = []
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            # Bỏ qua dòng metadata (dòng đầu không có eval_id)
            if "eval_id" in data:
                cases.append(data)
    return cases


# ─── Main ─────────────────────────────────────────────────────────────────────

async def run_eval(args) -> None:
    judge = LLMJudge(model=args.judge_model)
    cases = load_dataset(args.dataset)

    print(f"\n{'='*60}")
    print(f"LLM-as-Judge Evaluation")
    print(f"Dataset: {args.dataset}")
    print(f"Type: {args.type}")
    print(f"Judge model: {args.judge_model}")
    print(f"Cases: {len(cases)}")
    print(f"{'='*60}\n")

    results = []

    for i, case in enumerate(cases, 1):
        print(f"[{i}/{len(cases)}] Evaluating {case['eval_id']}...", end=" ", flush=True)

        if args.type == "gap_analysis":
            # NOTE: Trong thực tế, bạn sẽ gọi actual system để lấy output
            # Hiện tại placeholder — thay bằng actual API call
            system_output = {"match_score": 0, "gap_analysis": {}, "suggestions": []}
            result = await judge.judge_gap_analysis(case, system_output)
        elif args.type == "star_scoring":
            result = await judge.judge_star_answer(case)
        else:
            print(f"SKIP (unknown type: {args.type})")
            continue

        results.append(result)
        score = result.get("scores", {}).get("mean_score") or result.get("judge_scores", {}).get("total_score", "?")
        print(f"Score: {score}")

    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    summary = {
        "run_timestamp": datetime.now().isoformat(),
        "dataset": args.dataset,
        "eval_type": args.type,
        "judge_model": args.judge_model,
        "total_cases": len(results),
        "results": results,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"✅ Saved {len(results)} results → {output_path}")

    # Quick summary
    if args.type == "gap_analysis":
        scores = [r["scores"].get("mean_score", 0) for r in results if "scores" in r]
        if scores:
            mean = sum(scores) / len(scores)
            integrity_scores = [r["scores"].get("integrity", 0) for r in results]
            min_integrity = min(integrity_scores) if integrity_scores else 0

            print(f"\nSummary:")
            print(f"  Mean score:    {mean:.2f}/10")
            print(f"  Min integrity: {min_integrity:.2f}/10")
            print(f"  KPI status:    {'✅ PASS' if mean >= 8.5 else '❌ FAIL'} (target ≥ 8.5)")
            if min_integrity < 7:
                print(f"  ⚠️  INTEGRITY GATE FAILED: min integrity {min_integrity:.2f} < 7.0")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Run LLM-as-Judge evaluation")
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to JSONL golden dataset",
    )
    parser.add_argument(
        "--type",
        choices=["gap_analysis", "star_scoring"],
        required=True,
        help="Evaluation type",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output JSON file path",
    )
    parser.add_argument(
        "--judge-model",
        default="gpt-4o",
        help="LLM model to use as judge (default: gpt-4o)",
    )
    parser.add_argument(
        "--mode",
        choices=["eval", "calibration"],
        default="eval",
        help="Run mode: eval (default) or calibration (compare with golden scores)",
    )

    args = parser.parse_args()

    if not Path(args.dataset).exists():
        print(f"ERROR: Dataset không tìm thấy: {args.dataset}")
        sys.exit(1)

    asyncio.run(run_eval(args))


if __name__ == "__main__":
    main()
