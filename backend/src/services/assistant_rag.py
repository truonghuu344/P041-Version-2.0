from __future__ import annotations

import hashlib
import logging
import math
import re
import unicodedata
from collections import OrderedDict
from collections.abc import Sequence
from dataclasses import dataclass, field
from time import monotonic
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings, get_settings
from src.db.models import AssistantDocumentEmbedding
from src.services.job_rag import EmbeddingProvider, GeminiEmbeddingProvider, HashingEmbeddingProvider

logger = logging.getLogger(__name__)


@dataclass
class DocumentSectionChunk:
    section_name: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievedChunk:
    id: str
    source_id: str
    source_type: str
    source_title: str
    section_name: str
    content: str
    score: float
    metadata: dict[str, Any] = field(default_factory=dict)


def _content_hash(text_val: str) -> str:
    return hashlib.sha256(text_val.strip().encode("utf-8")).hexdigest()


def _normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", without_marks).strip()


def _clean_item_text(item: Any) -> str:
    """Chuyển đổi an toàn và làm sạch cấu trúc dữ liệu thành văn bản tự nhiên, loại bỏ ID nội bộ và số liệu thô."""
    if item is None:
        return ""
    if isinstance(item, str):
        # Loại bỏ các chuỗi ID nội bộ như JD_REQ_001_..., responsibility-...
        cleaned = re.sub(r"\bJD_REQ_\w+\b", "", item)
        cleaned = re.sub(r"\bresponsibility-\w+\b", "", cleaned)
        cleaned = re.sub(r"\b(?:True|False)\s+(?:high|low|medium)\b", "", cleaned, flags=re.IGNORECASE)
        return " ".join(cleaned.split()).strip()
    if isinstance(item, (int, float)):
        return str(item)
    if isinstance(item, dict):
        # Trích xuất trường text chính của requirement/responsibility
        text = (
            item.get("requirement")
            or item.get("description")
            or item.get("text")
            or item.get("content")
            or item.get("name")
            or item.get("title")
            or item.get("duty")
        )
        if text and isinstance(text, str):
            return _clean_item_text(text)
        meaningful = []
        for k, v in item.items():
            if k in {"id", "weight", "is_mandatory", "level", "index", "code", "requirement_type"}:
                continue
            if isinstance(v, str) and len(v.strip()) > 3 and not v.startswith("JD_REQ_"):
                meaningful.append(_clean_item_text(v))
        return "; ".join(m for m in meaningful if m)
    if isinstance(item, (list, tuple, set)):
        items = [_clean_item_text(sub) for sub in item]
        return ", ".join(i for i in items if i)
    return str(item).strip()


