from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.cvs import upload_cv
from src.core.errors import PipelineError
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import User

router = APIRouter(prefix="/candidates", tags=["CV-JD Candidates"])


@router.post("/{candidate_id}/cv", response_model=dict, status_code=201)
async def upload_candidate_cv(
    candidate_id: str,
    file: UploadFile = File(...),
    title: str = Form(default=""),
    use_llm: bool = Form(default=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Specification-compatible upload alias; the account is the candidate owner."""
    if candidate_id not in {current_user.id, f"CAND_{current_user.id}"}:
        raise PipelineError("MATCH_001", "Candidate không tồn tại hoặc không thuộc tài khoản.", status_code=404)
    cv = await upload_cv(file=file, title=title, use_llm=use_llm, db=db, current_user=current_user)
    return {
        "candidate_id": f"CAND_{current_user.id}",
        "document_id": cv.id,
        "status": "UPLOADED",
        "cv_id": cv.id,
    }
