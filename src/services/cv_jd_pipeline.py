from __future__ import annotations

import hashlib
import logging
import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

PIPELINE_VERSION = "1.0"
SCHEMA_VERSION = "1.0"
logger = logging.getLogger(__name__)

ALLOWED_CHUNK_TYPES: dict[str, set[str]] = {
    "JD_REQUIRED_SKILL": {"CV_SKILL", "CV_EXPERIENCE", "CV_PROJECT", "CV_CERTIFICATION"},
    "JD_PREFERRED_SKILL": {"CV_SKILL", "CV_EXPERIENCE", "CV_PROJECT", "CV_CERTIFICATION"},
    "JD_EXPERIENCE": {"CV_EXPERIENCE", "CV_PROJECT"},
    "JD_EDUCATION": {"CV_EDUCATION"},
    "JD_CERTIFICATION": {"CV_CERTIFICATION"},
    "JD_LANGUAGE": {"CV_LANGUAGE", "CV_CERTIFICATION"},
    "JD_RESPONSIBILITY": {"CV_EXPERIENCE", "CV_PROJECT"},
    "JD_DOMAIN": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY"},
    "JD_REQUIRED_QUALIFICATION": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY", "CV_CERTIFICATION"},
    "JD_PREFERRED_QUALIFICATION": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY", "CV_CERTIFICATION"},
    "JD_LOCATION": set(),
    "JD_WORK_MODE": set(),
    "JD_EMPLOYMENT_TYPE": set(),
    "JD_OTHER_REQUIREMENT": {"CV_OTHER", "CV_SUMMARY", "CV_EXPERIENCE", "CV_PROJECT"},
}

SKILL_FACTORS = {
    "EXACT_MATCH": 1.0,
    "NORMALIZED_MATCH": 1.0,
    "SEMANTIC_MATCH": 0.8,
    "PARTIAL_MATCH": 0.5,
    "NOT_FOUND": 0.0,
}

DEGREE_RANK = {
    "high_school": 1,
    "associate": 2,
    "bachelor": 3,
    "master": 4,
    "doctorate": 5,
}

DEFAULT_RUBRIC = {
    "CRIT_REQUIRED_SKILL": 35.0,
    "CRIT_EXPERIENCE": 30.0,
    "CRIT_EDUCATION": 10.0,
    "CRIT_PREFERRED_SKILL": 10.0,
    "CRIT_DOMAIN": 15.0,
}

NORMALIZATION_ALIASES = {
    "amazon web services": "aws",
    "postgres sql": "postgresql",
    "postgres": "postgresql",
    "react.js": "react",
    "reactjs": "react",
    "restful api": "rest api",
    "node.js": "nodejs",
    "js": "javascript",
}


def fold(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").casefold())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def tokenize(value: str) -> list[str]:
    stopwords = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "in",
        "is",
        "of",
        "on",
        "or",
        "that",
        "the",
        "to",
        "using",
        "with",
        "va",
        "voi",
        "cac",
        "cho",
        "cua",
        "la",
        "trong",
    }
    return [token for token in re.findall(r"[a-z0-9+#.]{2,}", fold(value)) if token not in stopwords]


def normalize_terms(value: str) -> str:
    normalized = fold(value)
    for alias, canonical in sorted(NORMALIZATION_ALIASES.items(), key=lambda item: -len(item[0])):
        normalized = re.sub(rf"(?<!\w){re.escape(alias)}(?!\w)", canonical, normalized)
    return normalized


def _id(prefix: str, *parts: Any) -> str:
    digest = hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()[:12].upper()
    return f"{prefix}_{digest}"


def _record_text(record: Any) -> str:
    if not isinstance(record, dict):
        return str(record or "").strip()
    preferred = [
        record.get("evidence_quote"),
        record.get("description"),
        record.get("text"),
        record.get("summary"),
        record.get("title"),
        record.get("job_title_original"),
        record.get("organization"),
        record.get("company"),
        record.get("period"),
        record.get("degree_original"),
        record.get("major"),
        record.get("name"),
    ]
    values = [str(value).strip() for value in preferred if value]
    for key in ("descriptions", "skills", "domain"):
        if isinstance(record.get(key), list):
            values.extend(str(value).strip() for value in record[key] if str(value).strip())
    return " ".join(dict.fromkeys(values)).strip()


def _normalized_text(value: str) -> str:
    return " ".join(tokenize(normalize_terms(value)))


@dataclass(frozen=True)
class PipelineConfig:
    bm25_top_k: int = 20
    semantic_top_k: int = 20
    semantic_min_score: float = 0.45
    rrf_k: int = 60
    hybrid_top_k: int = 10
    max_evidence_per_requirement: int = 3
    score_decimal_places: int = 1
    embedding_provider: str = "auto"
    embedding_model: str = "gemini-embedding-2"
    embedding_api_key: str = ""
    embedding_dimensions: int = 768
    rating_poor_max: float = 49.9
    rating_average_max: float = 69.9
    rating_good_max: float = 84.9
    extraction_min_confidence: float = 0.50


