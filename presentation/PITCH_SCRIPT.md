# Kịch bản Thuyết trình Demo Day — Career Assistant

> **Dự án**: Career Assistant  
> **Đội ngũ**: Team 041 · WinTop (VinUni AI20K Build Phase — Cohort 3)  
> **Thời gian mục tiêu**: 8–9 phút (Bao gồm video demo, dự phòng 1–2 phút cho khung 10 phút)  
> **Nguyên tắc**: Nói tự nhiên, gãy gọn, không đọc nguyên văn slide. Mọi số liệu và kiến trúc bám sát 100% codebase thực tế.

---

## Slide 1 — Title

**Thời gian:** ~30 giây  
**Thông điệp chính:** Giới thiệu định vị sản phẩm Career Assistant và nhóm thực hiện WinTop.

**Nội dung nói:**  
“Kính chào Ban Tổ Chức và Hội Đồng Đánh Giá. Nhóm chúng em là WinTop, Team 041.  
Sản phẩm của nhóm là **Career Assistant** — nền tảng đồng hành giúp sinh viên đi từ việc chuẩn bị CV, hiểu rõ khoảng cách với yêu cầu tuyển dụng, cho đến luyện tập phỏng vấn trước khi thực sự nộp hồ sơ.  
Hôm nay, nhóm em xin chia sẻ câu chuyện bài toán, giải pháp kỹ thuật và các kết quả đo kiểm thực tế của dự án.”

**Chuyển slide:**  
“Trước hết, hãy cùng nhìn vào những khó khăn rất thật mà sinh viên năm 3, năm 4 đang gặp phải.”

---

## Slide 2 — Problem

**Thời gian:** ~50 giây  
**Thông điệp chính:** Vấn đề không phải thiếu công cụ AI, mà thiếu một quy trình hướng nghiệp có phản hồi và có căn cứ.

**Nội dung nói:**  
“Khi tìm kiếm cơ hội thực tập và việc làm, phần lớn sinh viên thường rơi vào một vòng lặp bế tắc:  
Các bạn dùng một bản CV duy nhất để rải cho hàng chục JD khác nhau mà không biết cách tùy biến.  
Khi bị từ chối, ứng viên hoàn toàn không nhận được phản hồi: không biết mình thiếu kỹ năng nào, điểm nào chưa phù hợp.  
Và hệ quả nghiêm trọng nhất là: chỉ đến khi bước vào phòng phỏng vấn thật và nhận kết quả thất bại, các bạn mới nhận ra mình chưa hề sẵn sàng.  
Thực tế hiện nay không thiếu các chatbot AI, nhưng sinh viên đang thiếu một quy trình luyện tập có phản hồi cụ thể, minh bạch và có căn cứ xác thực.”

**Chuyển slide:**  
“Để giải quyết triệt để chuỗi vấn đề này, Career Assistant được thiết kế thành một luồng trải nghiệm liên tục.”

---

## Slide 3 — Solution

**Thời gian:** ~50 giây  
**Thông điệp chính:** Phân tích dựa trên bằng chứng thực tế từ CV/JD và điểm số do Backend tính toán tất định.

**Nội dung nói:**  
“Career Assistant kết nối hành trình của ứng viên qua một chuỗi 6 chặng khép kín:  
Từ việc nhận đầu vào CV và JD → Hệ thống thực hiện so khớp (Match) → Chỉ ra khoảng cách kỹ năng (Gap) → Đưa ra gợi ý tối ưu hồ sơ (Improve CV) → Tổ chức phỏng vấn thử theo khung năng lực (Mock Interview) → Và cuối cùng là sẵn sàng ứng tuyển (Apply).  
Điểm khác biệt cốt lõi của Career Assistant so với các chatbot thông thường là nguyên tắc: **‘Không evidence → Không claim’**.  
Hệ thống không chỉ sinh văn bản đơn thuần. Mọi nhận định đều phải gắn liền với bằng chứng trích xuất từ CV thật, và điểm số FitScore hoàn toàn do logic Backend tính toán tất định theo công thức chuẩn, tuyệt đối không để LLM tự do chấm điểm.”

**Chuyển slide:**  
“Bây giờ, xin mời Hội Đồng cùng xem hành trình sản phẩm thực tế được xây dựng ra sao.”

---

## Slide 4 — Product

**Thời gian:** ~50 giây  
**Thông điệp chính:** Trải nghiệm liền mạch 6 bước với cùng một ngữ cảnh hồ sơ xuyên suốt hành trình.

