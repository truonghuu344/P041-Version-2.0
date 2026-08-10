import json
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from ats_matching import ATSMatcher


def run_ats_cv_benchmark():
    kaggle_cvs_path = "./data/clean/cvs_clean.json"
    simulated_cvs_path = "./data/eval/simulated_cvs.json"
    jds_path = "./data/clean/jds_clean.json"
    out_path = "./data/eval/ats_benchmark_results.json"

    # Load Simulated CVs
    all_cvs = []
    if os.path.exists(simulated_cvs_path):
        with open(simulated_cvs_path, encoding="utf-8") as f:
            sim_cvs = json.load(f)
            all_cvs.extend(sim_cvs)

    # Load Kaggle CSV CVs
    if os.path.exists(kaggle_cvs_path):
        with open(kaggle_cvs_path, encoding="utf-8") as f:
            kag_cvs = json.load(f)
            # Select top 20 tech CVs for benchmarking
            tech_kag_cvs = [c for c in kag_cvs if c.get("skills")]
            all_cvs.extend(tech_kag_cvs[:20])

    with open(jds_path, encoding="utf-8") as f:
        jds = json.load(f)

    matcher = ATSMatcher(jds_clean_path=jds_path)

    benchmark_results = []

    print(f"🚀 Đang chạy ATS Benchmark cho {len(all_cvs)} CV (gồm Kaggle Resume.csv & Test CVs) trên {len(jds)} JD làm sạch...\n")

    for cv in all_cvs:
        cv_res = {
            "cv_id": cv.get("cv_id"),
            "candidate_name": cv.get("candidate_name"),
            "source": cv.get("source", "Simulated"),
            "category": cv.get("category", cv.get("target_role")),
            "skills": cv.get("skills", []),
            "top_matches": []
        }

        scores = []
        for jd in jds:
            res = matcher.calculate_ats_score(cv, jd)
            scores.append(res)

        scores.sort(key=lambda x: x["total_ats_score"], reverse=True)
        cv_res["top_matches"] = scores[:3]
        benchmark_results.append(cv_res)

        top_1 = scores[0]
        print(f"👤 {cv['candidate_name']} ({cv['cv_id']}) [{cv.get('source', 'Simulated')}] ➔ Top 1 Match: {top_1['job_title']} @ {top_1['company_name']} ({top_1['job_id']}) | ATS Score: {top_1['total_ats_score']}% | {top_1['fit_status']}")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_results, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Đã nạp thành công bộ CV từ Kaggle CSV ({len(all_cvs)} CVs) và xuất báo cáo ATS CV Benchmark tại: {out_path}")

if __name__ == "__main__":
    run_ats_cv_benchmark()