class ChunkingService:
    """Structural CV chunking. PII profile fields are intentionally excluded."""

    @staticmethod
    def build(cv_text: str, parsed_cv: dict[str, Any]) -> tuple[str, str, list[dict[str, Any]]]:
        candidate_id = str(parsed_cv.get("_candidate_id") or _id("CAND", cv_text))
        document_id = _id("DOC", candidate_id, cv_text)
        chunks: list[dict[str, Any]] = []

        def add(chunk_type: str, text: str, section: str, page: int | None, metadata: dict[str, Any]) -> None:
            clean = re.sub(r"\s+", " ", text).strip()
            if not clean:
                return
            index = len(chunks) + 1
            chunks.append(
                {
                    "chunk_id": f"CV_CHUNK_{index:03d}_{_id('', document_id, section, clean).strip('_')[:8]}",
                    "candidate_id": candidate_id,
                    "document_id": document_id,
                    "chunk_type": chunk_type,
                    "text": clean[:3000],
                    "normalized_text": _normalized_text(clean)[:3000],
                    "source_section": section,
                    "source_page": page,
                    "metadata": metadata,
                }
            )

        summary = str(parsed_cv.get("summary") or parsed_cv.get("professional_summary") or "").strip()
        add("CV_SUMMARY", summary, "summary", parsed_cv.get("summary_source_page"), {})

        skills: list[str] = []
        for key in ("skills", "hard_skills", "soft_skills"):
            for item in parsed_cv.get(key) or []:
                if isinstance(item, dict):
                    value = item.get("original_name") or item.get("name") or item.get("normalized_name")
                else:
                    value = item
                if value and fold(value) not in {fold(existing) for existing in skills}:
                    skills.append(str(value))
        add("CV_SKILL", ", ".join(skills), "skills", None, {"skills": skills})

        section_types = {
            "experience": "CV_EXPERIENCE",
            "projects": "CV_PROJECT",
            "education": "CV_EDUCATION",
            "certifications": "CV_CERTIFICATION",
            "languages": "CV_LANGUAGE",
            "awards": "CV_AWARD",
            "publications": "CV_PUBLICATION",
            "volunteer": "CV_VOLUNTEER",
            "other": "CV_OTHER",
        }
        for section, chunk_type in section_types.items():
            for index, record in enumerate(parsed_cv.get(section) or []):
                text = _record_text(record)
                page = record.get("source_page") if isinstance(record, dict) else None
                metadata = dict(record) if isinstance(record, dict) else {}
                # One record is at least one structural chunk; long descriptions split by sentence groups.
                sentences = [part.strip() for part in re.split(r"(?<=[.!?;])\s+", text) if part.strip()]
                groups = [text]
                if len(text) > 1200 and len(sentences) > 1:
                    groups = []
                    current = ""
                    for sentence in sentences:
                        if current and len(current) + len(sentence) > 900:
                            groups.append(current)
                            current = sentence
                        else:
                            current = f"{current} {sentence}".strip()
                    if current:
                        groups.append(current)
                for part_index, group in enumerate(groups):
                    suffix = f"[{index}]" if len(groups) == 1 else f"[{index}].part[{part_index}]"
                    add(chunk_type, group, f"{section}{suffix}", page, metadata)

        # Preserve unclassified CV text without indexing sensitive contact lines.
        if not chunks:
            safe_lines = [
                line
                for line in cv_text.splitlines()
                if line.strip()
                and "@" not in line
                and not re.search(r"(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}", line)
            ]
            add("CV_OTHER", " ".join(safe_lines), "raw_text", None, {})
        return candidate_id, document_id, chunks


def _skill_category(skill: str) -> str:
    value = normalize_terms(skill)
    categories = {
        "programming_language": {"python", "java", "javascript", "typescript", "go", "c", "c++", "c#", "ruby", "php", "dart", "r"},
        "framework": {"fastapi", "django", "flask", "spring boot", "react", "vue", "angular", "next.js", "rails"},
        "database": {"sql", "postgresql", "mysql", "sql server", "mongodb", "redis", "oracle"},
        "cloud": {"aws", "azure", "gcp", "google cloud"},
        "devops": {"docker", "kubernetes", "terraform", "jenkins", "ci/cd", "linux"},
        "methodology": {"agile", "scrum", "kanban", "tdd"},
        "soft_skill": {"communication", "teamwork", "leadership", "problem solving", "giao tiep", "lam viec nhom"},
    }
    for category, values in categories.items():
        if value in values:
            return category
    return "other"


