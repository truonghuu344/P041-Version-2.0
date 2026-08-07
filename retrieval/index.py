import sys
import os
import json
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional

try:
    from retrieval.embeddings import EmbeddingManager
except ModuleNotFoundError:
    from embeddings import EmbeddingManager

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CHROMA_DB_DIR = "./chroma_db"
MANIFEST_PATH = os.path.join(CHROMA_DB_DIR, "manifest.json")

class VectorIndexManager:
    """Tạo & Quản lý Cơ sở dữ liệu Vector ChromaDB cho tập dữ liệu JD (Job Descriptions)"""

    def __init__(self, chroma_dir: str = CHROMA_DB_DIR):
        self.chroma_dir = chroma_dir
        os.makedirs(self.chroma_dir, exist_ok=True)
        self.embedder = EmbeddingManager()
        self.client = None
        self._is_chroma_available = False
        self._init_chroma()

    def _init_chroma(self):
        try:
            import chromadb
            print(f"🔄 Đang kết nối ChromaDB Persistent Client tại: {self.chroma_dir}")
            self.client = chromadb.PersistentClient(path=self.chroma_dir)
            self._is_chroma_available = True
            print("✅ Kết nối ChromaDB thành công!")
        except Exception as e:
            print(f"⚠️ Chưa thể khởi tạo ChromaDB Native Client ({e}). Sử dụng cơ sở dữ liệu Vector Store dạng JSON fallback.")
            self._is_chroma_available = False

    def build_jd_index(
        self,
        clean_json_path: str = "./data/clean/jds_clean.json",
        collection_name: str = "jds_collection"
    ) -> Dict[str, Any]:
        """Nạp dữ liệu Job Descriptions (JD) đã làm sạch vào ChromaDB và tạo manifest.json"""
        if not os.path.exists(clean_json_path):
            print(f"❌ Không tìm thấy file dữ liệu JD sạch: {clean_json_path}")
            return {}

        with open(clean_json_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        if not records:
            print("⚠️ Dữ liệu JD rỗng.")
            return {}

        documents = []
        metadatas = []
        ids = []

        for item in records:
            job_id = item.get("job_id") or f"JD-{len(ids)+1:03d}"
            text = item.get("embedding_text") or f"Job Title: {item.get('job_title')} | Company: {item.get('company_name')} | Must Have Skills: {', '.join(item.get('must_have_skills', []))}"
            
            documents.append(text)
            ids.append(job_id)
            metadatas.append({
                "job_id": job_id,
                "job_title": item.get("job_title", ""),
                "company_name": item.get("company_name", ""),
                "domain_category": item.get("domain_category", ""),
                "job_level": item.get("job_level", ""),
                "salary_range": item.get("salary_range", ""),
                "experience_required": item.get("experience_required", ""),
                "location": ", ".join(item.get("location", [])),
                "source": item.get("source", "JD")
            })

        print(f"🔄 Đang tạo Vector Embeddings (384D) cho {len(documents)} bản ghi JD tuyển dụng...")
        embeddings = self.embedder.embed_documents(documents)

        if self._is_chroma_available and self.client:
            collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            # Upsert into ChromaDB
            collection.upsert(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            print(f"✅ Đã nạp thành công {len(ids)} JD tuyển dụng vào ChromaDB collection '{collection_name}'!")
        else:
            # Persistent JSON fallback vector store
            fallback_store_path = os.path.join(self.chroma_dir, f"{collection_name}_fallback.json")
            fallback_data = [
                {"id": ids[i], "document": documents[i], "metadata": metadatas[i], "embedding": embeddings[i]}
                for i in range(len(ids))
            ]
            with open(fallback_store_path, "w", encoding="utf-8") as f:
                json.dump(fallback_data, f, ensure_ascii=False, indent=2)

        # Lưu file manifest cấu hình
        manifest = {
            "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "dataset_type": "Job Descriptions (JDs)",
            "collection_name": collection_name,
            "total_documents": len(ids),
            "embedding_model": self.embedder.model_name,
            "vector_dimension": self.embedder.dimension,
            "storage_path": self.chroma_dir,
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
        """Truy xuất TOP-K JD tuyển dụng tương đồng nhất từ ChromaDB"""
        if not query:
            return []

        query_vec = self.embedder.embed_text(query)

        if self._is_chroma_available and self.client:
            try:
                collection = self.client.get_collection(name=collection_name)
                res = collection.query(
                    query_embeddings=[query_vec],
                    n_results=k,
                    include=["documents", "metadatas", "distances"]
                )
                results = []
                if res and "ids" in res and res["ids"]:
                    for i in range(len(res["ids"][0])):
                        dist = res["distances"][0][i] if "distances" in res else 0.0
                        score = round(1.0 - dist, 4) if dist <= 1.0 else round(1.0 / (1.0 + dist), 4)
                        results.append({
                            "id": res["ids"][0][i],
                            "document": res["documents"][0][i],
                            "metadata": res["metadatas"][0][i],
                            "similarity_score": score
                        })
                return results
            except Exception as e:
                print(f"⚠️ Lỗi ChromaDB Query ({e}). Chuyển sang fallback Cosine Similarity.")

        # Fallback Vector Search
        fallback_store_path = os.path.join(self.chroma_dir, f"{collection_name}_fallback.json")
        if not os.path.exists(fallback_store_path):
            return []

        with open(fallback_store_path, "r", encoding="utf-8") as f:
            store_data = json.load(f)

        q_arr = np.array(query_vec, dtype=np.float32)
        q_norm = np.linalg.norm(q_arr)

        scored = []
        for item in store_data:
            doc_arr = np.array(item["embedding"], dtype=np.float32)
            doc_norm = np.linalg.norm(doc_arr)
            score = 0.0
            if q_norm > 1e-6 and doc_norm > 1e-6:
                score = float(np.dot(q_arr, doc_arr) / (q_norm * doc_norm))
            scored.append({
                "id": item["id"],
                "document": item["document"],
                "metadata": item["metadata"],
                "similarity_score": round(score, 4)
            })

        scored.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored[:k]

if __name__ == "__main__":
    indexer = VectorIndexManager()
    indexer.build_jd_index()
    q = "Tuyển Lập trình viên Backend Java Spring Boot"
    hits = indexer.search_similar(q, k=2)
    print(f"\n🔍 Kết quả tìm kiếm JD cho query: '{q}'")
    print(json.dumps(hits, ensure_ascii=False, indent=2))