def chunk_cv_sections(
    title: str,
    raw_text: str | None,
    parsed_json: dict[str, Any] | None = None,
) -> list[DocumentSectionChunk]:
    """Phân rã CV thành các khối ngữ nghĩa ngắn gọn: summary, skills, experience, projects, education."""
    chunks: list[DocumentSectionChunk] = []
    parsed = parsed_json or {}

    # 1. Summary / Overview
    summary_val = parsed.get("summary") or parsed.get("objective") or parsed.get("bio")
    summary = _clean_item_text(summary_val)
    if len(summary) > 10:
        clean_summary = summary if len(summary) <= 300 else f"{summary[:297].rstrip()}..."
        chunks.append(DocumentSectionChunk(
            section_name="summary",
            content=f"Tóm tắt hồ sơ ({title}): {clean_summary}",
            metadata={"type": "summary", "title": title},
        ))

    # 2. Skills
    skills_val = parsed.get("skills") or parsed.get("technical_skills")
    if skills_val:
        skill_text = _clean_item_text(skills_val)
        if len(skill_text) > 5:
            clean_skills = skill_text if len(skill_text) <= 250 else f"{skill_text[:247].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="skills",
                content=f"Kỹ năng chuyên môn ({title}): {clean_skills}",
                metadata={"type": "skills", "title": title},
            ))

    # 3. Work Experience
    experiences = parsed.get("experience") or parsed.get("work_experience") or []
    if isinstance(experiences, list):
        for idx, exp in enumerate(experiences[:4], start=1):
            if isinstance(exp, dict):
                role = _clean_item_text(exp.get("role") or exp.get("position") or exp.get("title") or "Vị trí")
                company = _clean_item_text(exp.get("company") or exp.get("organization") or "")
                duration = _clean_item_text(exp.get("duration") or exp.get("time") or exp.get("period") or "")
                desc = _clean_item_text(exp.get("description") or exp.get("responsibilities") or exp.get("details") or "")
                if len(desc) > 200:
                    desc = f"{desc[:197].rstrip()}..."
                exp_text = f"Kinh nghiệm tại {company} ({duration}) - {role}: {desc}".strip()
                if len(exp_text) > 15:
                    chunks.append(DocumentSectionChunk(
                        section_name="experience",
                        content=exp_text,
                        metadata={"type": "experience", "index": idx, "company": company, "role": role},
                    ))
            elif isinstance(exp, str) and len(exp.strip()) > 15:
                cleaned_str = _clean_item_text(exp)
                if len(cleaned_str) > 250:
                    cleaned_str = f"{cleaned_str[:247].rstrip()}..."
                chunks.append(DocumentSectionChunk(
                    section_name="experience",
                    content=f"Kinh nghiệm làm việc: {cleaned_str}",
                    metadata={"type": "experience", "index": idx},
                ))

    # 4. Projects
    projects = parsed.get("projects") or parsed.get("personal_projects") or []
    if isinstance(projects, list):
        for idx, proj in enumerate(projects[:3], start=1):
            if isinstance(proj, dict):
                p_name = _clean_item_text(proj.get("name") or proj.get("title") or f"Dự án {idx}")
                tech = _clean_item_text(proj.get("technologies") or proj.get("tech_stack") or "")
                desc = _clean_item_text(proj.get("description") or proj.get("details") or "")
                if len(desc) > 200:
                    desc = f"{desc[:197].rstrip()}..."
                proj_text = f"Dự án {p_name} (Công nghệ: {tech}): {desc}".strip()
                if len(proj_text) > 15:
                    chunks.append(DocumentSectionChunk(
                        section_name="projects",
                        content=proj_text,
                        metadata={"type": "projects", "index": idx, "name": p_name},
                    ))
            elif isinstance(proj, str) and len(proj.strip()) > 15:
                cleaned_proj = _clean_item_text(proj)
                if len(cleaned_proj) > 250:
                    cleaned_proj = f"{cleaned_proj[:247].rstrip()}..."
                chunks.append(DocumentSectionChunk(
                    section_name="projects",
                    content=f"Dự án: {cleaned_proj}",
                    metadata={"type": "projects", "index": idx},
                ))

    # 5. Education & Certifications
    education = parsed.get("education") or []
    if education:
        edu_text = _clean_item_text(education)
        if len(edu_text.strip()) > 10:
            clean_edu = edu_text if len(edu_text) <= 220 else f"{edu_text[:217].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="education",
                content=f"Học vấn & Bằng cấp ({title}): {clean_edu}",
                metadata={"type": "education", "title": title},
            ))

    # Fallback to paragraph parsing from raw_text if parsed_json was sparse
    if not chunks and raw_text and len(raw_text.strip()) > 20:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw_text) if len(p.strip()) > 20]
        for idx, para in enumerate(paragraphs[:3], start=1):
            clean_para = _clean_item_text(para)
            if len(clean_para) > 250:
                clean_para = f"{clean_para[:247].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="general",
                content=f"Nội dung CV ({title}) đoạn {idx}: {clean_para}",
                metadata={"type": "raw_paragraph", "index": idx},
            ))

    return chunks