def normalize_structured_cv(cv_text: str, parsed_cv: dict[str, Any]) -> dict[str, Any]:
    """Build the complete versioned CV taxonomy without removing legacy/original values."""
    candidate_id, document_id, chunks = ChunkingService.build(cv_text, parsed_cv)
    skill_chunks = [chunk for chunk in chunks if chunk["chunk_type"] == "CV_SKILL"]
    raw_skills = list((skill_chunks[0].get("metadata") or {}).get("skills") or []) if skill_chunks else []
    skills = [
        {
            "original_name": skill,
            "normalized_name": normalize_terms(skill),
            "category": _skill_category(skill),
            "confidence": 0.96,
            "source_text": skill_chunks[0]["text"] if skill_chunks else skill,
            "source_page": skill_chunks[0]["source_page"] if skill_chunks else None,
        }
        for skill in raw_skills
    ]
    chunk_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for chunk in chunks:
        chunk_map[chunk["chunk_type"]].append(chunk)

    def records(key: str, chunk_type: str) -> list[dict[str, Any]]:
        output = []
        source = parsed_cv.get(key) or []
        for index, value in enumerate(source):
            item = dict(value) if isinstance(value, dict) else {"text": str(value)}
            matching = chunk_map[chunk_type][index] if index < len(chunk_map[chunk_type]) else None
            item.setdefault("source_page", (matching or {}).get("source_page"))
            item.setdefault("source_text", item.get("evidence_quote") or _record_text(item))
            item.setdefault("confidence", 0.9)
            output.append(item)
        return output

    personal = parsed_cv.get("personal_info") or {}
    return {
        "schema_version": SCHEMA_VERSION,
        "candidate_id": candidate_id,
        "document_id": document_id,
        "candidate": {
            "name": str(personal.get("full_name") or ""),
            "current_title": str(parsed_cv.get("current_title") or ""),
            "location": str(personal.get("location") or ""),
        },
        "summary": {
            "text": str(parsed_cv.get("summary") or parsed_cv.get("professional_summary") or ""),
            "source_page": next((chunk["source_page"] for chunk in chunk_map["CV_SUMMARY"]), None),
        },
        "skills": skills,
        "experience": records("experience", "CV_EXPERIENCE"),
        "projects": records("projects", "CV_PROJECT"),
        "education": records("education", "CV_EDUCATION"),
        "certifications": records("certifications", "CV_CERTIFICATION"),
        "languages": records("languages", "CV_LANGUAGE"),
        "awards": records("awards", "CV_AWARD"),
        "publications": records("publications", "CV_PUBLICATION"),
        "volunteer": records("volunteer", "CV_VOLUNTEER"),
        "other": records("other", "CV_OTHER"),
        "missing_information": list(parsed_cv.get("missing_information") or []),
        "parse_quality": dict(parsed_cv.get("parse_quality") or parsed_cv.get("ats_quality") or {}),
        "chunks": chunks,
    }


class BM25Service:
    def __init__(self, chunks: list[dict[str, Any]]) -> None:
        self.chunks = chunks
        self.tokens = [tokenize(chunk["normalized_text"] or chunk["text"]) for chunk in chunks]
        self.avgdl = sum(map(len, self.tokens)) / max(1, len(self.tokens))
        self.df: Counter[str] = Counter()
        for tokens in self.tokens:
            self.df.update(set(tokens))

    def search(self, query: str, allowed: set[str], top_k: int) -> list[dict[str, Any]]:
        query_tokens = tokenize(query)
        results = []
        total = max(1, len(self.chunks))
        for index, (chunk, tokens) in enumerate(zip(self.chunks, self.tokens, strict=True)):
            if chunk["chunk_type"] not in allowed:
                continue
            frequencies = Counter(tokens)
            score = 0.0
            for term in query_tokens:
                df = self.df.get(term, 0)
                if not df:
                    continue
                idf = math.log(1 + (total - df + 0.5) / (df + 0.5))
                tf = frequencies[term]
                denominator = tf + 1.5 * (1 - 0.75 + 0.75 * len(tokens) / max(1.0, self.avgdl))
                score += idf * (tf * 2.5 / denominator)
            if score > 0:
                results.append({"chunk_id": chunk["chunk_id"], "bm25_score": round(score, 6), "_index": index})
        results.sort(key=lambda item: (-item["bm25_score"], item["chunk_id"]))
        for rank, item in enumerate(results[:top_k], start=1):
            item["bm25_rank"] = rank
        return results[:top_k]


class EmbeddingService:
    """Deterministic local vector model; model name/version is persisted in the result."""

    def __init__(self, dimensions: int = 768) -> None:
        self.dimensions = dimensions
        self.name = "local-hashing-embedding-v1"

    def embed(self, text: str) -> dict[int, float]:
        features: Counter[int] = Counter()
        normalized = f" {fold(text)} "
        for token in tokenize(normalized):
            digest = int(hashlib.blake2b(token.encode(), digest_size=8).hexdigest(), 16)
            features[digest % self.dimensions] += 1.0
        compact = re.sub(r"\s+", " ", normalized)
        for index in range(max(0, len(compact) - 2)):
            trigram = compact[index : index + 3]
            digest = int(hashlib.blake2b(trigram.encode(), digest_size=8).hexdigest(), 16)
            features[digest % self.dimensions] += 0.15
        norm = math.sqrt(sum(value * value for value in features.values())) or 1.0
        return {key: value / norm for key, value in features.items()}

    @staticmethod
    def cosine(left: dict[int, float], right: dict[int, float]) -> float:
        if len(left) > len(right):
            left, right = right, left
        return sum(value * right.get(key, 0.0) for key, value in left.items())


