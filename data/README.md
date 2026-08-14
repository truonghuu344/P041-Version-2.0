# Hướng dẫn Xử lý Dữ liệu RAG và Quy trình ETLT

Thư mục `data/` chứa toàn bộ dữ liệu thô, dữ liệu sạch, các báo cáo đánh giá chất lượng hệ thống AI, cũng như quy trình ETLT được thiết kế cho hệ thống AI Matching CV - JD.

## Cấu trúc thư mục

- `raw/`: Chứa dữ liệu gốc chưa xử lý.
  - `pdfs/`: Chứa hàng trăm CV định dạng PDF phân theo ngành nghề (SALES, HR, IT, ENGINEERING) phục vụ test CV trái ngành.
  - `vietnam_it_job_posts.csv` và `resume_dataset_1200.csv`: Dữ liệu JD và CV dạng bảng.
- `clean/`: Chứa dữ liệu đã làm sạch và chuẩn hóa (VD: `cv_100_clean.csv`, `jd_100_clean.csv`). Dữ liệu này sẽ được bàn giao cho Backend. Backend sẽ chịu trách nhiệm Chunking và Embedding.
- `eval/`: Chứa kết quả đánh giá mô hình định dạng JSON (`eval_results.json`).
- `quality/`: Chứa các báo cáo chất lượng hệ thống RAG (`quality_report.md`).
- `reports/`: Chứa các báo cáo Metrics theo Phase (`phase1_report.md`, v.v).
- `postgres_data/`: Volume mount cục bộ cho database PostgreSQL chạy qua Docker, đảm bảo dữ liệu Vector không bị mất.

## Chiến lược RAG (Retrieval-Augmented Generation)

### 1. Chunking (Cắt nhỏ văn bản)
- **CV (Resume)**: Sử dụng kết hợp *Document-specific Chunking* (Dựa trên cấu trúc CV như Kinh nghiệm, Học vấn, Kỹ năng) và *Parent-Child Chunking*.
  - Child chunk: Nhỏ (100-200 tokens) để search Vector DB chính xác.
  - Parent chunk: Lớn (1000 tokens) đưa vào LLM để hiểu đầy đủ ngữ cảnh.
- **JD (Job Description)**: *Parent-Child Chunking*.

### 2. Embedding
- **Mô hình**: Sử dụng `Multilingual-E5-large` (Mã nguồn mở, đa ngôn ngữ xuất sắc) hoặc `text-embedding-3-small` (OpenAI). 
- Các mô hình này sẽ giúp chuyển hóa các đoạn văn (Chunk) thành các vector (embeddings) để có thể tính khoảng cách (Cosine Similarity).

### 3. Vector Database
- **Công cụ**: Sử dụng `pgvector` cài đặt trên `PostgreSQL`.
- **Lý do**: Cho phép kết hợp lưu trữ siêu dữ liệu (Metadata), dữ liệu gốc (Relational Data), và Vector trong cùng một Database.
- **Index**: Sử dụng thuật toán `HNSW` (Hierarchical Navigable Small World) để đảm bảo tốc độ search mili-giây.

### 4. Tìm kiếm (Search) và Xếp hạng lại (Reranking)
- **Hybrid Search**: Hệ thống kết hợp:
  - *Dense Retrieval* (Vector Search qua `pgvector`): Tìm kiếm theo ý nghĩa tương đồng (semantic).
  - *Sparse Retrieval* (Full-text Search của PostgreSQL): Khớp từ khóa chính xác (Keyword).
- **RRF (Reciprocal Rank Fusion)**: Thuật toán *RRF* được sử dụng để CHUẨN HÓA và KẾT HỢP điểm số từ Dense Retrieval và Sparse Retrieval (Hai thuật toán tìm kiếm trên có thang điểm khác nhau, RRF giúp kết hợp chúng lại một cách công bằng nhất trước khi Reranking).
- **Reranking (Cross-encoder)**: Sau khi RRF trả về Top-K ứng viên (VD: 50 CVs tốt nhất), ta sẽ chạy qua một mô hình Reranker (như `Cohere Rerank` hoặc `BGE-Reranker`). Mô hình này tính điểm lại bằng cách so sánh trực tiếp JD và từng CV, để chọn ra Top-N cuối cùng (VD: 5 CVs phù hợp nhất).

