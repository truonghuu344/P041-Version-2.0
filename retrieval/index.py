import sys
import os
import json
import psycopg2
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional

try:
    from retrieval.embeddings import EmbeddingManager
except ModuleNotFoundError:
    from embeddings import EmbeddingManager

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "ats_user",
    "password": "ats_password",
    "dbname": "ats_db"
}

MANIFEST_PATH = "./data/postgres_manifest.json"

class VectorIndexManager:
    """Tạo & Quản lý Vector Embeddings bằng PostgreSQL (pgvector)"""

    def __init__(self):
        self.embedder = EmbeddingManager()

    def build_jd_index(
        self,
        db_path: str = "./data/app.db",
        collection_name: str = "jds_collection"
    ) -> Dict[str, Any]:
        """Tạo Vector Embeddings (JD) và cập nhật trực tiếp vào cột embedding của bảng mart_jds_final trong PostgreSQL"""
        
        try:
            conn = psycopg2.connect(**PG_CONFIG)
        except Exception as e:
            print(f"❌ Không thể kết nối PostgreSQL: {e}")
            return {}
            
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("SELECT job_id, embedding_text FROM mart_jds_final WHERE embedding_text IS NOT NULL")
            rows = cursor.fetchall()
        except Exception as e:
            print(f"Lỗi truy vấn Data Mart: {e}")
            conn.close()
            return {}

        if not rows:
            print("⚠️ Dữ liệu Data Mart rỗng.")
            return {}

        documents = []
        metadatas = []
        ids = []

        for row in rows:
            job_id = row["job_id"]
            text = row["embedding_text"]
            
            documents.append(text)
            ids.append(job_id)

        print(f"🔄 Đang tạo Vector Embeddings (384D) cho {len(documents)} bản ghi JD tuyển dụng...")
        embeddings = self.embedder.embed_documents(documents)

        # Update embeddings directly into PostgreSQL
        from pgvector.psycopg2 import register_vector
        register_vector(conn)
        
        print("🔄 Đang cập nhật Vector Embeddings vào bảng mart_jds_final...")
        
        update_count = 0
        for i in range(len(ids)):
            try:
                cursor.execute(
                    "UPDATE mart_jds_final SET embedding = %s WHERE job_id = %s",
                    (embeddings[i], ids[i])
                )
                update_count += 1
            except Exception as e:
                print(f"Lỗi khi update vector cho {ids[i]}: {e}")
                
        # Create HNSW index for fast vector search
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS hnsw_idx_jds ON mart_jds_final USING hnsw (embedding vector_cosine_ops)")
        except Exception as e:
            print(f"Lỗi khi tạo index HNSW: {e}")
            
        conn.commit()
        conn.close()
        print(f"✅ Đã nạp thành công {update_count} Vector vào PostgreSQL!")

        # Lưu file manifest cấu hình
        manifest = {
            "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "dataset_type": "Job Descriptions (JDs)",
            "collection_name": collection_name,
            "total_documents": len(ids),
            "embedding_model": self.embedder.model_name,
            "vector_dimension": self.embedder.dimension,
            "storage_path": "PostgreSQL:ats_db",
            "status": "READY"
        }
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        print(f"📄 Đã lưu file Manifest cấu hình tại: {MANIFEST_PATH}")
        return manifest

    def search_similar(
        self,
        query: str,
        k: int = 3,
        collection_name: str = "jds_collection"
    ) -> List[Dict[str, Any]]:
        """Truy xuất TOP-K JD tuyển dụng tương đồng nhất từ PostgreSQL bằng Vector Cosine Similarity"""
        if not query:
            return []

        query_vec = self.embedder.embed_text(query)

        try:
            conn = psycopg2.connect(**PG_CONFIG)
            from psycopg2.extras import RealDictCursor
            from pgvector.psycopg2 import register_vector
            
            register_vector(conn)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Use <=> for Cosine distance in pgvector
            cursor.execute("""
                SELECT 
                    job_id AS id,
                    embedding_text AS document,
                    job_title,
                    company_name,
                    domain_category,
                    job_level,
                    location,
                    salary_range,
                    experience_required,
                    source,
                    1 - (embedding <=> %s) AS similarity_score
                FROM mart_jds_final
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> %s
                LIMIT %s
            """, (query_vec, query_vec, k))
            
            rows = cursor.fetchall()
            conn.close()
            
            results = []
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
                
                results.append({
                    "id": row["id"],
                    "document": row["document"],
                    "metadata": meta,
                    "similarity_score": round(row["similarity_score"], 4)
                })
            
            return results
        except Exception as e:
            print(f"⚠️ Lỗi PostgreSQL Vector Query ({e}).")
            return []

if __name__ == "__main__":
    indexer = VectorIndexManager()
    indexer.build_jd_index()
    q = "Tuyển Lập trình viên Backend Java Spring Boot"
    hits = indexer.search_similar(q, k=2)
    print(f"\n🔍 Kết quả tìm kiếm JD cho query: '{q}'")
    print(json.dumps(hits, ensure_ascii=False, indent=2))