def chunk_jd_sections(
    title: str,
    company: str | None,
    requirements_text: str | None,
    normalized_json: dict[str, Any] | None = None,
) -> list[DocumentSectionChunk]:
    """Phân rã JD thành các khối ngữ nghĩa ngắn gọn, sạch sẽ: overview, responsibilities, must_have, nice_to_have, benefits."""
    chunks: list[DocumentSectionChunk] = []
    comp = company or "Doanh nghiệp"
    norm = normalized_json or {}

    # 1. Overview
    overview_val = norm.get("overview") or norm.get("description")
    overview = _clean_item_text(overview_val)
    if len(overview) > 10:
        clean_overview = overview if len(overview) <= 280 else f"{overview[:277].rstrip()}..."
        chunks.append(DocumentSectionChunk(
            section_name="overview",
            content=f"Tổng quan vị trí {title} tại {comp}: {clean_overview}",
            metadata={"type": "overview", "title": title, "company": comp},
        ))

    # 2. Responsibilities
    resp_val = norm.get("responsibilities") or norm.get("duties")
    if resp_val:
        if isinstance(resp_val, list):
            items = [_clean_item_text(item) for item in resp_val[:5]]
            resp_text = "; ".join(i for i in items if i)
        else:
            resp_text = _clean_item_text(resp_val)
        if len(resp_text) > 10:
            clean_resp = resp_text if len(resp_text) <= 300 else f"{resp_text[:297].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="responsibilities",
                content=f"Trách nhiệm công việc ({title} - {comp}): {clean_resp}",
                metadata={"type": "responsibilities", "title": title, "company": comp},
            ))

    # 3. Must-Have Requirements
    must_have_val = norm.get("must_have") or norm.get("requirements") or norm.get("required_skills")
    if must_have_val:
        if isinstance(must_have_val, list):
            items = [_clean_item_text(item) for item in must_have_val[:5]]
            must_text = "; ".join(i for i in items if i)
        else:
            must_text = _clean_item_text(must_have_val)
        if len(must_text) > 10:
            clean_must = must_text if len(must_text) <= 300 else f"{must_text[:297].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="must_have",
                content=f"Yêu cầu bắt buộc ({title} - {comp}): {clean_must}",
                metadata={"type": "must_have", "title": title, "company": comp},
            ))

    # 4. Nice-to-Have
    nice_to_have_val = norm.get("nice_to_have") or norm.get("preferred_skills")
    if nice_to_have_val:
        if isinstance(nice_to_have_val, list):
            items = [_clean_item_text(item) for item in nice_to_have_val[:4]]
            nice_text = "; ".join(i for i in items if i)
        else:
            nice_text = _clean_item_text(nice_to_have_val)
        if len(nice_text) > 10:
            clean_nice = nice_text if len(nice_text) <= 250 else f"{nice_text[:247].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="nice_to_have",
                content=f"Yêu cầu ưu tiên ({title} - {comp}): {clean_nice}",
                metadata={"type": "nice_to_have", "title": title, "company": comp},
            ))

    # 5. Benefits & Salary
    benefits_val = norm.get("benefits") or norm.get("perks") or norm.get("compensation")
    salary_min = norm.get("salary_min")
    salary_max = norm.get("salary_max")
    salary_info = f"Mức lương: {salary_min} - {salary_max}. " if salary_min or salary_max else ""
    ben_text = _clean_item_text(benefits_val)
    if ben_text or salary_info:
        full_ben = f"{salary_info}{ben_text}".strip()
        clean_ben = full_ben if len(full_ben) <= 250 else f"{full_ben[:247].rstrip()}..."
        chunks.append(DocumentSectionChunk(
            section_name="benefits",
            content=f"Quyền lợi & Đãi ngộ ({title} - {comp}): {clean_ben}",
            metadata={"type": "benefits", "title": title, "company": comp},
        ))

    # Fallback to requirements_text paragraphs if structured sections are not available
    if not chunks and requirements_text and len(requirements_text.strip()) > 20:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", requirements_text) if len(p.strip()) > 20]
        for idx, para in enumerate(paragraphs[:3], start=1):
            clean_para = _clean_item_text(para)
            if len(clean_para) > 250:
                clean_para = f"{clean_para[:247].rstrip()}..."
            chunks.append(DocumentSectionChunk(
                section_name="requirements",
                content=f"Mô tả yêu cầu {title} ({comp}) phần {idx}: {clean_para}",
                metadata={"type": "requirements", "index": idx},
            ))

    return chunks