---

## Quy trình ETLT (Extract, Transform, Load, Transform)

Hệ thống xử lý qua 4 bước:

1. **Extract (Trích xuất)**:
   - Thu thập CV từ file `resume_dataset_1200.csv`.
   - Trích xuất văn bản từ CV định dạng PDF bằng thư viện `PyPDF` hoặc `Unstructured`. Dùng OCR cho CV dạng ảnh.
   - Thu thập JD từ `vietnam_it_job_posts.csv`.

2. **Transform (Làm sạch - In-memory)**:
   - Xóa bỏ ký tự thừa, HTML, Script.
   - Khử nhiễu, chuẩn hóa bảng mã Unicode (NFC).
   - Xuất ra file `cv_100_clean.csv` và `jd_100_clean.csv`.

3. **Load (Đẩy vào Database)**:
   - Khởi tạo các bảng `raw_cvs` và `raw_jds` trong PostgreSQL.
   - Insert toàn bộ dữ liệu đã làm sạch vào Database.

4. **Transform (Chuẩn hóa Vector - Được xử lý bởi đội Backend/AI)**:
   - Chạy logic Chunking.
   - Call API Embedding (hoặc Local Model).
   - Lưu trữ vector vào bảng `cv_chunks` và `jd_chunks` (Kiểu dữ liệu `vector(1024)` của pgvector).

## Các Lệnh Cần Chạy

### Cài đặt môi trường Python (Script ETL)
```bash
# Cài đặt thư viện (nếu có yêu cầu từ requirements)
pip install pandas sqlalchemy psycopg2-binary unstructured pypdf pytesseract
```

### Chạy Script Xử lý Dữ liệu
```bash
# Chạy script trích xuất dữ liệu, làm sạch và lưu trữ
python scripts/etl_pipeline.py
```

## 5. Đánh giá Chất lượng (Evaluation & Reporting)

Để đảm bảo hệ thống nhận diện tốt các trường hợp **CV trái ngành** hoặc **CV thiếu kỹ năng**, bạn cần chạy tập lệnh đánh giá (Evaluation Scripts). Các lệnh này sẽ mô phỏng việc match CV (gồm cả IT và Non-IT từ file PDF) với các JD (IT) và đo lường độ chính xác của mô hình Reranker.

### Lệnh chạy Test / Evaluation
(Lưu ý: Các script đánh giá này do đội AI/Backend phát triển, thường nằm trong thư mục `src/retrieval/`)

```bash
# 1. Chạy bài test đánh giá Matching (Tính điểm Precision, Recall, MRR, Hit Rate)
# Kết quả sẽ được ghi vào thư mục data/eval/
python src/retrieval/evaluate.py --run-tests --output data/eval/eval_results.json

# 2. Phân tích kết quả và sinh báo cáo chất lượng (Quality Report)
# Báo cáo được định dạng Markdown dễ đọc, ghi vào thư mục data/quality/
python src/retrieval/evaluate.py --generate-report --format md --output data/quality/quality_report.md
```

### Các Test Case Trọng Điểm Cần Chú Ý (Trong Evaluation):
1. **CV Trái Ngành (Cross-industry)**: Kiểm tra các CV từ nhóm `SALES`, `HR` khi map với JD `IT`. Hệ thống Reranker phải phân biệt được Context và cho điểm Matching Score rất thấp (<30%).
2. **CV Thiếu Kỹ Năng Cứng (Skill Gap)**: Một CV lập trình viên nhưng thiếu hoàn toàn các công nghệ cốt lõi mà JD yêu cầu (Ví dụ: JD cần `Python`, `PostgreSQL` nhưng CV chỉ có `Java`). Điểm số phải bị trừ mạnh và hệ thống phải trích xuất được "Missing Skills".