**Nội dung nói:**  
“Trên màn hình là hành trình 6 bước thực tế của ứng viên trong hệ thống:  
Người dùng bắt đầu bằng việc tải lên file CV định dạng PDF hoặc DOCX qua bộ trích xuất OCR.  
Sau đó, các bạn có thể dán JD bất kỳ hoặc chọn ngay từ danh mục **98 JD** thực tế đã được chuẩn hóa sẵn trong hệ thống.  
Tại đây, cùng một ngữ cảnh CV và JD sẽ đi theo ứng viên xuyên suốt: từ bảng phân tích FitScore minh bạch, báo cáo khoảng cách kỹ năng, giao diện duyệt từng gợi ý chỉnh sửa CV, cho đến phòng phỏng vấn thử bằng giọng nói qua **8 giai đoạn** bài bản.  
Quan trọng nhất: hệ thống không bao giờ tự ý bịa thêm kỹ năng mà người dùng không có.”

**Chuyển slide:**  
“Để vận hành trơn tru một quy trình có kiểm soát chặt chẽ như vậy, kiến trúc hệ thống đã được thiết kế phân tầng rõ ràng.”

---

## Slide 5 — Architecture

**Thời gian:** ~60 giây  
**Thông điệp chính:** Kiến trúc 5 tầng tinh gọn với 2 lựa chọn then chốt: LangGraph và pgvector.

**Nội dung nói:**  
“Hệ thống được tổ chức theo kiến trúc 5 tầng:  
Giao diện Next.js kết nối với API Gateway FastAPI, tầng điều phối xử lý AI bằng LangGraph, cơ sở dữ liệu PostgreSQL tích hợp `pgvector`, cùng các dịch vụ chuyên biệt như Gemini, Deepgram STT và MinerU OCR.  
Trong kiến trúc này, nhóm đã đưa ra hai quyết định kỹ thuật quan trọng:  
**Thứ nhất, tại sao chọn LangGraph?**  
Bởi vì quy trình xử lý hồ sơ cần tính kỷ luật rất cao: cần quản lý trạng thái tập trung, phân nhánh có điều kiện khi phát hiện lỗi đầu vào, cơ chế retry và các chốt chặn an toàn (guardrails). LangGraph đáp ứng hoàn hảo yêu cầu kiểm soát luồng này.  
**Thứ hai, tại sao chọn pgvector?**  
pgvector cho phép lưu trữ dữ liệu quan hệ, lọc metadata và tìm kiếm vector embedding ngay trong một hệ quản trị PostgreSQL duy nhất. Điều này giúp tối ưu tài nguyên, đơn giản hóa hạ tầng và loại bỏ rủi ro lệch pha dữ liệu mà không cần dựng thêm cụm vector DB riêng biệt ở quy mô hiện tại.”

**Chuyển slide:**  
“Đi sâu hơn vào tầng AI, đây là cách nhóm em kiểm soát chất lượng đầu ra và loại bỏ ảo giác.”

---

## Slide 6 — AI / LLM Approach

**Thời gian:** ~70 giây  
**Thông điệp chính:** AI dùng để hiểu ngôn ngữ và trích xuất bằng chứng; Backend kiểm soát quyết định và điểm số.

**Nội dung nói:**  
“Triết lý kỹ thuật của nhóm được đúc kết trong một câu: **‘AI tìm bằng chứng. LangGraph điều phối. Backend quyết định điểm.’**  
Quy trình diễn ra như sau:  
Đầu tiên, hệ thống dùng Hybrid Retrieval kết hợp BM25 và pgvector để tìm các đoạn bằng chứng liên quan.  
Tiếp theo, LangGraph State Machine điều phối việc kiểm tra đầu vào, trích xuất quan hệ ngữ nghĩa, dự thảo báo cáo và chạy qua chốt chặn `integrity_guardrail` để phát hiện dữ liệu bất thường.  
Cuối cùng, Backend tiếp nhận nhãn bằng chứng và tính toán điểm FitScore theo công thức tất định gồm 5 thành phần: Kỹ năng 35%, Kinh nghiệm 30%, Lĩnh vực 15%, Học vấn 10% và Ưu tiên 10%.  
Ba nguyên tắc sống còn mà nhóm tuân thủ là: **Evidence First**, **Structured Output** qua Pydantic Schema, và **Deterministic Scoring**.  
Trên tập dữ liệu đánh giá chuẩn Golden Dataset, quy trình đã đạt **14 trên 15 ca kiểm thử thành công**, cho thấy khả năng phân tách điểm số rất rõ ràng giữa hồ sơ đạt và không đạt.”

