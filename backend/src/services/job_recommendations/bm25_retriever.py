"""Deterministic BM25 candidate retriever for Top Jobs.

BM25 is a retrieval-only signal. Its score must never be used as a CV-JD fit
score; the later evidence/rubric stage owns ``raw_fit_score`` and
``display_fit_score``.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

_TOKEN_PATTERN = re.compile(r"[a-z0-9+#.]{2,}")


@dataclass(frozen=True, slots=True)
class RankedJob:
    """A retrieval candidate, not a match or fit-score result."""

    jd_snapshot_id: str
    rank: int
    score: float


def _tokens(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFD", value.casefold())
    normalized = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )
    return _TOKEN_PATTERN.findall(normalized)


def _value(job: Mapping[str, Any] | Any, *keys: str) -> Any:
    for key in keys:
        value = job.get(key) if isinstance(job, Mapping) else getattr(job, key, None)
        if value is not None:
            return value
    return None


def _job_id(job: Mapping[str, Any] | Any) -> str:
    value = _value(job, "jd_snapshot_id", "id", "source_id")
    if not str(value or "").strip():
        raise ValueError("Each BM25 job must have jd_snapshot_id, id, or source_id.")
    return str(value)


def _job_text(job: Mapping[str, Any] | Any) -> str:
    """Prefer a purpose-built JD retrieval text, then a normalised JD body."""
    value = _value(job, "retrieval_text", "document", "requirements_text", "raw_text", "description")
    if isinstance(value, str):
        return value
    if isinstance(value, Mapping):
        return " ".join(str(item) for item in value.values() if isinstance(item, (str, int, float)))
    return ""


class BM25Retriever:
    """In-memory Okapi BM25 ranker with stable tie-breaking by JD snapshot ID."""

    def __init__(self, *, k1: float = 1.5, b: float = 0.75) -> None:
        if k1 <= 0 or not 0 <= b <= 1:
            raise ValueError("BM25 requires k1 > 0 and b between 0 and 1.")
        self.k1 = k1
        self.b = b

    def retrieve(
        self,
        cv_retrieval_text: str,
        jobs: Iterable[Mapping[str, Any] | Any],
        *,
        k: int = 30,
    ) -> list[RankedJob]:
        """Return at most ``k`` ranked JD candidates for a PII-free CV query."""
        if k < 1:
            raise ValueError("k must be at least 1.")
        query_tokens = _tokens(cv_retrieval_text)
        if not query_tokens:
            return []

        documents = [(job_id := _job_id(job), _tokens(_job_text(job))) for job in jobs]
        documents = [(job_id, tokens) for job_id, tokens in documents if tokens]
        if not documents:
            return []

        document_frequency: Counter[str] = Counter()
        for _, tokens in documents:
            document_frequency.update(set(tokens))
        average_length = sum(len(tokens) for _, tokens in documents) / len(documents)
        query_terms = set(query_tokens)
        ranked: list[tuple[str, float]] = []
        for job_id, tokens in documents:
            frequencies = Counter(tokens)
            score = 0.0
            for term in query_terms:
                frequency = frequencies[term]
                if not frequency:
                    continue
                inverse_document_frequency = math.log(
                    1 + (len(documents) - document_frequency[term] + 0.5) / (document_frequency[term] + 0.5)
                )
                denominator = frequency + self.k1 * (
                    1 - self.b + self.b * len(tokens) / average_length
                )
                score += inverse_document_frequency * frequency * (self.k1 + 1) / denominator
            ranked.append((job_id, score))

        ranked.sort(key=lambda item: (-item[1], item[0]))
        return [
            RankedJob(jd_snapshot_id=job_id, rank=index, score=round(score, 8))
            for index, (job_id, score) in enumerate(ranked[:k], start=1)
        ]


def retrieve_bm25(
    cv_retrieval_text: str,
    jobs: Iterable[Mapping[str, Any] | Any],
    *,
    k: int = 30,
) -> list[RankedJob]:
    """Convenience function for the Top Jobs orchestration service."""
    return BM25Retriever().retrieve(cv_retrieval_text, jobs, k=k)
