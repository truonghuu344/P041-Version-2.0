import sys
import os
import json
import re
import psycopg2
from typing import List, Dict, Any, Optional

try:
    from retrieval.index import VectorIndexManager
except ModuleNotFoundError:
    from index import VectorIndexManager

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "ats_user",
    "password": "ats_password",
    "dbname": "ats_db"
}

class HybridRetriever:
    """Retriever lai (Hybrid Search) hoàn toàn bằng PostgreSQL (pgvector + tsvector)"""

    def __init__(self, collection_name: str = "jds_collection"):
        self.index_manager = VectorIndexManager()

    def hybrid_search(self, query: str, k: int = 3, alpha: float = 0.5) -> List[Dict[str, Any]]:
        """Thực thi Hybrid Search (pgvector + Full text search) + RRF bằng SQL"""
        if not query:
            return []

        query_vec = self.index_manager.embedder.embed_text(query)

        try:
            conn = psycopg2.connect(**PG_CONFIG)
            from psycopg2.extras import RealDictCursor
            from pgvector.psycopg2 import register_vector
            
            register_vector(conn)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            sql_query = """
            WITH vector_search AS (
                SELECT job_id, 
                       1 - (embedding <=> %s::vector) AS vector_score,
                       ROW_NUMBER() OVER(ORDER BY embedding <=> %s::vector) as vector_rank
                FROM mart_jds_final
                WHERE embedding IS NOT NULL
            ),
            keyword_search AS (
                SELECT job_id, 
                       ts_rank_cd(to_tsvector('english', embedding_text), plainto_tsquery('english', %s)) AS bm25_score,
                       ROW_NUMBER() OVER(ORDER BY ts_rank_cd(to_tsvector('english', embedding_text), plainto_tsquery('english', %s)) DESC) as bm25_rank
                FROM mart_jds_final
                WHERE embedding_text IS NOT NULL
            )
            SELECT 
                m.job_id AS id,
                m.embedding_text AS document,
                m.job_title,
                m.company_name,
                m.domain_category,
                m.job_level,
                m.location,
                m.salary_range,
                m.experience_required,
                m.source,
                (%s * (1.0 / (60 + v.vector_rank))) + (%s * COALESCE(1.0 / (60 + k.bm25_rank), 0.0)) AS hybrid_rrf_score
            FROM mart_jds_final m
            JOIN vector_search v ON m.job_id = v.job_id
            LEFT JOIN keyword_search k ON m.job_id = k.job_id
            ORDER BY hybrid_rrf_score DESC
            LIMIT %s;
            """
            
            cursor.execute(sql_query, (query_vec, query_vec, query, query, alpha, 1.0 - alpha, k))
            rows = cursor.fetchall()
            conn.close()
            
            query_words = set(re.findall(r'\w+', query.lower()))
            final_list = []
            
            for row in rows:
                meta = {
                    "job_id": row["id"],
                    "job_title": row["job_title"] or "",
                    "company_name": row["company_name"] or "",
                    "domain_category": row["domain_category"] or "",
                    "job_level": row["job_level"] or "",
                    "salary_range": row["salary_range"] or "",
                    "experience_required": row["experience_required"] or "",
                    "location": row["location"] or "",
                    "source": row["source"] or "JD"
                }
                
                comp_name = str(meta.get("company_name", "")).lower()
                job_title = str(meta.get("job_title", "")).lower()

                boost = 0.0
                for w in query_words:
                    if len(w) > 3 and (w in comp_name or w in job_title):
                        boost += 0.05
                        
                final_score = round(float(row["hybrid_rrf_score"]) + boost, 4)
                
                final_list.append({
                    "id": row["id"],
                    "document": row["document"],
                    "metadata": meta,
                    "similarity_score": final_score,
                    "hybrid_rrf_score": final_score
                })
                
            final_list.sort(key=lambda x: x["hybrid_rrf_score"], reverse=True)
            return final_list
            
        except Exception as e:
            print(f"⚠️ Lỗi PostgreSQL Hybrid Query ({e}).")
            return []

if __name__ == "__main__":
    retriever = HybridRetriever()
    hits = retriever.hybrid_search("ShopBack Software Engineer Intern Backend", k=3)
    print("HYBRID SEARCH HITS:")
    print(json.dumps(hits, ensure_ascii=False, indent=2))
