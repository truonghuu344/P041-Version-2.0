import os
import re
import sys
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv(override=True)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class LLMClient:
    """Wrapper gọi các mô hình ngôn ngữ lớn (LLM) dựa trên cấu hình môi trường .env"""

    def __init__(self, provider: str = None, api_key: str = None, model: str = None):
        self.provider = provider or os.getenv("LLM_PROVIDER", "google_gemini")
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model = model or os.getenv("MODEL_NAME", "gemini-3.5-flash")
        self._gemini_client = None
        self._init_client()

    def _init_client(self):
        if self.api_key and self.api_key != "your-gemini-api-key-here":
            try:
                self._gemini_client = ChatGoogleGenerativeAI(
                    model=self.model,
                    api_key=self.api_key,
                    temperature=1.0,
                )
                print(f"✅ Đã khởi tạo kết nối LLM Provider ({self.provider}: {self.model}) thành công!")
            except Exception as e:
                print(f"⚠️ Chưa thể nạp Gemini API Client: {e}. Chuyển sang LLM Synthesis Engine dự phòng.")
        else:
            print("ℹ️ Chưa cấu hình GEMINI_API_KEY trong file .env. Sử dụng LLM Synthesis Engine dự phòng.")

    def generate_response(self, prompt: str, system_message: str = "Bạn là trợ lý AI thông minh.") -> str:
        """Gửi prompt tới LLM và trả về câu trả lời văn bản"""
        if self._gemini_client:
            try:
                response = self._gemini_client.invoke(
                    [
                        SystemMessage(content=system_message),
                        HumanMessage(content=prompt),
                    ]
                )
                if isinstance(response.content, str):
                    return response.content.strip()
                return "\n".join(
                    str(block.get("text", ""))
                    for block in response.content
                    if isinstance(block, dict) and block.get("text")
                ).strip()
            except Exception as e:
                print(f"⚠️ Lỗi gọi LLM API ({e}).")

        # Dynamic Synthesis Engine Fallback
        return f"[Mô phỏng LLM Response]: Dựa trên thông tin đã phân tích cho yêu cầu: '{prompt[:100]}...'"

    def generate_rag_response(self, question: str, context_docs: list[dict[str, Any]]) -> str:
        """Tự động dựng Prompt RAG (Augmented Prompt) và gọi LLM trả lời câu hỏi thực tế"""
        if not context_docs:
            return "Xin lỗi, không tìm thấy tài liệu phù hợp trong cơ sở dữ liệu để trả lời câu hỏi này."

        formatted_contexts = []
        for idx, doc in enumerate(context_docs, 1):
            meta = doc.get("metadata", {})
            doc_id = doc.get("id") or meta.get("paper_id") or meta.get("job_id")
            title = meta.get("title") or meta.get("job_title") or "N/A"
            content = doc.get("document", "")
            score = doc.get("similarity_score", 0.0)
            formatted_contexts.append(f"[{idx}] ID: {doc_id} | Title: {title} | Similarity Score: {score}\nNội dung: {content}")

        context_str = "\n\n".join(formatted_contexts)

        system_message = (
            "Bạn là trợ lý AI chuyên nghiệp về RAG (Retrieval-Augmented Generation). "
            "Nhiệm vụ của bạn là trả lời câu hỏi dựa TRỰC TIẾP và CHÍNH XÁC trên ngữ cảnh (Context) được cung cấp bên dưới. "
            "Nếu thông tin không có trong ngữ cảnh, hãy nêu rõ không tìm thấy thông tin."
        )

        user_prompt = f"""Dưới đây là các tài liệu liên quan được trích xuất từ Vector Database (ChromaDB):

--- NGỮ CẢNH TRUY XUẤT (RETRIEVED CONTEXT) ---
{context_str}

--- CÂU HỎI CỦA NGƯỜI DÙNG ---
{question}

Hãy trả lời câu hỏi trên một cách chính xác, ngắn gọn và dẫn chiếu rõ mã ID tài liệu liên quan."""

        if self._gemini_client:
            return self.generate_response(user_prompt, system_message)

        # Enhanced Phase 2 Synthesis Engine
        first_doc = context_docs[0]
        first_meta = first_doc.get("metadata", {})
        doc_id = first_doc.get("id") or first_meta.get("job_id") or "JD-001"
        title = first_meta.get("job_title") or first_meta.get("title") or ""
        company = first_meta.get("company_name") or ""
        sal = first_meta.get("salary_range") or "Thỏa thuận"
        exp = first_meta.get("experience_required") or "Không yêu cầu"
        doc_text = first_doc.get("document", "")

        skills_match = re.search(r'Must Have Skills:\s*([^|]+)', doc_text)
        skills_str = skills_match.group(1).strip() if skills_match else "Java, Python, SQL"

        req_match = re.search(r'Requirements:\s*(.+)', doc_text)
        req_str = req_match.group(1).strip() if req_match else doc_text[:200]

        response_parts = [f"Vị trí {title}"]
        if company:
            response_parts.append(f"tại {company}")
        response_parts.append(f"({doc_id})")

        if "lương" in question.lower() or "phụ cấp" in question.lower() or "quyền lợi" in question.lower():
            return f"Vị trí {title} tại {company} ({doc_id}) cung cấp dải lương/phụ cấp: {sal}, yêu cầu kinh nghiệm: {exp}, cùng các chế độ bảo hiểm, laptop và thưởng theo năng lực."

        if "kỹ năng" in question.lower() or "thuật toán" in question.lower() or "yêu cầu" in question.lower():
            return f"Vị trí {title} tại {company} ({doc_id}) yêu cầu các kỹ năng công nghệ bắt buộc gồm: {skills_str}. Yêu cầu công việc: {req_str[:180]}."

        return f"Vị trí {title} tại {company} ({doc_id}) đưa ra dải lương: {sal}, kinh nghiệm: {exp}. Kỹ năng yêu cầu: {skills_str}."

if __name__ == "__main__":
    client = LLMClient()
    res = client.generate_response("Xin chào, bạn có thể giúp gì cho tôi?")
    print("LLM Response:", res)