class GeminiEmbeddingService(EmbeddingService):
    """Real semantic embedding provider used in production when an API key exists."""

    def __init__(self, *, api_key: str, model: str, dimensions: int) -> None:
        from google import genai

        super().__init__(dimensions)
        self.name = model
        self._client = genai.Client(api_key=api_key)

    def embed(self, text: str) -> dict[int, float]:
        from google.genai import types

        response = self._client.models.embed_content(
            model=self.name,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=self.dimensions),
        )
        values = list(response.embeddings[0].values)
        if len(values) != self.dimensions:
            raise ValueError(f"Embedding dimension {len(values)} != {self.dimensions}.")
        return {index: float(value) for index, value in enumerate(values) if value}


class VectorSearchService:
    def __init__(self, chunks: list[dict[str, Any]], embedder: EmbeddingService) -> None:
        self.chunks = chunks
        self.embedder = embedder
        self.vectors = [embedder.embed(chunk["normalized_text"] or chunk["text"]) for chunk in chunks]

    def search(self, query: str, allowed: set[str], top_k: int, min_score: float) -> list[dict[str, Any]]:
        vector = self.embedder.embed(query)
        results = []
        for index, (chunk, candidate) in enumerate(zip(self.chunks, self.vectors, strict=True)):
            if chunk["chunk_type"] not in allowed:
                continue
            score = self.embedder.cosine(vector, candidate)
            if score >= min_score:
                results.append({"chunk_id": chunk["chunk_id"], "semantic_score": round(score, 6), "_index": index})
        results.sort(key=lambda item: (-item["semantic_score"], item["chunk_id"]))
        for rank, item in enumerate(results[:top_k], start=1):
            item["semantic_rank"] = rank
        return results[:top_k]


class HybridFusionService:
    @staticmethod
    def rrf(
        bm25_results: list[dict[str, Any]], semantic_results: list[dict[str, Any]], *, k: int, top_k: int
    ) -> list[dict[str, Any]]:
        combined: dict[str, dict[str, Any]] = defaultdict(dict)
        for item in bm25_results:
            combined[item["chunk_id"]].update(item)
            combined[item["chunk_id"]]["fusion_score"] = combined[item["chunk_id"]].get("fusion_score", 0.0) + 1 / (
                k + item["bm25_rank"]
            )
        for item in semantic_results:
            combined[item["chunk_id"]].update(item)
            combined[item["chunk_id"]]["fusion_score"] = combined[item["chunk_id"]].get("fusion_score", 0.0) + 1 / (
                k + item["semantic_rank"]
            )
        results = [{**value, "chunk_id": chunk_id} for chunk_id, value in combined.items()]
        results.sort(key=lambda item: (-item["fusion_score"], item["chunk_id"]))
        for rank, item in enumerate(results[:top_k], start=1):
            item["fusion_score"] = round(item["fusion_score"], 8)
            item["fusion_rank"] = rank
        return results[:top_k]


class RetrievalService:
    def __init__(self, chunks: list[dict[str, Any]], config: PipelineConfig) -> None:
        self.chunks = chunks
        self.by_id = {chunk["chunk_id"]: chunk for chunk in chunks}
        self.config = config
        self.bm25 = BM25Service(chunks)
        use_gemini = config.embedding_provider in {"auto", "gemini"} and bool(config.embedding_api_key)
        if use_gemini:
            try:
                self.embedding = GeminiEmbeddingService(
                    api_key=config.embedding_api_key,
                    model=config.embedding_model,
                    dimensions=config.embedding_dimensions,
                )
            except Exception as exc:
                if config.embedding_provider == "gemini":
                    raise
                logger.warning("Gemini embedding unavailable; using deterministic fallback: %s", exc)
                self.embedding = EmbeddingService(config.embedding_dimensions)
        else:
            self.embedding = EmbeddingService(config.embedding_dimensions)
        try:
            self.vector = VectorSearchService(chunks, self.embedding)
        except Exception as exc:
            if config.embedding_provider == "gemini":
                raise RuntimeError("EMBEDDING_001: Không thể tạo Gemini embedding.") from exc
            logger.warning("Semantic embedding failed; using deterministic fallback: %s", exc)
            self.embedding = EmbeddingService(config.embedding_dimensions)
            self.vector = VectorSearchService(chunks, self.embedding)

    def retrieve(self, requirement: dict[str, Any]) -> dict[str, Any]:
        allowed = ALLOWED_CHUNK_TYPES.get(
            requirement["requirement_type"], set(ALLOWED_CHUNK_TYPES["JD_OTHER_REQUIREMENT"])
        )
        if requirement["requirement_type"] in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
            semantic_query = str(requirement.get("normalized_value") or requirement.get("text") or "")
            bm25_query = " ".join(
                [
                    semantic_query,
                    *[str(value) for value in requirement.get("related_values") or []],
                ]
            )
        else:
            semantic_query = str(requirement.get("text") or requirement.get("normalized_value") or "")
            bm25_query = semantic_query
        semantic = self.vector.search(
            semantic_query,
            allowed,
            self.config.semantic_top_k,
            self.config.semantic_min_score,
        )
        bm25 = self.bm25.search(bm25_query, allowed, self.config.bm25_top_k)
        hybrid = HybridFusionService.rrf(bm25, semantic, k=self.config.rrf_k, top_k=self.config.hybrid_top_k)
        return {
            "requirement_id": requirement["requirement_id"],
            "allowed_chunk_types": sorted(allowed),
            "bm25_results": [{key: value for key, value in item.items() if key != "_index"} for item in bm25],
            "semantic_results": [{key: value for key, value in item.items() if key != "_index"} for item in semantic],
            "hybrid_results": [{key: value for key, value in item.items() if key != "_index"} for item in hybrid],
        }


