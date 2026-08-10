from pydantic import BaseModel, Field, model_validator


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ agent")
    analysis: str = Field(default="", description="Phân tích nội bộ")


class CVAnalyzeRequest(BaseModel):
    cv_id: str = Field(..., min_length=1, description="ID của CV đã upload")
    jd_text: str = Field(..., min_length=1, description="Nội dung Job Description")


class SuggestionDecisionRequest(BaseModel):
    final_text: str | None = None


class InterviewStartRequest(BaseModel):
    cv_id: str = Field(..., min_length=1, description="ID của CV")
    jd_id: str | None = Field(default=None, description="ID của JD")
    jd_text: str | None = Field(default=None, description="Nội dung JD")
    total_questions: int = Field(default=5, ge=1, le=10)

    @model_validator(mode="after")
    def check_jd_present(self) -> "InterviewStartRequest":
        if not self.jd_id and not self.jd_text:
            raise ValueError("Cần cung cấp ít nhất jd_id hoặc jd_text")
        return self


class InterviewAnswerRequest(BaseModel):
    answer: str | None = None
    user_answer: str | None = None

    @model_validator(mode="after")
    def check_answer_present(self) -> "InterviewAnswerRequest":
        # Không cho phép cung cấp cả 2 trường với giá trị khác nhau
        if (
            self.answer is not None
            and self.user_answer is not None
            and self.answer.strip() != self.user_answer.strip()
        ):
            raise ValueError("Không được cung cấp đồng thời cả 'answer' và 'user_answer' với nội dung khác nhau")

        ans = self.get_text()
        if not ans.strip():
            raise ValueError("Câu trả lời không được để trống")
        return self

    def get_text(self) -> str:
        if self.answer is not None:
            return self.answer
        if self.user_answer is not None:
            return self.user_answer
        return ""

