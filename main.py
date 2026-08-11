"""
Main entrypoint for Career Assistant X backend.
Exports `app` from `src.main` so `uvicorn main:app`, `uvicorn src.main:app`, and `python main.py` all work seamlessly.
"""
import uvicorn
from src.main import app

if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)