class EvidenceService:
    def __init__(self, chunks: list[dict[str, Any]], max_per_requirement: int) -> None:
        self.by_id = {chunk["chunk_id"]: chunk for chunk in chunks}
        self.max_per_requirement = max_per_requirement

    def select(self, requirement: dict[str, Any], retrieval: dict[str, Any]) -> list[dict[str, Any]]:
        selected = []
        seen_text: set[str] = set()
        for result in retrieval["hybrid_results"]:
            chunk = self.by_id[result["chunk_id"]]
            key = fold(chunk["text"])
            if not key or key in seen_text:
                continue
            seen_text.add(key)
            selected.append(
                {
                    "evidence_id": _id("EVD", requirement["requirement_id"], chunk["chunk_id"]),
                    "requirement_id": requirement["requirement_id"],
                    "chunk_id": chunk["chunk_id"],
                    "text": chunk["text"],
                    "source_page": chunk["source_page"],
                    "source_section": chunk["source_section"],
                    "semantic_score": result.get("semantic_score"),
                    "semantic_rank": result.get("semantic_rank"),
                    "bm25_score": result.get("bm25_score"),
                    "bm25_rank": result.get("bm25_rank"),
                    "fusion_score": result["fusion_score"],
                    "fusion_rank": result["fusion_rank"],
                }
            )
            if len(selected) == self.max_per_requirement:
                break
        return selected


def _contains_term(text: str, term: str) -> bool:
    return bool(
        re.search(
            rf"(?<!\w){re.escape(normalize_terms(term))}(?!\w)",
            normalize_terms(text),
        )
    )


def _contains_exact(text: str, term: str) -> bool:
    return bool(re.search(rf"(?<!\w){re.escape(fold(term))}(?!\w)", fold(text)))


def _requirement_match_class(requirement: dict[str, Any], evidence: list[dict[str, Any]]) -> str:
    requirement_type = requirement["requirement_type"]
    if not evidence:
        return "NOT_FOUND"
    target_original = str(requirement.get("original_value") or requirement.get("text") or "")
    target_normalized = str(requirement.get("normalized_value") or target_original)
    combined = " ".join(item["text"] for item in evidence)
    if requirement_type in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
        if _contains_exact(combined, target_original):
            return "EXACT_MATCH"
        if _contains_term(combined, target_normalized):
            return "NORMALIZED_MATCH"
        related = {fold(value) for value in requirement.get("related_values") or []}
        if related.intersection(tokenize(combined)) or any(_contains_term(combined, value) for value in related):
            return "PARTIAL_MATCH"
        return "NOT_FOUND"
    best_semantic = max((float(item.get("semantic_score") or 0) for item in evidence), default=0.0)
    if best_semantic >= 0.72:
        return "SEMANTIC_MATCH"
    if best_semantic >= 0.45 or any(item.get("bm25_score") for item in evidence):
        return "PARTIAL_MATCH"
    return "NOT_FOUND"


def _status_for(match_class: str, requirement: dict[str, Any], min_confidence: float) -> str:
    confidence = float(requirement.get("confidence", 1.0))
    if confidence < min_confidence:
        return "UNCERTAIN"
    if match_class in {"EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH"}:
        return "SUPPORTED"
    if match_class == "PARTIAL_MATCH":
        return "PARTIALLY_SUPPORTED"
    return "NOT_FOUND"


