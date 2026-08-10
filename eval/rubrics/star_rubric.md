# Rubric: Chấm điểm STAR Interview Response

> **Dùng cho:** LLM-as-Judge evaluation — STAR scoring quality  
> **File dataset tương ứng:** `eval/datasets/interview_qa_golden.jsonl`  
> **KPI mục tiêu:** Judge score correlation với golden scores ≥ 0.85 (Pearson r)

---

## Prompt Template cho Judge LLM

```
Bạn là chuyên gia phỏng vấn tuyển dụng và career coach.
Cho biết:
  - Vị trí ứng tuyển (JD context): {jd_context}
  - CV của sinh viên: {cv_summary}
  - Câu hỏi phỏng vấn: {question}
  - Câu trả lời của sinh viên: {student_answer}

Chấm điểm câu trả lời theo rubric STAR, mỗi thành phần từ 0-10:

**S — Situation (0-10):** Bối cảnh có rõ ràng và cụ thể không?
  - 9-10: Có tên dự án/công ty, thời gian, số người liên quan, vấn đề cụ thể
  - 7-8: Có bối cảnh nhưng thiếu 1 chi tiết (VD: không có timeline)
  - 5-6: Bối cảnh mơ hồ, chỉ nói chung chung
  - 0-4: Không có bối cảnh hoặc bối cảnh không liên quan

**T — Task (0-10):** Nhiệm vụ và vai trò cá nhân có rõ không?
  - 9-10: Rõ ràng "Tôi chịu trách nhiệm X", phân biệt được "tôi" vs "team"
  - 7-8: Có nêu vai trò nhưng còn mơ hồ giữa cá nhân và team
  - 5-6: Vai trò không rõ, dùng "chúng tôi" nhiều không nêu "tôi" làm gì
  - 0-4: Không nêu nhiệm vụ hoặc vai trò

**A — Action (0-10):** Hành động cụ thể và có chiều sâu kỹ thuật không?
  - 9-10: Liệt kê ≥2 hành động cụ thể, có lý do lựa chọn, có thứ tự logic
  - 7-8: Có hành động cụ thể nhưng thiếu lý do hoặc chỉ 1 hành động
  - 5-6: Hành động chung chung ("thảo luận", "làm việc", "cải thiện")
  - 0-4: Không có hành động hoặc quá mơ hồ

**R — Result (0-10):** Kết quả có định lượng và impact không?
  - 9-10: Có số liệu cụ thể (%, thời gian, user count), rõ impact với team/project
  - 7-8: Có kết quả định tính rõ ràng (VD: "đúng deadline", "khách hàng accept")
  - 5-6: Kết quả mơ hồ ("tốt hơn", "hài lòng", "được khen")
  - 0-4: Không có kết quả hoặc kết quả không liên quan

Trả về JSON:
{
  "situation": <0-10>,
  "task": <0-10>,
  "action": <0-10>,
  "result": <0-10>,
  "total_score": <tổng / 4 * 10 để ra thang 100>,
  "star_feedback": {
    "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>"],
    "improvements": ["<cần cải thiện 1>", "<cần cải thiện 2>"],
    "follow_up_needed": <true/false>,
    "follow_up_reason": "<lý do nếu cần follow-up>"
  }
}
```

---

## Follow-up Question Logic

> Hệ thống PHẢI đặt follow-up nếu tổng điểm STAR < 60 **hoặc** bất kỳ thành phần nào < 5.

| Condition | Follow-up Trigger | Sample Follow-up |
|---|---|---|
| S < 5 | Thiếu bối cảnh | "Bạn có thể mô tả cụ thể hơn về dự án hoặc công ty đó không?" |
| T < 5 | Vai trò mơ hồ | "Trong tình huống đó, cụ thể bạn phụ trách phần nào?" |
| A < 5 | Hành động mơ hồ | "Bạn đã thực hiện những bước cụ thể nào để giải quyết vấn đề?" |
| R < 5 | Thiếu kết quả | "Kết quả cuối cùng là gì? Có thể cho ví dụ cụ thể hoặc số liệu không?" |
| Total < 60 | Tổng thấp | Ưu tiên follow-up thành phần thấp nhất |

---

## Correlation Check (Judge Calibration)

Trước khi dùng judge LLM trên production data, phải verify calibration:

```bash
# Chạy judge trên golden dataset có sẵn scores
python eval/scripts/run_judge.py \
  --dataset eval/datasets/interview_qa_golden.jsonl \
  --mode calibration \
  --output eval/results/star_calibration.json

# Kiểm tra correlation với golden scores
python eval/scripts/report_eval.py \
  --mode calibration \
  --results eval/results/star_calibration.json \
  --threshold 0.85
```

**Pass condition:** Pearson r ≥ 0.85 giữa judge scores và golden scores.  
Nếu < 0.85, cần điều chỉnh prompt hoặc chọn judge model khác.

---

## Lịch sử Eval Runs

| Date | Mean STAR | Calibration r | Notes |
|---|---|---|---|
| *(chưa có run)* | — | — | — |
