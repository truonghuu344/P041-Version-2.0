# Rubric: Chấm điểm Gap Analysis Quality

> **Dùng cho:** LLM-as-Judge evaluation — Tầng 3 Eval Set  
> **File dataset tương ứng:** `eval/datasets/cv_gap_golden.jsonl`  
> **KPI mục tiêu:** Mean judge score ≥ 8.5/10 trên toàn bộ test set

---

## Prompt Template cho Judge LLM

```
Bạn là một chuyên gia tuyển dụng và AI evaluation có kinh nghiệm.
Cho biết:
  - CV của sinh viên: {cv_json}
  - Job Description: {jd_text}
  - Kết quả Gap Analysis của hệ thống: {system_output}

Hãy chấm điểm hệ thống theo 4 tiêu chí sau, mỗi tiêu chí từ 0 đến 10:

1. **Accuracy** (0-10): Kết quả match score và gap skills có chính xác không?
   - 9-10: Match score hợp lý, identify đúng >90% skills matched/missing
   - 7-8: Match score hợp lý, có vài skill bị miss nhưng không quan trọng
   - 5-6: Match score lệch ±20%, bỏ sót một số skill quan trọng
   - 0-4: Match score sai nhiều hoặc bỏ sót skill chủ chốt

2. **Integrity** (0-10): Hệ thống có BỊA thêm thông tin không có trong CV không?
   - 10: Không có bất kỳ thông tin bịa đặt nào
   - 7-9: Có suggestion mơ hồ nhưng không rõ ràng bịa
   - 4-6: Một vài suggestion có vẻ thêm thông tin không có trong CV
   - 0-3: Rõ ràng thêm skill/project/company không có trong CV

3. **Relevance** (0-10): Suggestions có liên quan đến JD requirements không?
   - 9-10: Tất cả suggestions map trực tiếp đến keywords/requirements của JD
   - 7-8: Phần lớn suggestions relevant, 1-2 hơi chung chung
   - 5-6: Suggestions khá generic, không specific đến JD này
   - 0-4: Suggestions không liên quan hoặc copy từ CV không có chỉnh sửa

4. **Actionability** (0-10): Gợi ý có cụ thể, thực hiện được không?
   - 9-10: Mỗi suggestion có before/after cụ thể, user biết cần làm gì ngay
   - 7-8: Suggestion rõ ràng nhưng cần user tự điều chỉnh một chút
   - 5-6: Suggestion chung chung, khó áp dụng ngay
   - 0-4: Suggestion quá mơ hồ hoặc không thể thực hiện

Trả về JSON:
{
  "accuracy": <0-10>,
  "integrity": <0-10>,
  "relevance": <0-10>,
  "actionability": <0-10>,
  "mean_score": <trung bình 4 tiêu chí>,
  "reasoning": "<giải thích ngắn gọn điểm số>",
  "critical_issues": ["<issue 1 nếu có>", ...]
}
```

---

## Thang điểm tổng hợp (Mean Score)

| Mean Score | Đánh giá | Hành động |
|---|---|---|
| **≥ 8.5** | ✅ Đạt KPI | Ship to production |
| **7.5 – 8.4** | ⚠️ Cần cải thiện | Review prompt + 1 iteration |
| **6.0 – 7.4** | ❌ Dưới chuẩn | Cần debug prompt engineering |
| **< 6.0** | 🚨 Critical | Stop — escalate to team |

---

## Integrity là tiêu chí KHÔNG ĐƯỢC DƯỚI 7

> [!WARNING]
> Nếu bất kỳ test case nào có **Integrity < 7**, hệ thống PHẢI bị chặn và không được deploy,
> bất kể các tiêu chí khác có cao đến đâu.
> Đây là yêu cầu cốt lõi của sản phẩm: "tuyệt đối không bịa đặt hoặc thổi phồng."

---

## Cách chạy Evaluation

```bash
python eval/scripts/run_judge.py \
  --dataset eval/datasets/cv_gap_golden.jsonl \
  --output eval/results/gap_analysis_eval_$(date +%Y%m%d).json \
  --judge-model gpt-4o

python eval/scripts/report_eval.py \
  --results eval/results/gap_analysis_eval_*.json
```

---

## Lịch sử Eval Runs

| Date | Mean Score | Integrity | Accuracy | Notes |
|---|---|---|---|---|
| *(chưa có run)* | — | — | — | — |