def _parse_year_month(value: str) -> tuple[int, int] | None:
    text = fold(value)
    match = re.search(r"\b(19\d{2}|20\d{2})[-/.](0?[1-9]|1[0-2])\b", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.search(r"\b(0?[1-9]|1[0-2])[-/.](19\d{2}|20\d{2})\b", text)
    if match:
        return int(match.group(2)), int(match.group(1))
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return (int(match.group(1)), 1) if match else None


def _record_months(record: dict[str, Any]) -> set[int]:
    start = _parse_year_month(str(record.get("start_date") or ""))
    end = _parse_year_month(str(record.get("end_date") or ""))
    period = str(record.get("period") or "")
    values = re.findall(
        r"(?:0?[1-9]|1[0-2])[-/.](?:19\d{2}|20\d{2})|(?:19\d{2}|20\d{2})[-/.](?:0?[1-9]|1[0-2])|(?:19\d{2}|20\d{2})",
        period,
    )
    if not start and values:
        start = _parse_year_month(values[0])
    if not end and len(values) >= 2:
        end = _parse_year_month(values[-1])
    if start and (record.get("is_current") or re.search(r"present|current|now|hien tai|nay", fold(period))):
        now = datetime.now(UTC)
        end = (now.year, now.month)
    if start and end:
        first = start[0] * 12 + start[1] - 1
        last = end[0] * 12 + end[1] - 1
        return set(range(first, max(first, last) + 1))
    return set()


class EvaluationService:
    def __init__(
        self, chunks: list[dict[str, Any]], parsed_cv: dict[str, Any], extraction_min_confidence: float
    ) -> None:
        self.chunks = chunks
        self.parsed_cv = parsed_cv
        self.extraction_min_confidence = extraction_min_confidence

    def evaluate_requirement(self, requirement: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
        match_class = _requirement_match_class(requirement, evidence)
        status = _status_for(match_class, requirement, self.extraction_min_confidence)
        factor = SKILL_FACTORS.get(match_class, 0.0)
        score = factor * 100

        if requirement["requirement_type"] in {"JD_LOCATION", "JD_WORK_MODE", "JD_EMPLOYMENT_TYPE"}:
            preferences = self.parsed_cv.get("preferences") or {}
            key = {
                "JD_LOCATION": "location",
                "JD_WORK_MODE": "work_mode",
                "JD_EMPLOYMENT_TYPE": "employment_type",
            }[requirement["requirement_type"]]
            candidate_value = str(preferences.get(key) or "")
            if not candidate_value:
                status = "UNCERTAIN"
                match_class = "NOT_FOUND"
                score = 0.0
            elif normalize_terms(candidate_value) == normalize_terms(
                str(requirement.get("normalized_value") or requirement["text"])
            ):
                status = "SUPPORTED"
                match_class = "NORMALIZED_MATCH"
                score = 100.0
            else:
                status = "CONFLICTING"
                match_class = "NOT_FOUND"
                score = 0.0

        if requirement["requirement_type"] == "JD_EXPERIENCE":
            required_years = float(requirement.get("minimum_years") or 0)
            relevant_chunk_ids = {item["chunk_id"] for item in evidence}
            relevant_months: set[int] = set()
            undated_months = 0
            for chunk in self.chunks:
                if chunk["chunk_id"] not in relevant_chunk_ids or chunk["chunk_type"] != "CV_EXPERIENCE":
                    continue
                months = _record_months(chunk["metadata"])
                if months:
                    relevant_months.update(months)
                elif isinstance(chunk["metadata"].get("duration_months"), (int, float)):
                    undated_months += int(chunk["metadata"]["duration_months"])
            candidate_years = (len(relevant_months) + undated_months) / 12
            if required_years > 0:
                score = min(candidate_years / required_years, 1.0) * 100
                status = "SUPPORTED" if score >= 100 else "PARTIALLY_SUPPORTED" if score > 0 else "NOT_FOUND"
            elif evidence:
                score = factor * 100
            requirement["candidate_relevant_years"] = round(candidate_years, 2)

        if requirement["requirement_type"] == "JD_EDUCATION":
            required = str(requirement.get("minimum_degree") or "unknown")
            candidate_records = self.parsed_cv.get("education") or []
            best_degree = 0
            major_score = 0.0
            required_major = fold(requirement.get("major"))
            for record in candidate_records:
                text = fold(_record_text(record))
                degree = str(record.get("degree_level") or "") if isinstance(record, dict) else ""
                if not degree:
                    for name in reversed(list(DEGREE_RANK)):
                        if (
                            name in text
                            or {"bachelor": "cu nhan", "master": "thac si", "doctorate": "tien si"}.get(name) in text
                        ):
                            degree = name
                            break
                best_degree = max(best_degree, DEGREE_RANK.get(degree, 0))
                if required_major and set(tokenize(required_major)).intersection(tokenize(text)):
                    major_score = 30.0
            degree_score = 70.0 if best_degree >= DEGREE_RANK.get(required, 999) else 0.0
            score = degree_score + (major_score if required_major else 30.0)
            status = "SUPPORTED" if score >= 100 else "PARTIALLY_SUPPORTED" if score > 0 else "NOT_FOUND"

        if status == "SUPPORTED":
            reason = "CV có evidence hỗ trợ requirement này."
        elif status == "PARTIALLY_SUPPORTED":
            reason = "CV có evidence liên quan nhưng chưa đáp ứng đầy đủ requirement."
        elif status == "UNCERTAIN":
            reason = "Có evidence nhưng độ tin cậy extraction chưa đủ để kết luận."
        else:
            reason = "Không tìm thấy bằng chứng đáng tin cậy cho requirement này trong CV."

        return {
            **requirement,
            "status": status,
            "match_classification": match_class,
            "criterion_score": round(score, 1),
            "reason": reason,
            "evidence_ids": [item["evidence_id"] for item in evidence],
            "evidence": evidence,
        }


class RubricService:
    @staticmethod
    def evaluate(
        requirements: list[dict[str, Any]], rubric: dict[str, Any] | None, decimal_places: int
    ) -> list[dict[str, Any]]:
        mapping = {
            "CRIT_REQUIRED_SKILL": {
                "JD_REQUIRED_SKILL",
                "JD_CERTIFICATION",
                "JD_LANGUAGE",
                "JD_REQUIRED_QUALIFICATION",
            },
            "CRIT_EXPERIENCE": {"JD_EXPERIENCE", "JD_RESPONSIBILITY"},
            "CRIT_EDUCATION": {"JD_EDUCATION"},
            "CRIT_PREFERRED_SKILL": {"JD_PREFERRED_SKILL", "JD_PREFERRED_QUALIFICATION"},
            "CRIT_DOMAIN": {"JD_DOMAIN"},
        }
        configured = DEFAULT_RUBRIC.copy()
        if rubric:
            supplied = {
                str(item["criterion_id"]): float(item["weight"])
                for item in rubric.get("criteria", [])
                if item.get("enabled", True)
            }
            if supplied:
                if not math.isclose(sum(supplied.values()), 100.0, abs_tol=0.001):
                    raise ValueError("RUBRIC_001: Tổng trọng số criterion đang bật phải bằng 100%.")
                configured = supplied

        active: dict[str, tuple[float, list[dict[str, Any]]]] = {}
        for criterion_id, types in mapping.items():
            items = [item for item in requirements if item["requirement_type"] in types]
            if criterion_id == "CRIT_REQUIRED_SKILL":
                items = [
                    item
                    for item in items
                    if item["requirement_type"] == "JD_REQUIRED_SKILL" or item.get("mandatory")
                ]
            elif criterion_id == "CRIT_PREFERRED_SKILL":
                items.extend(
                    item
                    for item in requirements
                    if item["requirement_type"] in {"JD_CERTIFICATION", "JD_LANGUAGE"}
                    and not item.get("mandatory")
                )
            if items and criterion_id in configured:
                active[criterion_id] = (configured[criterion_id], items)
        total_weight = sum(weight for weight, _ in active.values())
        if total_weight <= 0:
            return []

        criteria = []
        for criterion_id, (base_weight, items) in active.items():
            weight = base_weight / total_weight * 100
            raw = sum(float(item["criterion_score"]) for item in items) / len(items)
            weighted = round(raw / 100 * weight, decimal_places)
            statuses = {item["status"] for item in items}
            status = (
                "SUPPORTED"
                if statuses == {"SUPPORTED"}
                else "NOT_FOUND"
                if statuses <= {"NOT_FOUND", "CONFLICTING"}
                else "UNCERTAIN"
                if statuses == {"UNCERTAIN"}
                else "PARTIALLY_SUPPORTED"
            )
            criteria.append(
                {
                    "criterion_id": criterion_id,
                    "raw_score": round(raw, decimal_places),
                    "weight": round(weight, decimal_places),
                    "weighted_score": weighted,
                    "status": status,
                    "reason": f"{sum(item['status'] == 'SUPPORTED' for item in items)}/{len(items)} requirement được hỗ trợ đầy đủ.",
                    "requirement_ids": [item["requirement_id"] for item in items],
                    "evidence_ids": list(dict.fromkeys(eid for item in items for eid in item["evidence_ids"])),
                }
            )
        # Keep the public invariant exact after weight redistribution rounding.
        if criteria:
            weight_delta = round(100.0 - sum(item["weight"] for item in criteria), decimal_places)
            criteria[-1]["weight"] = round(criteria[-1]["weight"] + weight_delta, decimal_places)
            last_items = active[criteria[-1]["criterion_id"]][1]
            last_raw = sum(float(item["criterion_score"]) for item in last_items) / len(last_items)
            criteria[-1]["weighted_score"] = round(last_raw / 100 * criteria[-1]["weight"], decimal_places)
        return criteria


def _rating(score: float, config: PipelineConfig) -> str:
    if score <= config.rating_poor_max:
        return "POOR"
    if score <= config.rating_average_max:
        return "AVERAGE"
    if score <= config.rating_good_max:
        return "GOOD"
    return "EXCELLENT"


def run_cv_jd_pipeline(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    job_id: str,
    requirements: list[dict[str, Any]],
    rubric: dict[str, Any] | None = None,
    config: PipelineConfig | None = None,
) -> dict[str, Any]:
    config = config or PipelineConfig()
    state_trace = []
    trace_id = _id("TRACE", cv_text, job_id, PIPELINE_VERSION, datetime.now(UTC).isoformat())
    match_id = _id("MATCH", trace_id, datetime.now(UTC).isoformat())
    previous_time = perf_counter()
    previous_at = datetime.now(UTC)

    def trace(step: str) -> None:
        nonlocal previous_at, previous_time
        now_at = datetime.now(UTC)
        now_time = perf_counter()
        state_trace.append(
            {
                "trace_id": trace_id,
                "pipeline_step": step,
                "status": "COMPLETED",
                "start_time": previous_at.isoformat(),
                "end_time": now_at.isoformat(),
                "duration_ms": round((now_time - previous_time) * 1000, 3),
                "error_code": None,
            }
        )
        logger.info(
            "CV-JD pipeline step trace_id=%s match_id=%s job_id=%s pipeline_step=%s "
            "status=COMPLETED start_time=%s end_time=%s duration_ms=%.3f error_code=None",
            trace_id,
            match_id,
            job_id,
            step,
            previous_at.isoformat(),
            now_at.isoformat(),
            (now_time - previous_time) * 1000,
        )
        previous_at = now_at
        previous_time = now_time

    trace("PENDING")
    trace("PARSING")
    trace("EXTRACTING")
    trace("NORMALIZING")
    candidate_id, document_id, chunks = ChunkingService.build(cv_text, parsed_cv)
    trace("CHUNKING")
    retrieval_service = RetrievalService(chunks, config)
    evidence_service = EvidenceService(chunks, config.max_evidence_per_requirement)
    evaluator = EvaluationService(chunks, parsed_cv, config.extraction_min_confidence)
    trace("INDEXING")

    retrieval_results = []
    evidence_all = []
    evaluated = []
    trace("RETRIEVING")
    for requirement in requirements:
        retrieval = retrieval_service.retrieve(requirement)
        evidence = evidence_service.select(requirement, retrieval)
        retrieval_results.append(retrieval)
        evidence_all.extend(evidence)
        evaluated.append(evaluator.evaluate_requirement(dict(requirement), evidence))

    trace("EVALUATING")
    criteria = RubricService.evaluate(evaluated, rubric, config.score_decimal_places)
    final_score = round(sum(item["weighted_score"] for item in criteria), config.score_decimal_places)
    final_score = min(100.0, max(0.0, final_score))
    mandatory_failed = any(
        item.get("mandatory") and item["status"] in {"NOT_FOUND", "CONFLICTING"} for item in evaluated
    )
    warnings = []
    if mandatory_failed:
        warnings.append(
            "Có requirement bắt buộc chưa tìm thấy evidence; đây là cảnh báo, không phải quyết định tuyển/loại."
        )

    groups = {
        "matched": [item for item in evaluated if item["status"] == "SUPPORTED"],
        "partial": [item for item in evaluated if item["status"] == "PARTIALLY_SUPPORTED"],
        "missing": [item for item in evaluated if item["status"] in {"NOT_FOUND", "CONFLICTING"}],
        "uncertain": [item for item in evaluated if item["status"] == "UNCERTAIN"],
    }
    trace("COMPLETED")
    logger.info(
        "CV-JD match completed trace_id=%s match_id=%s candidate_id=%s job_id=%s requirements=%d score=%.1f",
        trace_id,
        match_id,
        candidate_id,
        job_id,
        len(requirements),
        final_score,
    )
    return {
        "trace_id": trace_id,
        "match_id": match_id,
        "candidate_id": candidate_id,
        "job_id": job_id,
        "document_id": document_id,
        "status": "COMPLETED",
        "final_score": final_score,
        "rating": _rating(final_score, config),
        "mandatory_requirement_failed": mandatory_failed,
        "criteria": criteria,
        "requirements": groups,
        "evidence": evidence_all,
        "retrieval_results": retrieval_results,
        "cv_chunks": chunks,
        "embedding_records": [
            {
                "chunk_id": chunk["chunk_id"],
                "model": retrieval_service.embedding.name,
                "dimensions": retrieval_service.embedding.dimensions,
                "vector": {str(key): value for key, value in vector.items()},
            }
            for chunk, vector in zip(chunks, retrieval_service.vector.vectors, strict=True)
        ],
        "structured_cv": normalize_structured_cv(cv_text, parsed_cv),
        "warnings": warnings,
        "versions": {
            "pipeline": PIPELINE_VERSION,
            "cv_schema": SCHEMA_VERSION,
            "jd_schema": SCHEMA_VERSION,
            "normalization": "1.0",
            "chunking": "1.0-structural",
            "embedding_model": retrieval_service.embedding.name,
            "retrieval": "1.0-bm25-vector-rrf",
            "rubric": str((rubric or {}).get("version", "1.0")),
            "scoring": "1.0",
        },
        "processing_trace": state_trace,
        "created_at": datetime.now(UTC).isoformat(),
    }
