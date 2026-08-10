import sys
from typing import Any

try:
    from retrieval.llm import LLMClient
    from retrieval.qa import QAPipeline
except ModuleNotFoundError:
    from llm import LLMClient
    from qa import QAPipeline

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class RAGAgent:
    """Agent lấy context JD từ ChromaDB jds_collection, định tuyến ý định (Routing), dựng Prompt và gọi LLM trả lời"""

    def __init__(self, collection_name: str = "jds_collection"):
        self.qa_pipeline = QAPipeline(collection_name=collection_name)
        self.llm_client = LLMClient()

    def route_intent(self, question: str) -> str:
        """Phân loại ý định câu hỏi: 'RETRIEVAL' (tra cứu JD) hoặc 'CHITCHAT' (chào hỏi)"""
        q_lower = question.lower()
        chitchat_keywords = ["xin chào", "hello", "hi", "bạn là ai", "who are you", "cảm ơn", "thank you"]

        for kw in chitchat_keywords:
            if kw in q_lower and len(q_lower) < 30:
                return "CHITCHAT"

        return "RETRIEVAL"

    def run(self, question: str) -> dict[str, Any]:
        """Luồng xử lý chính của Agent trên tập JD"""
        print(f"\n🤖 [JD RAG Agent] Nhận câu hỏi: '{question}'")
        intent = self.route_intent(question)
        print(f"🎯 Phân loại ý định (Intent Routing): {intent}")

        if intent == "CHITCHAT":
            response_text = self.llm_client.generate_response(question, "Bạn là trợ lý AI tuyển dụng và so khớp CV-JD.")
            return {
                "question": question,
                "intent": intent,
                "answer": response_text,
                "retrieved_documents": [],
                "confidence_score": 1.0
            }

        # Intent == RETRIEVAL -> Execute RAG QA Pipeline on JDs
        qa_result = self.qa_pipeline.answer_question(question, top_k=3)
        qa_result["intent"] = intent
        return qa_result

if __name__ == "__main__":
    agent = RAGAgent(collection_name="jds_collection")
    res = agent.run("Mức lương và kinh nghiệm vị trí Lập trình viên Java?")
    print("Agent Answer:", res["answer"])