def _cosine_similarity(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b, strict=False))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm_a * norm_b)))


class AssistantRAGService:
    """Service chịu trách nhiệm quản lý Indexing, Hybrid Search và Phân tầng (Cascading) cho Chatbot."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.embedding_provider = self._build_embedding_provider()
        self._search_cache: OrderedDict[tuple[Any, ...], tuple[float, list[RetrievedChunk]]] = OrderedDict()
        self._search_cache_ttl_seconds = 45.0
        self._search_cache_max_entries = 256

    def _invalidate_user_cache(self, user_id: str) -> None:
        for key in [key for key in self._search_cache if key[0] == user_id]:
            self._search_cache.pop(key, None)

    def _build_embedding_provider(self) -> EmbeddingProvider:
        if self.settings.vector_embedding_provider == "gemini" or (
            self.settings.vector_embedding_provider == "auto" and self.settings.google_genai_api_key
        ):
            return GeminiEmbeddingProvider(
                api_key=self.settings.google_genai_api_key,
                model_name=self.settings.vector_embedding_model,
                vector_size=self.settings.vector_dimensions,
            )
        return HashingEmbeddingProvider(vector_size=self.settings.vector_dimensions)

    async def index_cv(
        self,
        session: AsyncSession,
        user_id: str,
        cv_id: str,
        title: str,
        raw_text: str | None,
        parsed_json: dict[str, Any] | None = None,
    ) -> int:
        """Phân đoạn và lưu vector embedding cho CV vào database."""
        self._invalidate_user_cache(user_id)
        chunks = chunk_cv_sections(title=title, raw_text=raw_text, parsed_json=parsed_json)
        if not chunks:
            return 0

        # Xóa các embeddings cũ của CV này để re-index
        await session.execute(
            delete(AssistantDocumentEmbedding).where(
                AssistantDocumentEmbedding.user_id == user_id,
                AssistantDocumentEmbedding.source_id == cv_id,
                AssistantDocumentEmbedding.source_type == "cv",
            )
        )

        texts = [chunk.content for chunk in chunks]
        vectors = await self.embedding_provider.embed_documents(texts)

        for chunk, vector in zip(chunks, vectors, strict=False):
            record = AssistantDocumentEmbedding(
                user_id=user_id,
                source_id=cv_id,
                source_type="cv",
                source_title=title,
                section_name=chunk.section_name,
                content=chunk.content,
                content_hash=_content_hash(chunk.content),
                embedding_provider=self.embedding_provider.name,
                embedding=vector,
                metadata_json=chunk.metadata,
            )
            session.add(record)

        await session.flush()
        return len(chunks)

    async def index_jd(
        self,
        session: AsyncSession,
        user_id: str,
        jd_id: str,
        title: str,
        company: str | None,
        requirements_text: str | None,
        normalized_json: dict[str, Any] | None = None,
    ) -> int:
        """Phân đoạn và lưu vector embedding cho JD vào database."""
        self._invalidate_user_cache(user_id)
        chunks = chunk_jd_sections(
            title=title,
            company=company,
            requirements_text=requirements_text,
            normalized_json=normalized_json,
        )
        if not chunks:
            return 0

        await session.execute(
            delete(AssistantDocumentEmbedding).where(
                AssistantDocumentEmbedding.user_id == user_id,
                AssistantDocumentEmbedding.source_id == jd_id,
                AssistantDocumentEmbedding.source_type == "jd",
            )
        )

        texts = [chunk.content for chunk in chunks]
        vectors = await self.embedding_provider.embed_documents(texts)

        for chunk, vector in zip(chunks, vectors, strict=False):
            record = AssistantDocumentEmbedding(
                user_id=user_id,
                source_id=jd_id,
                source_type="jd",
                source_title=title,
                section_name=chunk.section_name,
                content=chunk.content,
                content_hash=_content_hash(chunk.content),
                embedding_provider=self.embedding_provider.name,
                embedding=vector,
                metadata_json=chunk.metadata,
            )
            session.add(record)

        await session.flush()
        return len(chunks)

    async def search(
        self,
        session: AsyncSession,
        user_id: str,
        query: str,
        top_k: int = 4,
        source_types: list[str] | None = None,
    ) -> list[RetrievedChunk]:
        """Tìm kiếm Hybrid (Semantic Vector + Lexical Match) có lọc theo user_id."""
        query_text = query.strip()
        if not query_text:
            return []

        cache_key = (
            user_id,
            _normalize_text(query_text),
            top_k,
            tuple(sorted(source_types or [])),
            self.embedding_provider.name,
        )
        cached = self._search_cache.get(cache_key)
        now = monotonic()
        if cached and now - cached[0] <= self._search_cache_ttl_seconds:
            self._search_cache.move_to_end(cache_key)
            return list(cached[1])
        if cached:
            self._search_cache.pop(cache_key, None)

        query_vector = await self.embedding_provider.embed_query(query_text)
        normalized_q = _normalize_text(query_text)
        keywords = set(re.findall(r"[a-z0-9+#.]{2,}", normalized_q))

        # Query all candidate embeddings for this user
        stmt = select(AssistantDocumentEmbedding).where(
            AssistantDocumentEmbedding.user_id == user_id
        )
        if source_types:
            stmt = stmt.where(AssistantDocumentEmbedding.source_type.in_(source_types))

        result = await session.execute(stmt)
        candidates = list(result.scalars().all())

        if not candidates:
            return []

        scored_items: list[tuple[float, AssistantDocumentEmbedding]] = []
        for cand in candidates:
            # 1. Cosine similarity
            sem_score = _cosine_similarity(query_vector, cand.embedding)

            # 2. Keyword overlap score
            cand_norm = _normalize_text(cand.content)
            cand_words = set(re.findall(r"[a-z0-9+#.]{2,}", cand_norm))
            kw_match_count = len(keywords.intersection(cand_words))
            kw_score = min(1.0, kw_match_count / max(1, len(keywords))) if keywords else 0.0

            # 3. Hybrid fusion score (0.75 semantic + 0.25 lexical)
            hybrid_score = (0.75 * sem_score) + (0.25 * kw_score)
            scored_items.append((hybrid_score, cand))

        scored_items.sort(key=lambda x: x[0], reverse=True)
        top_items = scored_items[:top_k]

        retrieved = [
            RetrievedChunk(
                id=cand.id,
                source_id=cand.source_id,
                source_type=cand.source_type,
                source_title=cand.source_title,
                section_name=cand.section_name,
                content=cand.content,
                score=round(score, 4),
                metadata=cand.metadata_json or {},
            )
            for score, cand in top_items
        ]
        self._search_cache[cache_key] = (now, retrieved)
        self._search_cache.move_to_end(cache_key)
        while len(self._search_cache) > self._search_cache_max_entries:
            self._search_cache.popitem(last=False)
        return list(retrieved)

    async def delete_cv_embeddings(
        self,
        session: AsyncSession,
        user_id: str,
        cv_id: str,
    ) -> int:
        """Xóa toàn bộ embeddings liên quan đến một CV."""
        self._invalidate_user_cache(user_id)
        stmt = delete(AssistantDocumentEmbedding).where(
            AssistantDocumentEmbedding.user_id == user_id,
            AssistantDocumentEmbedding.source_id == cv_id,
            AssistantDocumentEmbedding.source_type == "cv",
        )
        res = await session.execute(stmt)
        await session.flush()
        return res.rowcount or 0

    async def delete_jd_embeddings(
        self,
        session: AsyncSession,
        user_id: str,
        jd_id: str,
    ) -> int:
        """Xóa toàn bộ embeddings liên quan đến một JD."""
        self._invalidate_user_cache(user_id)
        stmt = delete(AssistantDocumentEmbedding).where(
            AssistantDocumentEmbedding.user_id == user_id,
            AssistantDocumentEmbedding.source_id == jd_id,
            AssistantDocumentEmbedding.source_type == "jd",
        )
        res = await session.execute(stmt)
        await session.flush()
        return res.rowcount or 0

    def evaluate_cascading_decision(
        self,
        query: str,
        retrieved_chunks: list[Any],
    ) -> tuple[str, str | None]:
        """Đánh giá phân tầng (Cascading Decision):
        - Tier 2 (Extractive Fact): Trả về câu trả lời trích xuất trực tiếp (0đ token LLM).
        - Tier 3 (Generative Reasoning): Trả về prompt context để Gemini phân tích chuyên sâu.
        - None: Không có context phù hợp.
        """
        if not retrieved_chunks:
            return "none", None

        def _get_val(c: Any, key: str, default: Any = None) -> Any:
            if isinstance(c, dict):
                return c.get(key, default)
            return getattr(c, key, default)

        top_chunk = retrieved_chunks[0]
        score = float(_get_val(top_chunk, "score", 0.0) or 0.0)
        source_title = str(_get_val(top_chunk, "source_title", "Tài liệu"))
        source_type = str(_get_val(top_chunk, "source_type", "document"))
        section_name = str(_get_val(top_chunk, "section_name", "Nội dung"))
        content = str(_get_val(top_chunk, "content", "")).strip()

        norm_query = _normalize_text(query)

        # Danh sách intent cần suy luận / tư vấn / so sánh / đóng vai -> Bắt buộc vào Tier 3 (LLM)
        reasoning_keywords = (
            "so sanh", "khuyen toi", "lo trinh", "tu van", "nen hoc gi",
            "cai thien", "danh gia", "phong van", "viet lai", "hoi gi",
            "diem manh", "diem yeu", "tai sao", "chien luoc", "goi y",
            "mock interview", "star", "chuan bi gi", "giup toi viet",
            "nang cap", "toi uu", "danh gia ho", "nhan xet"
        )
        is_reasoning_intent = any(kw in norm_query for kw in reasoning_keywords)

        # Nếu là câu hỏi dữ kiện tra cứu (Factual Query) và độ tương đồng cao (>= 0.72)
        # -> Tier 2: Trả về kết quả trích xuất trực tiếp KHÔNG cần gọi LLM
        if not is_reasoning_intent and score >= 0.72:
            source_badge = f"CV: {source_title}" if source_type == "cv" else f"JD: {source_title}"
            section_display = {
                "skills": "Kỹ năng chuyên môn",
                "experience": "Kinh nghiệm làm việc",
                "projects": "Dự án thực tế",
                "education": "Học vấn & Bằng cấp",
                "summary": "Tóm tắt hồ sơ",
                "must_have": "Yêu cầu bắt buộc",
                "nice_to_have": "Yêu cầu ưu tiên",
                "benefits": "Quyền lợi & Lương thưởng",
                "responsibilities": "Trách nhiệm công việc",
                "overview": "Tổng quan vị trí",
            }.get(section_name, section_name)

            clean_snippet = content
            if len(clean_snippet) > 220:
                clean_snippet = f"{clean_snippet[:217].rstrip()}..."

            direct_answer = (
                "**Kết luận**\n\n"
                f"- Đã tìm thấy thông tin liên quan trong **{source_badge}**.\n\n"
                "**Bằng chứng**\n\n"
                f"> {clean_snippet}\n\n"
                f"- Mục: *{section_display}* · Độ khớp: **{int(score * 100)}%**\n\n"
                "**Bước tiếp theo**\n\n"
                "- Bạn có thể yêu cầu Nova đối chiếu thông tin này với một JD cụ thể."
            )
            return "tier2_extractive", direct_answer

        # Ngược lại, chuyển sang Tier 3: Ghép context vào cho LLM phân tích
        return "tier3_generative", None


_assistant_rag_service: AssistantRAGService | None = None


def get_assistant_rag_service(settings: Settings | None = None) -> AssistantRAGService:
    global _assistant_rag_service
    if _assistant_rag_service is None:
        _assistant_rag_service = AssistantRAGService(settings=settings)
    return _assistant_rag_service
