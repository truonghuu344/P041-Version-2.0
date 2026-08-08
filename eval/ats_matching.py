import json
import os
import sys
from typing import Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class ATSMatcher:
    """Bộ tính điểm ATS Score & So khớp CV-JD theo tiêu chí tuyển dụng"""

    def __init__(self, jds_clean_path: str = "./data/clean/jds_clean.json"):
        self.jds_path = jds_clean_path
        self.jds_cache = {}
        self._load_jds()

    def _load_jds(self):
        if os.path.exists(self.jds_path):
            with open(self.jds_path, encoding="utf-8") as f:
                records = json.load(f)
                for r in records:
                    self.jds_cache[r.get("job_id")] = r

    def calculate_ats_score(self, cv: dict[str, Any], jd: dict[str, Any]) -> dict[str, Any]:
        """Tính điểm ATS Score (0 - 100%) giữa 1 CV giả lập và 1 JD tuyển dụng"""
        cv_skills = set([s.lower() for s in cv.get("skills", [])])
        must_skills = set([s.lower() for s in jd.get("must_have_skills", [])])
        nice_skills = set([s.lower() for s in jd.get("nice_to_have_skills", [])])

        # 1. Hard Skill Match Score (Trọng số 50%)
        if must_skills:
            matched_must = cv_skills.intersection(must_skills)
            missing_must = must_skills - cv_skills
            hard_skill_score = (len(matched_must) / len(must_skills)) * 100.0
        else:
            matched_must = set()
            missing_must = set()
            hard_skill_score = 80.0

        # 2. Nice-to-have Skills Match (Trọng số 20%)
        if nice_skills:
            matched_nice = cv_skills.intersection(nice_skills)
            nice_skill_score = (len(matched_nice) / len(nice_skills)) * 100.0
        else:
            matched_nice = set()
            nice_skill_score = 70.0

        # 3. Domain & Role Fit Score (Trọng số 20%)
        cv_target = cv.get("target_role", "").lower()
        jd_title = jd.get("job_title", "").lower()
        jd_domain = jd.get("domain_category", "").lower()

        domain_match = (jd_domain in cv_target) or (cv_target in jd_title) or any(w in jd_title for w in cv_target.split())
        domain_score = 90.0 if domain_match else 50.0

        # 4. Experience & Education Fit (Trọng số 10%)
        exp_score = 85.0

        # Overall Weighted ATS Score
        total_ats_score = round(
            (hard_skill_score * 0.50) +
            (nice_skill_score * 0.20) +
            (domain_score * 0.20) +
            (exp_score * 0.10),
            2
        )

        # Recommendation badge
        if total_ats_score >= 80.0:
            fit_status = "RẤT PHÙ HỢP (High Match)"
            badge_color = "Green"
        elif total_ats_score >= 60.0:
            fit_status = "TƯƠNG ĐỐI PHÙ HỢP (Moderate Match)"
            badge_color = "Yellow"
        else:
            fit_status = "CẦN BỔ SUNG KỸ NĂNG (Low Match)"
            badge_color = "Red"

        return {
            "cv_id": cv.get("cv_id"),
            "candidate_name": cv.get("candidate_name"),
            "job_id": jd.get("job_id"),
            "job_title": jd.get("job_title"),
            "company_name": jd.get("company_name"),
            "total_ats_score": total_ats_score,
            "fit_status": fit_status,
            "badge_color": badge_color,
            "breakdown": {
                "hard_skills_score": round(hard_skill_score, 1),
                "nice_skills_score": round(nice_skill_score, 1),
                "domain_score": round(domain_score, 1),
                "experience_score": round(exp_score, 1)
            },
            "matched_must_have_skills": sorted(list(matched_must)),
            "missing_must_have_skills": sorted(list(missing_must))
        }

if __name__ == "__main__":
    with open("./data/eval/simulated_cvs.json", encoding="utf-8") as f:
        cvs = json.load(f)

    with open("./data/clean/jds_clean.json", encoding="utf-8") as f:
        jds = json.load(f)

    matcher = ATSMatcher()
    sample_cv = cvs[0] # Nguyen Van A
    sample_jd = jds[0] # ShopBack Backend Intern

    res = matcher.calculate_ats_score(sample_cv, sample_jd)
    print("--- ATS SCORE BENCHMARK DEMO ---")
    print(json.dumps(res, ensure_ascii=False, indent=2))
