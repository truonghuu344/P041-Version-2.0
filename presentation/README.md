# Career Assistant X — Pitch Deck

Bộ slide HTML 16:9 (11 trang) cho Demo Day — VinUni AI20K Build Phase, nhóm WinTop.

## Files

- `index.html` — deck chính (mở trực tiếp bằng trình duyệt)
- `Career-Assistant-Presentation.pdf` — bản PDF xuất tự động (12 trang, 1280×720/page)
- `export-pdf.mjs` + `export-pdf.cmd` — script xuất PDF tự động
- `package.json` — khai báo script & dependency cho export
- `assets/fonts/` — Be Vietnam Pro (tự host, hỗ trợ đầy đủ dấu tiếng Việt)
- `assets/logo.png` — logo sản phẩm

## Slide structure

1. Cover — Career Assistant
2. 1 · Bài toán
3. 2 · Giải pháp (nguyên tắc "Không evidence → không claim")
4. Hệ sinh thái — Sinh viên – Cố vấn – Doanh nghiệp
5. Luồng end-to-end (upload → JD → match → CV variant → voice interview → ứng tuyển)
6. Thuật toán lõi 1/2 — Matching & Top Jobs (BM25 ⊕ Vector → RRF → rubric; FitScore weights)
7. Thuật toán lõi 2/2 — AI Agents: Tối ưu CV (CP-SAT) · Nova RAG 3 tầng · STAR
8. Kiến trúc hệ thống & AI (Client → API Gateway → Services → LangGraph → Data/External)
9. 3 · Tính khả thi (sản phẩm chạy thật + CI/CD Vercel/Render)
10. Giá trị theo 3 vai trò
11. 4 · Định hướng phát triển
12. Closing

Mọi số liệu lấy từ repo thật (`backend/`, `frontend/`, `data/jds/raw`, `eval/`) — không bịa metric.

## Usage

```powershell
# Xem deck
start index.html

# Điều khiển: ← → chuyển slide · F toàn màn hình · Home/End đầu/cuối · vuốt trên mobile

# Xuất PDF lại khi sửa slide (cần Node 20+ và Chrome/Edge đã cài)
cd presentation
npm install        # lần đầu; node_modules đã bị .gitignore
npm run presentation:pdf
```
