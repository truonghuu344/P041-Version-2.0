import sys
import os
import json
import re
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer

try:
    from retrieval.index import VectorIndexManager
except ModuleNotFoundError:
    from index import VectorIndexManager

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class HybridRetriever:
    """Retriever lai (Hybrid Search) kết hợp Dense Vector (ChromaDB 384D) + Sparse BM25/TF-IDF Keyword Search & Reranking"""

    def __init__(self, collection_name: str = "jds_collection"):
        self.collection_name = collection_name
        self.index_manager = VectorIndexManager()
        self.vectorizer = None
        self.tfidf_matrix = None
        self.documents_cache = []
        self._fit_tfidf_indexer()

    def _fit_tfidf_indexer(self):
        """Khởi tạo bộ chỉ mục BM25/TF-IDF cho toàn bộ bản ghi JD sạch"""
        jds_path = "./data/clean/jds_clean.json"
        if not os.path.exists(jds_path):
            return

        with open(jds_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        self.documents_cache = records
        texts = [r.get("embedding_text") or f"{r.get('job_title')} {r.get('company_name')} {' '.join(r.get('must_have_skills', []))}" for r in records]

        if texts:
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
            self.tfidf_matrix = self.vectorizer.fit_transform(texts)
            print(f"✅ Đã dựng chỉ mục BM25/TF-IDF cho {len(texts)} JD tuyển dụng!")

    def bm25_search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Truy xuất từ khóa bằng BM25 / TF-IDF Sparse Search"""
        if not self.vectorizer or self.tfidf_matrix is None or not self.documents_cache:
            return []

        q_vec = self.vectorizer.transform([query])
        scores = (self.tfidf_matrix * q_vec.T).toarray().flatten()

        top_indices = np.argsort(scores)[::-1][:k]
        results = []

        for idx in top_indices:
            score = float(scores[idx])
            if score > 0.0:
                doc = self.documents_cache[idx]
                results.append({
                    "id": doc.get("job_id"),
                    "document": doc.get("embedding_text"),
                    "metadata": {
                        "job_id": doc.get("job_id"),
                        "job_title": doc.get("job_title"),
                        "company_name": doc.get("company_name"),
                        "must_have_skills": doc.get("must_have_skills", [])
                    },
                    "bm25_score": round(score, 4)
                })
        return results

    def hybrid_search(self, query: str, k: int = 3, alpha: float = 0.5) -> List[Dict[str, Any]]:
        """Thực thi Hybrid Search kết hợp RRF (Reciprocal Rank Fusion) và Skill Exact Match Reranking"""
        # 1. Dense Vector Search (Top 2*k)
        dense_hits = self.index_manager.search_similar(query, k=k*2, collection_name=self.collection_name)
        
        # 2. Sparse BM25 Search (Top 2*k)
        sparse_hits = self.bm25_search(query, k=k*2)

        # 3. Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        doc_map = {}

        # Dense RRF
        for rank, hit in enumerate(dense_hits, 1):
            doc_id = hit.get("id") or hit.get("metadata", {}).get("job_id")
            if not doc_id: continue
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (alpha * (1.0 / (60 + rank)))
            doc_map[doc_id] = hit

        # Sparse RRF
        for rank, hit in enumerate(sparse_hits, 1):
            doc_id = hit.get("id") or hit.get("metadata", {}).get("job_id")
            if not doc_id: continue
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + ((1 - alpha) * (1.0 / (60 + rank)))
            if doc_id not in doc_map:
                doc_map[doc_id] = hit

        # 4. Keyword & Metadata Boosting Reranker
        query_words = set(re.findall(r'\w+', query.lower()))
        final_list = []

        for doc_id, score in rrf_scores.items():
            hit = doc_map[doc_id]
            meta = hit.get("metadata", {})
            comp_name = str(meta.get("company_name", "")).lower()
            job_title = str(meta.get("job_title", "")).lower()

            boost = 0.0
            # If exact company name or title words appear in query, boost rank!
            for w in query_words:
                if len(w) > 3 and (w in comp_name or w in job_title):
                    boost += 0.05

            final_score = round(score + boost, 4)
            hit["hybrid_rrf_score"] = final_score
            hit["similarity_score"] = final_score
            final_list.append(hit)

        final_list.sort(key=lambda x: x["hybrid_rrf_score"], reverse=True)
        return final_list[:k]

if __name__ == "__main__":
    retriever = HybridRetriever()
    hits = retriever.hybrid_search("ShopBack Software Engineer Intern Backend", k=3)
    print("HYBRID SEARCH HITS:")
    print(json.dumps(hits, ensure_ascii=False, indent=2))
