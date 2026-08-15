from fastapi import APIRouter

from src.api.v2.cv_variants import router as cv_variants_router

router = APIRouter()
router.include_router(cv_variants_router)
