import sys
from typing import Any

try:
    from retrieval.llm import LLMClient
    from retrieval.retriever import HybridRetriever
except ModuleNotFoundError:
    from llm import LLMClient
    from retriever import HybridRetriever

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class QAPipeline:
    """Pipeline Q&A hoàn chỉnh cho JD (Phase 2): Kết hợp Hybrid Search (BM25 + Dense Vector + Reranking) & LLM Response Engine"""

    def __init__(self, collection_name: str = "jds_collection"):
        self.collection_name = collection_name
        self.retriever = HybridRetriever(collection_name=collection_name)
        self.llm_client = LLMClient()

    def answer_question(self, question: str, top_k: int = 3) -> dict[str, Any]:
        """Truy xuất context tương đồng nhất qua Hybrid Search và gọi LLM sinh câu trả lời"""
        print(f"\n❓ [Phase 2 Hybrid Q&A] Đang xử lý câu hỏi: '{question}'...")

        # 1. Hybrid Search (Dense 384D + Sparse BM25 + RRF Reranking)
        retrieved_docs = self.retriever.hybrid_search(
            query=question,
            k=top_k
        )

        if not retrieved_docs:
            print("⚠️ Không tìm thấy JD tuyển dụng liên quan.")
            return {
                "question": question,
                "answer": "Không tìm thấy dữ liệu JD tuyển dụng liên quan trong cơ sở dữ liệu.",
                "retrieved_documents": [],
                "confidence_score": 0.0
            }

        # 2. Call LLM RAG Response Generator
        answer = self.llm_client.generate_rag_response(question, retrieved_docs)
        top_score = retrieved_docs[0].get("similarity_score", 0.0) if retrieved_docs else 0.0

        result = {
            "question": question,
            "answer": answer,
            "retrieved_documents": retrieved_docs,
            "confidence_score": top_score
        }

        print(f"✅ Trả lời Phase 2 thành công (Hybrid Score: {top_score})!")
        return result

if __name__ == "__main__":
    qa = QAPipeline(collection_name="jds_collection")
    res = qa.answer_question("Vị trí Software Engineer Intern - Backend tại ShopBack yêu cầu kỹ năng gì?", top_k=2)
    print("\n--- KẾT QUẢ PHASE 2 Q&A PIPELINE ---")
    print("Câu hỏi:", res["question"])
    print("Câu trả lời:", res["answer"])
