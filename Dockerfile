# Root-level Dockerfile kept as the canonical DevOps deliverable.
# The build context must be the repository root.

FROM python:3.12-slim AS builder

WORKDIR /app

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY backend/requirements-prod.txt ./
RUN pip install --prefix=/install -r requirements-prod.txt

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/usr/local/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser

COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser backend/src ./src
COPY --chown=appuser:appuser backend/rendercv ./rendercv
COPY --chown=appuser:appuser backend/migrations ./migrations
COPY --chown=appuser:appuser backend/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=appuser:appuser data/clean/jds_clean.json ./data/clean/jds_clean.json
COPY --chown=appuser:appuser data/jds/raw ./data/jds/raw

RUN mkdir -p /app/data/uploads && chmod 755 /app/docker-entrypoint.sh && chown -R appuser:appuser /app

USER appuser

ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
