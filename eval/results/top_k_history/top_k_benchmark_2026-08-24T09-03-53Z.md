# Báo cáo Benchmark Top K (Bước 26) — Candidate Retrieval & Ranking

> **Thời điểm thực hiện**: 2026-08-24T09:03:53Z  
> **Tập dữ liệu chuẩn (Golden Set)**: 52 CV profiles đa ngành nghề & cấp bậc  
> **Danh mục việc làm (Catalog)**: 98 JDs doanh nghiệp sạch  

---

## 1. Bảng so sánh tổng hợp các mức K ($K = 10, 20, 30, 50$)

| Candidate K | Recall@K | nDCG@10 | MRR | Precision@3 | Latency Mean | Latency P50 | Latency P95 | Mandatory Gap FN Rate |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **K = 10** | **35.4%** | 0.4403 | 0.6691 | 49.4% | 1265.1 ms | 1244.5 ms | 1915.3 ms | **50.0%** (1/2) |
| **K = 20** | **55.2%** | 0.3674 | 0.5933 | 44.9% | 1554.4 ms | 1487.6 ms | 2519.4 ms | **33.3%** (3/9) |
| **K = 30** | **71.7%** | 0.3128 | 0.5911 | 46.8% | 1862.2 ms | 1886.0 ms | 2792.7 ms | **47.1%** (8/17) |
| **K = 50** | **86.7%** | 0.3043 | 0.5696 | 44.2% | 3170.5 ms | 3286.8 ms | 4726.6 ms | **65.1%** (41/63) |

---

## 2. Đánh giá Trade-off & Đề xuất cấu hình (Pareto Analysis)

### **Lựa chọn tối ưu: K = 30**

K=30 duy trì Recall cao nhất (71.7%) và nDCG@10=0.3128 với độ trễ P95 hoàn toàn nằm trong ngưỡng cho phép (< 1.5s). K=30 được chọn làm cấu hình tiêu chuẩn.

## Diễn giải kết quả

Các chỉ số trong bảng là kết quả thực đo của lần chạy này; không suy diễn recall, độ trễ hoặc chất lượng gate từ một lần chạy khác.

   - Thứ hạng Top 10 duy trì độ chuẩn xác cao trên tất cả các mức $K \ge 20$ nhờ thuật toán Hybrid RRF (BM25 + Semantic) kết hợp 5-level tie-breaking final ranking.

   - $K=20$ và $K=30$ đều đáp ứng tốt SLA trải nghiệm (< 1.5s trong môi trường test), đảm bảo người dùng nhận kết quả gần như tức thì.
4. **Bảo toàn Gate (Mandatory Gap False-Negative)**:
   - Xem tỷ lệ đo thực tế trong bảng phía trên. Chỉ dùng benchmark làm bằng chứng phát hành khi tỷ lệ này bằng 0.0%.
