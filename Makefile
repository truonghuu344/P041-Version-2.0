.PHONY: run test lint format typecheck check frontend-dev frontend-build clean

run:
	uvicorn src.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000


test:
	PYTHONPATH=backend pytest backend/tests/ -v

lint:
	ruff check backend/src/ backend/tests/

format:
	ruff format backend/src/ backend/tests/

typecheck:
	mypy backend/src/

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

check: lint format test

clean:
	@echo "Use project-specific cleanup commands for your operating system."
