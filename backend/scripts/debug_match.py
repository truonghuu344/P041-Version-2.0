import asyncio
import json
from src.db.database import AsyncSessionLocal
from src.db.models import MatchRun, CV, JobDescription

async def main():
    async with AsyncSessionLocal() as db:
        m = await db.get(MatchRun, "MATCH_1883485FCA11")
        if not m:
            print("Match not found")
            return
        cv = await db.get(CV, m.cv_id)
        jd = await db.get(JobDescription, m.jd_id)
        
        print("=== CV INFO ===")
        print("CV ID:", cv.id)
        print("CV Raw text:\n", cv.raw_text)
        print("CV Parsed JSON:\n", json.dumps(cv.parsed_json, ensure_ascii=False, indent=2))
        
        print("\n=== JD INFO ===")
        print("JD ID:", jd.id, "Title:", jd.title)
        print("JD Requirements text:\n", jd.requirements_text)
        print("JD Normalized JSON:\n", json.dumps(jd.normalized_json, ensure_ascii=False, indent=2))
        
        print("\n=== MATCH RESULT EVALUATED REQUIREMENTS ===")
        res = m.result_json or {}
        reqs = res.get("evaluated_requirements", [])
        print(f"Total evaluated requirements: {len(reqs)}")
        for r in reqs:
            print("-----------------------------------------")
            print("ID:", r.get("requirement_id"))
            print("Type:", r.get("requirement_type"), "mandatory:", r.get("mandatory"), "type_field:", r.get("type"))
            print("Text:", r.get("text"))
            print("Norm:", r.get("normalized_value"))
            print("Status:", r.get("status"), "Match Status:", r.get("match_status"), "Class:", r.get("match_classification"))
            print("Evidence Strength:", r.get("evidence_strength"), "Match Score:", r.get("match_score"), "Score:", r.get("score"))
            print("Weight:", r.get("weight"), "Weighted Score:", r.get("weighted_score"))
            print(f"Evidence count: {len(r.get('evidence', []))}")
            for ev in r.get("evidence", []):
                print(f"  - Ev [{ev.get('source_section')}/{ev.get('chunk_id')}] (sem={ev.get('semantic_score')}, bm25={ev.get('bm25_score')}): {ev.get('text')}")

if __name__ == "__main__":
    asyncio.run(main())
