import sys
import os
import math
import numpy as np
from typing import List, Union

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

class EmbeddingManager:
    """Quản lý mô hình nhúng cục bộ (Local Embedding) sentence-transformers/all-MiniLM-L6-v2 (Vector 384 chiều)"""

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME):
        self.model_name = model_name
        self.dimension = EMBEDDING_DIMENSION
        self._model = None
        self._is_sentence_transformers_available = False
        self._init_model()

    def _init_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            print(f"🔄 Đang tải mô hình nhúng cục bộ: {self.model_name}...")
            self._model = SentenceTransformer(self.model_name)
            self._is_sentence_transformers_available = True
            print(f"✅ Mô hình nhúng {self.model_name} (Vector {self.dimension}D) đã sẵn sàng!")
        except Exception as e:
            print(f"⚠️ Chưa thể nạp mô hình SentenceTransformer ({e}). Sử dụng mô hình nhúng dự phòng (Fallback Hash Vector 384D).")
            self._is_sentence_transformers_available = False

    def _fallback_hash_embed(self, text: str) -> List[float]:
        """Tạo vector 384 chiều dự phòng dựa trên thuật toán Hash & TF Normalization"""
        vec = np.zeros(EMBEDDING_DIMENSION, dtype=np.float32)
        words = text.lower().split()
        if not words:
            return vec.tolist()

        for idx, word in enumerate(words):
            h = hash(word)
            pos = abs(h) % EMBEDDING_DIMENSION
            sign = 1.0 if (h >> 3) % 2 == 0 else -1.0
            weight = 1.0 + (1.0 / (idx + 1))
            vec[pos] += sign * weight

        norm = np.linalg.norm(vec)
        if norm > 1e-6:
            vec = vec / norm
        return vec.tolist()

    def embed_text(self, text: str) -> List[float]:
        """Đổi 1 đoạn văn bản thành vector 384 chiều"""
        if not text:
            return [0.0] * self.dimension

        if self._is_sentence_transformers_available and self._model is not None:
            try:
                embedding = self._model.encode(text, convert_to_numpy=True)
                return embedding.tolist()
            except Exception as e:
                print(f"⚠️ Lỗi khi encode vector bằng SentenceTransformer: {e}")

        return self._fallback_hash_embed(text)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Đổi danh sách văn bản thành danh sách vector 384 chiều"""
        if not texts:
            return []

        if self._is_sentence_transformers_available and self._model is not None:
            try:
                embeddings = self._model.encode(texts, convert_to_numpy=True, batch_size=32)
                return embeddings.tolist()
            except Exception as e:
                print(f"⚠️ Lỗi khi batch encode vectors: {e}")

        return [self._fallback_hash_embed(t) for t in texts]

if __name__ == "__main__":
    embedder = EmbeddingManager()
    sample_text = "Software Engineer Intern - Backend Java Spring Boot"
    vec = embedder.embed_text(sample_text)
    print(f"Đoạn văn: '{sample_text}'")
    print(f"Độ dài Vector: {len(vec)} chiều")
    print(f"Mẫu 5 phần tử đầu: {vec[:5]}")
