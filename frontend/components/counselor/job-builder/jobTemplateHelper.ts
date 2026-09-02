import { JobSectionData } from './JobSectionBlock';

export function buildJobTemplateContent(
  title: string,
  level: string = 'Middle',
  department: string = '',
  tags: string[] = []
): JobSectionData[] {
  const t = (title || 'Kỹ sư phần mềm').trim();
  const lower = t.toLowerCase();

  let overview = `<p>Chúng tôi đang tìm kiếm một <strong>${t}</strong> (${level}) tài năng và nhiệt huyết gia nhập đội ngũ ${department || 'Công nghệ & Sản phẩm'}. Bạn sẽ đóng vai trò then chốt trong việc phát triển các giải pháp phần mềm hiện đại, tối ưu trải nghiệm người dùng và mở rộng quy mô hệ thống.</p>`;

  let responsibilities = `<ul>
    <li>Chủ trì và tham gia phân tích, thiết kế kiến trúc hệ thống cho các tính năng mới của vị trí <strong>${t}</strong>.</li>
    <li>Phát triển mã nguồn chất lượng cao, tuân thủ các tiêu chuẩn clean code, testing và bảo mật.</li>
    <li>Phối hợp chặt chẽ cùng Product Owner, Designer và đội ngũ QA để đảm bảo tiến độ và chất lượng sản phẩm.</li>
    <li>Tham gia review code, tối ưu hóa hiệu năng và xử lý sự cố kỹ thuật trong môi trường production.</li>
    <li>Nghiên cứu, cập nhật các công nghệ mới nhằm nâng cao năng suất của toàn đội ngũ.</li>
  </ul>`;

  let mustHave = `<ul>
    <li>Tối thiểu <strong>${level === 'Senior' ? '3-5 năm' : level === 'Junior' ? '1 năm' : '2-3 năm'} kinh nghiệm thực tế</strong> trong vai trò ${t} hoặc tương đương.</li>
    <li>Thành thạo các công nghệ cốt lõi: <strong>${tags.length ? tags.join(', ') : 'Tech stack chuyên môn liên quan'}</strong>.</li>
    <li>Nắm vững kiến trúc phần mềm, cơ sở dữ liệu quan hệ/NoSQL và tối ưu truy vấn dữ liệu.</li>
    <li>Có kinh nghiệm làm việc với Git, Docker và quy trình phát triển CI/CD.</li>
    <li>Tư duy logic tốt, khả năng tự giải quyết vấn đề và kỹ năng làm việc nhóm hiệu quả.</li>
  </ul>`;

  const niceToHave = `<ul>
    <li>Có kinh nghiệm với hệ thống phân tán (Microservices) hoặc điện toán đám mây (AWS / GCP / Cloudflare).</li>
    <li>Hiểu biết về GenAI APIs, Vector Search hoặc xử lý dữ liệu lớn là điểm cộng lớn.</li>
    <li>Khả năng đọc hiểu tài liệu chuyên ngành và giao tiếp tiếng Anh tốt.</li>
  </ul>`;

  const benefits = `<table class="word-editor-table" style="width: 100%; border-collapse: collapse; margin: 12px 0;">
    <thead>
      <tr>
        <th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Hạng mục</th>
        <th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Chế độ đãi ngộ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Lương & Thưởng</strong></td>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;">Mức lương cạnh tranh theo năng lực, tháng 13 + thưởng KPI hiệu quả kinh doanh lên tới 3 tháng lương</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Bảo hiểm & Sức khỏe</strong></td>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;">Đóng full BHXH trên lương thực nhận + Gói bảo hiểm sức khỏe cao cấp Bảo Việt Premium</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Thiết bị & Môi trường</strong></td>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;">Cung cấp MacBook Pro M3 / laptop cao cấp, chế độ làm việc Hybrid linh hoạt, phụ cấp ăn trưa</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Đào tạo & Phát triển</strong></td>
        <td style="border: 1px solid #d1d5db; padding: 8px 12px;">Ngân sách $500/năm học tập chứng chỉ quốc tế, lộ trình thăng tiến rõ ràng</td>
      </tr>
    </tbody>
  </table>`;

  if (lower.includes('ai') || lower.includes('machine learning') || lower.includes('data') || lower.includes('llm')) {
    overview = `<p>Chúng tôi đang tìm kiếm <strong>${t}</strong> (${level}) gia nhập phòng nghiên cứu và ứng dụng AI. Bạn sẽ trực tiếp tham gia xây dựng, tinh chỉnh và triển khai các mô hình AI/ML, LLM, RAG và xử lý ngôn ngữ tự nhiên phục vụ hệ sinh thái tuyển dụng thông minh.</p>`;
    responsibilities = `<ul>
      <li>Nghiên cứu, phát triển và fine-tune các mô hình AI/ML, NLP, Computer Vision hoặc LLM hiện đại.</li>
      <li>Xây dựng pipeline thu thập, tiền xử lý và embedding dữ liệu quy mô lớn (Vector Search, RAG).</li>
      <li>Tối ưu hóa độ trễ (latency), chi phí inference và triển khai mô hình lên production server.</li>
      <li>Phối hợp cùng backend team xây dựng API AI microservices độ ổn định cao.</li>
    </ul>`;
    mustHave = `<ul>
      <li>Tốt nghiệp ĐH chuyên ngành CNTT, Khoa học dữ liệu, Toán tin hoặc lĩnh vực liên quan.</li>
      <li>Thành thạo <strong>Python</strong>, PyTorch / TensorFlow, HuggingFace và các thư viện xử lý dữ liệu.</li>
      <li>Nắm vững kiến trúc Transformer, Prompt Engineering, RAG và Vector Databases (Qdrant, Milvus, Chroma).</li>
      <li>Kinh nghiệm xây dựng RESTful API (FastAPI) và đóng gói container với Docker.</li>
    </ul>`;
  } else if (lower.includes('front') || lower.includes('react') || lower.includes('next') || lower.includes('vue')) {
    overview = `<p>Chúng tôi đang tìm kiếm <strong>${t}</strong> (${level}) tài năng để tạo ra những giao diện người dùng đỉnh cao, tốc độ mượt mà và trải nghiệm tương tác trực quan cho sản phẩm.</p>`;
    responsibilities = `<ul>
      <li>Xây dựng và tối ưu hóa giao diện ứng dụng web hiện đại bằng React / Next.js và TypeScript.</li>
      <li>Phát triển các component tái sử dụng theo Design System chuẩn mực.</li>
      <li>Tối ưu hóa Core Web Vitals, hiệu năng render và khả năng tương thích đa thiết bị (Responsive).</li>
      <li>Tích hợp RESTful API / WebSocket và xử lý state management mượt mà.</li>
    </ul>`;
    mustHave = `<ul>
      <li>Tối thiểu ${level === 'Senior' ? '3-5 năm' : '2 năm'} kinh nghiệm phát triển Frontend chuyên sâu với <strong>React / Next.js, TypeScript</strong>.</li>
      <li>Thành thạo HTML5, CSS3/SCSS, Tailwind CSS, Responsive Design và Animation.</li>
      <li>Tư duy thẩm mỹ UI/UX tốt, chú trọng từng chi tiết vi tương tác (micro-interactions).</li>
      <li>Hiểu sâu về Client-side vs Server-side Rendering (SSR, SSG, ISR).</li>
    </ul>`;
  } else if (lower.includes('back') || lower.includes('python') || lower.includes('java') || lower.includes('golang') || lower.includes('node')) {
    overview = `<p>Chúng tôi đang tìm kiếm <strong>${t}</strong> (${level}) gia nhập đội ngũ Backend để thiết kế, phát triển và vận hành hệ thống lõi xử lý dữ liệu với độ ổn định và tính sẵn sàng cao.</p>`;
    responsibilities = `<ul>
      <li>Thiết kế, xây dựng và bảo trì các dịch vụ backend microservices hiệu năng cao.</li>
      <li>Phát triển RESTful / gRPC APIs bảo mật và xử lý dữ liệu với độ trễ thấp.</li>
      <li>Tối ưu hóa cơ sở dữ liệu quan hệ (PostgreSQL, MySQL) và cơ chế bộ nhớ đệm (Redis).</li>
      <li>Tham gia thiết kế kiến trúc phân tán và triển khai hệ thống với Docker, CI/CD.</li>
    </ul>`;
    mustHave = `<ul>
      <li>Tối thiểu ${level === 'Senior' ? '3-5 năm' : '2 năm'} kinh nghiệm backend với Python (FastAPI/Django), Node.js hoặc Go/Java.</li>
      <li>Thành thạo thiết kế Database Schema, Indexing và tối ưu hóa câu truy vấn SQL phức tạp.</li>
      <li>Nắm vững các nguyên lý OOP, SOLID, Clean Architecture và RESTful API Best Practices.</li>
      <li>Hiểu biết về Message Queue (Kafka, RabbitMQ) và caching strategies.</li>
    </ul>`;
  }

  return [
    { id: 'sec-overview', type: 'overview', title: '1. Giới thiệu tổng quan về vị trí', hint: 'Mô tả bối cảnh dự án, sứ mệnh của phòng ban và vai trò của vị trí trong công ty.', content: overview, isRequired: true },
    { id: 'sec-resp', type: 'responsibilities', title: '2. Trách nhiệm & Nhiệm vụ chính', hint: 'Liệt kê các đầu việc thực tế mà ứng viên sẽ đảm nhận hàng ngày.', content: responsibilities, isRequired: true },
    { id: 'sec-musthave', type: 'must_have', title: '3. Yêu cầu bắt buộc (Must-Have)', hint: 'Các kỹ năng, kinh nghiệm cốt lõi bắt buộc ứng viên phải có — dùng để đối chiếu hồ sơ.', content: mustHave, isRequired: true },
    { id: 'sec-nicetohave', type: 'nice_to_have', title: '4. Yêu cầu ưu tiên (Nice-To-Have)', hint: 'Điểm cộng giúp ứng viên nổi bật hơn trong quá trình tuyển chọn.', content: niceToHave, isRequired: false },
    { id: 'sec-benefits', type: 'benefits', title: '5. Quyền lợi & Đãi ngộ (Benefits)', hint: 'Chế độ lương thưởng, bảo hiểm, đào tạo và văn hóa doanh nghiệp.', content: benefits, isRequired: true },
  ];
}