**Chuyển slide:**  
“Những kết quả này không chỉ nằm trên lý thuyết mà được bảo chứng bởi toàn bộ hệ thống kiểm thử tự động.”

---

## Slide 7 — Technical Highlights

**Thời gian:** ~60 giây  
**Thông điệp chính:** Hệ thống được phát triển chuẩn chỉ với kiểm thử tự động, CI/CD và số liệu đo kiểm thực tế.

**Nội dung nói:**  
“Career Assistant không phải là một bản prototype chỉ chạy được một lần lúc demo. Đội ngũ đã thiết lập quy chuẩn kỹ thuật nghiêm ngặt ngay từ đầu:  
Hệ thống hiện có hơn **745 test cases backend** với pytest và **159 tests frontend** với Jest.  
Về mặt hiệu năng, đo kiểm trên tập 52 CV và 98 JD cho thấy độ trễ truy xuất P95 chỉ ở mức **dưới 1.2 giây** (1,152.9 ms) và độ phủ **Recall@30 đạt 71.7%**.  
Mọi thay đổi mã nguồn đều phải vượt qua pipeline CI/CD 5 bước tự động trên GitHub Actions: từ linting với Ruff, chạy toàn bộ test suite, kiểm tra TypeScript, build Next.js cho đến khi các quality gates đều xanh mới được deploy lên môi trường Vercel và Render.”

**Chuyển slide:**  
“Sau đây, nhóm xin dành ít phút để Hội Đồng tận mắt theo dõi sản phẩm hoạt động trong thực tế.”

---

## Slide 8 — Demo Video

**Thời gian:** ~20 giây giới thiệu + 2 phút 30 giây chiếu video  
**Thông điệp chính:** Quan sát luồng dữ liệu CV/JD được duy trì xuyên suốt từ so khớp đến phỏng vấn giọng nói.

**Nội dung nói trước khi phát video:**  
“Thay vì tiếp tục mô tả bằng lời, nhóm xin dành khoảng 2 đến 3 phút để kính mời Ban Tổ Chức và Hội Đồng cùng theo dõi video trải nghiệm thực tế.  
Trong video, xin Hội Đồng chú ý cách một dữ liệu CV và JD duy nhất được giữ xuyên suốt từ bước chấm điểm FitScore, phân tích lỗ hổng kỹ năng, cho đến phòng phỏng vấn giọng nói tương tác thời gian thực.”

*(Bật video demo — người thuyết trình giữ im lặng hoặc chỉ thuyết minh ngắn gọn khi chuyển tính năng chính)*

**Chuyển slide sau khi video kết thúc:**  
“Để hoàn thiện được trải nghiệm liền mạch như vậy, nhóm đã trải qua nhiều bài học kỹ thuật quan trọng trong quá trình phát triển.”

---

## Slide 9 — Challenges & Learnings

**Thời gian:** ~55 giây  
**Thông điệp chính:** Trưởng thành qua các bài toán kỹ thuật thực tế và tư duy thiết kế hệ thống nghiêm túc.

**Nội dung nói:**  
“Trong suốt quá trình xây dựng sản phẩm, nhóm đã đối mặt với 3 thách thức kỹ thuật lớn:  
**Thứ nhất**, khi để LLM tự chấm điểm, kết quả giữa các lần chạy bị dao động → Nhóm giải quyết bằng cách chuyển toàn bộ việc tính toán sang logic Backend tất định.  
**Thứ hai**, việc so khớp toàn bộ 98 JD cùng lúc gây nghẽn và phản hồi rất chậm → Nhóm chuyển sang kiến trúc 2-Stage Retrieval, lọc thô Top-30 trước khi phân tích sâu, giảm thời gian gợi ý từ hơn 15 giây xuống dưới 1.8 giây.  
**Thứ ba**, phỏng vấn giọng nói dễ bị trôi kịch bản → Nhóm áp dụng State Machine 8 phases một chiều (forward-only) kết hợp cơ chế phục hồi WebSocket.  
Và bài học lớn nhất của nhóm là: **Nếu được làm lại từ đầu, chúng em sẽ xây dựng bộ khung đánh giá (Evaluation) và chốt chặn an toàn (Guardrails) ngay từ Sprint 1**.”

