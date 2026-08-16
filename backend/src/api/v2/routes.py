from fastapi import APIRouter

# pyrefly: ignore [missing-import]
from src.api.v2.cv_variants import router as cv_variants_router

# pyrefly: ignore [missing-import]
from src.api.v2.job_recommendations import router as job_recommendations_router

# pyrefly: ignore [missing-import]
from src.api.v2.match_evaluation import router as match_evaluation_router

router = APIRouter()
router.include_router(cv_variants_router)
router.include_router(job_recommendations_router)
router.include_router(match_evaluation_router)

