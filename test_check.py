import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath("backend"))

from src.services.cv_jd_pipeline import EmbeddingService, _EMBEDDING_CACHE
from src.services.cv_jd_matching import build_cv_jd_evidence

print("Testing EmbeddingService batch...", flush=True)
embedder = EmbeddingService(dimensions=128)
vecs = embedder.embed_batch(["Python developer", "FastAPI backend"])
assert len(vecs) == 2
print("EmbeddingService batch SUCCESS!", flush=True)

print("Testing build_cv_jd_evidence...", flush=True)
res = build_cv_jd_evidence(
    cv_text="Backend Engineer with Python and FastAPI experience.",
    parsed_cv={"skills": ["Python", "FastAPI"]},
    jd_title="Python Developer",
    jd_requirements="Yêu cầu Python, FastAPI và Docker.",
)
assert "match_score" in res
print(f"Match score: {res['match_score']}, matching skills: {res['hard_skills_matching']}", flush=True)
print("ALL TESTS PASSED!", flush=True)