**Chuyển slide:**  
“Cuối cùng, nhóm xin chia sẻ về đội ngũ thực hiện và lộ trình phát triển tiếp theo.”

---

## Slide 10 — Team & Next Steps

**Thời gian:** ~40 giây  
**Thông điệp chính:** Định hướng phát triển tập trung vào đo lường giá trị thực tế cho người dùng và mở đầu phần Q&A.

**Nội dung nói:**  
“Dự án được xây dựng bởi 4 thành viên nhóm WinTop dưới sự hướng dẫn của Mentor Trần Vũ Anh: bạn Thanh Hiền phụ trách Frontend & Project Lead, bạn Hữu Trường phụ trách AI & Systems, bạn Xuân Đức phụ trách Backend Core, và bạn Minh Quân phụ trách QA & Evaluation.  
Về lộ trình tiếp theo, nhóm định hướng theo 4 bước tăng trưởng sản phẩm:  
Bắt đầu với **PILOT** thử nghiệm cùng sinh viên và Career Center → **VALIDATE** đo lường sự tiến bộ về chất lượng hồ sơ và sự tự tin phỏng vấn → **EXPAND** mở rộng danh mục JD và kết nối đối tác tuyển dụng → và **SCALE** tối ưu hóa mở rộng quy mô.  
Nhóm em tin rằng bước đi quan trọng nhất lúc này không phải là nhồi nhét thêm thật nhiều tính năng AI, mà là đưa sản phẩm đến tay người dùng thật để kiểm chứng giá trị thực tế.  
Nhóm WinTop xin chân thành cảm ơn Ban Tổ Chức và Hội Đồng Đánh Giá. Chúng em rất mong nhận được các câu hỏi và đóng góp từ thầy cô!”

---

# ⏱️ Timing Summary

| STT | Slide | Nội dung chính | Thời lượng dự kiến |
| :---: | :--- | :--- | :---: |
| 01 | **Title** | Giới thiệu dự án & Nhóm WinTop | 30s |
| 02 | **Problem** | Khó khăn thực tế của sinh viên | 50s |
| 03 | **Solution** | Luồng giải pháp liên tục & Nguyên tắc Evidence | 50s |
| 04 | **Product** | 6 bước người dùng & Dữ liệu sản phẩm thực | 50s |
| 05 | **Architecture** | Kiến trúc 5 tầng, LangGraph & pgvector | 60s |
| 06 | **AI / LLM Approach** | Evidence flow, 3 nguyên tắc & FitScore formula | 70s |
| 07 | **Technical Highlights**| Test suite, Benchmark & CI/CD pipeline | 60s |
| 08 | **Demo Video** | Giới thiệu ngắn (20s) + Trình chiếu video demo | ~2m 50s |
| 09 | **Challenges** | 3 bài học kỹ thuật & Tư duy cải tiến | 55s |
| 10 | **Team & Next Steps** | Đội ngũ, Roadmap tăng trưởng & Mời Q&A | 40s |
| **TỔNG** | **Toàn bộ bài thuyết trình** | *(Bao gồm cả video demo và chuyển tiếp)* | **~8 phút 35 giây** |

*(Dự phòng: 1 phút 25 giây cho các tình huống kỹ thuật và bắt đầu phiên Q&A đúng khung 10 phút)*

---

# 🔁 Kế hoạch 3 Lần Luyện tập (3 Rehearsals)

- **Lần 1 — Nắm vững câu chuyện (Content & Flow)**:
  - Tập trung ghi nhớ mạch dẫn dắt logic từ Nỗi đau → Giải pháp → Chứng minh kỹ thuật → Trải nghiệm thực tế.
  - Không nhìn tài liệu, nói tự nhiên theo ý chính từng slide.
- **Lần 2 — Kiểm soát thời gian (Pacing & Timing)**:
  - Bật đồng hồ bấm giờ (timer). Đảm bảo mỗi slide nằm trong khoảng 30–70 giây quy định.
  - Kiểm soát đoạn mở đầu video demo ngắn gọn dưới 20 giây để không lẹm vào thời lượng phát video.
- **Lần 3 — Mô phỏng Demo Day (Full Simulation)**:
  - Bật chế độ Fullscreen trên trình duyệt, kết nối máy chiếu / màn hình ngoài.
  - Thuyết trình liền mạch kết hợp bật phát video demo, giả định có sự cố ngắt quãng và chuyển giao mượt mà sang phần phản biện Q&A với tài liệu `SPEAKER_NOTES.md`.
