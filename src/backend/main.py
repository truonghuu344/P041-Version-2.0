"""
Main entrypoint inside src/backend module.
Exports `app` from `src.main` so `uvicorn src.backend.main:app` works seamlessly.
"""
import uvicorn
from src.main import app

if __name__ == "__main__":
    uvicorn.run("src.backend.main:app", host="0.0.0.0", port=8000, reload=True)
