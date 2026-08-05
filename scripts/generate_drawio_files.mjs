import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIRS = [
  join(__dirname, "..", "docs", "diagrams"),
  join(__dirname, "..", "..", "skill_diagram")
];
OUT_DIRS.forEach(dir => mkdirSync(dir, { recursive: true }));

// Strict XML Attribute Escaper
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createDrawioXml(diagramId, diagramName, width, height, cellXmlArray) {
  return `<mxfile host="app.diagrams.net" agent="Antigravity" modified="${new Date().toISOString()}" type="device" version="24.7.17">
  <diagram name="${esc(diagramName)}" id="${diagramId}">
    <mxGraphModel dx="${width}" dy="${height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cellXmlArray.join("\n")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

// ---------------------------------------------------------
// 1. SƠ ĐỒ PHÂN CẤP CHỨC NĂNG (FUNCTIONAL HIERARCHY)
// ---------------------------------------------------------
function generateHierarchy() {
  const cells = [];

  cells.push(
    `        <mxCell id="title" value="${esc("SƠ ĐỒ PHÂN CẤP CHỨC NĂNG HỆ THỐNG TRỢ LÝ NGHỀ NGHIỆP X")}" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=20;fontStyle=1;fontColor=#1E293B;" vertex="1" parent="1">
          <mxGeometry x="150" y="20" width="950" height="40" as="geometry" />
        </mxCell>`
  );

  cells.push(
    `        <mxCell id="root" value="${esc("🤖 HỆ THỐNG TRỢ LÝ NGHỀ NGHIỆP AI\n(CAREER ASSISTANT X)")}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#3B0764;strokeColor=#1E1035;fontColor=#FFFFFF;fontSize=15;fontStyle=1;align=center;" vertex="1" parent="1">
          <mxGeometry x="400" y="80" width="450" height="60" as="geometry" />
        </mxCell>`
  );

  const modules = [
    {
      id: "m1", title: "1. Quản lý Tài khoản & Phân quyền", x: 40, color: "#DAE8FC", stroke: "#2563EB",
      items: [
        "1.1. Đăng ký & Đăng nhập (Email / Google)",
        "1.2. Phân quyền Sinh viên / Doanh nghiệp / Cố vấn",
        "1.3. Quản lý Hồ sơ cá nhân"
      ]
    },
    {
      id: "m2", title: "2. Quản lý CV & Khởi tạo AI", x: 220, color: "#DAE8FC", stroke: "#2563EB",
      items: [
        "2.1. Tải lên tệp CV (PDF / Word)",
        "2.2. Nhập dữ liệu tạo CV bằng AI (3 Template ATS)",
        "2.3. Xem trước & Xác nhận thông tin THẬT (Anti-Hallucination)",
        "2.4. Tải CV đã tối ưu về máy (Export PDF)"
      ]
    },
    {
      id: "m3", title: "3. So khớp CV & Gap Analysis", x: 400, color: "#E1D5E7", stroke: "#7E22CE",
      items: [
        "3.1. So khớp CV với JD (Thư viện / Dán từ ngoài)",
        "3.2. Tính Match Score % & ATS Score",
        "3.3. Phân tích Kỹ năng còn thiếu (missingSkills)",
        "3.4. Guardrail Cảnh báo nghi vấn bịa đặt"
      ]
    },
    {
      id: "m4", title: "4. Phòng Phỏng vấn Thử AI", x: 580, color: "#FFE6CC", stroke: "#D97706",
      items: [
        "4.1. Khởi tạo phiên phỏng vấn (Bắt buộc CV + JD)",
        "4.2. Trích xuất thành phần STAR (Situation, Task, Action, Result)",
        "4.3. Đánh giá câu hỏi ngắn -> Đặt câu hỏi gợi mở",
        "4.4. Đánh giá điểm CSAT (1-5 sao) sau phiên",
        "4.5. Xuất Báo cáo tổng hợp & Đóng góp ý kiến"
      ]
    },
    {
      id: "m5", title: "5. Cổng Doanh nghiệp Tuyển dụng", x: 760, color: "#D5E8D4", stroke: "#16A34A",
      items: [
        "5.1. Đăng bài tuyển dụng (Tích hợp Qdrant Vector ID)",
        "5.2. Dashboard xếp hạng Top Candidate CV",
        "5.3. Xem hồ sơ & Duyệt / Từ chối ứng viên",
        "5.4. Gửi Email thông báo & Đặt lịch phỏng vấn"
      ]
    },
    {
      id: "m6", title: "6. Cổng Cố vấn Hướng nghiệp (HITL)", x: 940, color: "#FFF2CC", stroke: "#CA8A04",
      items: [
        "6.1. Xem báo cáo & Giám sát tiến độ Sinh viên",
        "6.2. Gửi phản hồi / bài tập cá nhân hóa (CounselorFeedback)",
        "6.3. Bổ sung ghi chú cố vấn vào Báo cáo STAR",
        "6.4. Giám sát tính liêm chính & Đạo đức AI"
      ]
    },
    {
      id: "m7", title: "7. AI Core & Vector Engine", x: 1120, color: "#F8CECC", stroke: "#DC2626",
      items: [
        "7.1. RAG + Reranker Vector Store (Qdrant)",
        "7.2. LangGraph Stateful Interview Agent",
        "7.3. STAR Rubric Evaluator (LLM-as-a-Judge)",
        "7.4. Anti-Hallucination Integrity Guardrail"
      ]
    }
  ];

  modules.forEach(m => {
    cells.push(
      `        <mxCell id="${m.id}" value="${esc(m.title)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${m.color};strokeColor=${m.stroke};strokeWidth=1.5;fontColor=#0F172A;fontSize=12;fontStyle=1;align=center;" vertex="1" parent="1">
            <mxGeometry x="${m.x}" y="200" width="160" height="60" as="geometry" />
          </mxCell>`
    );

    cells.push(
      `        <mxCell id="e_root_${m.id}" edge="1" parent="1" source="root" target="${m.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;strokeColor=#475569;strokeWidth=1.5;">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`
    );

    m.items.forEach((itemText, idx) => {
      const subId = `${m.id}_sub_${idx}`;
      const subY = 290 + idx * 60;
      cells.push(
        `        <mxCell id="${subId}" value="${esc(itemText)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${m.stroke};fontColor=#334155;fontSize=10;align=center;spacing=3;" vertex="1" parent="1">
              <mxGeometry x="${m.x}" y="${subY}" width="160" height="48" as="geometry" />
            </mxCell>`
      );

      cells.push(
        `        <mxCell id="e_${m.id}_${subId}" edge="1" parent="1" source="${m.id}" target="${subId}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;strokeColor=${m.stroke};strokeWidth=1;">
              <mxGeometry relative="1" as="geometry" />
            </mxCell>`
      );
    });
  });

  return createDrawioXml("hierarchy-p041", "Sơ đồ Phân cấp Chức năng", 1320, 650, cells);
}

// ---------------------------------------------------------
// 2. SƠ ĐỒ KIẾN TRÚC HỆ THỐNG MA TRẬN 3 CỘT KHÔNG CHỒNG CHÉO (NON-OVERLAPPING 3-COLUMN GRID)
// ---------------------------------------------------------
function generateArchitecture() {
  const cells = [];

  // Tiêu đề chính
  cells.push(
    `        <mxCell id="title" value="${esc('<div style="font-size:18px; font-weight:bold; color:#0F172A; text-align:center;">SƠ ĐỒ KIẾN TRÚC HỆ THỐNG TRỢ LÝ NGHỀ NGHIỆP X (CAREER ASSISTANT X)</div>')}" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;" vertex="1" parent="1">
          <mxGeometry x="150" y="20" width="1180" height="40" as="geometry" />
        </mxCell>`
  );

  // 5 Tầng chính (Panels)
  const panels = [
    { id: "p_client", label: "TẦNG A: CLIENT / PRESENTATION LAYER (Next.js 14+ Frontend Framework)", x: 50, y: 75, w: 1380, h: 210, stroke: "#0284C7", fill: "#F0F9FF" },
    { id: "p_backend", label: "TẦNG B: CORE BACKEND LAYER (Python - FastAPI Modular Monolith Architecture)", x: 50, y: 315, w: 1380, h: 260, stroke: "#7E22CE", fill: "#FAF5FF" },
    { id: "p_ai", label: "TẦNG C: AI ENGINE & LOGIC LAYER (LangGraph Agents & STAR Rubric Evaluator Engine)", x: 50, y: 605, w: 1380, h: 270, stroke: "#D97706", fill: "#FFFBEB" },
    { id: "p_data", label: "TẦNG D: LƯU TRỮ & DỮ LIỆU (DATABASE & VECTOR PERSISTENCE LAYER)", x: 50, y: 905, w: 1380, h: 200, stroke: "#059669", fill: "#ECFDF5" },
    { id: "p_infra", label: "TẦNG E: HẠ TẦNG & DEVOPS (INFRASTRUCTURE & AUTOMATED CI/CD PIPELINE)", x: 50, y: 1135, w: 1380, h: 190, stroke: "#DC2626", fill: "#FEF2F2" }
  ];

  panels.forEach(p => {
    cells.push(
      `        <mxCell id="${p.id}" value="${esc(`<div style="font-weight:bold; font-size:13px; color:${p.stroke}; spacing-left:10px;">${p.label}</div>`)}" style="rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=${p.fill};strokeColor=${p.stroke};strokeWidth=2;dashed=1;verticalAlign=top;align=left;spacingLeft=15;spacingTop=10;" vertex="1" parent="1">
            <mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry" />
          </mxCell>`
    );
  });

  // CỘT 1: Sinh viên & CV (x = 80)
  // CỘT 2: Cố vấn & Phỏng vấn (x = 530)
  // CỘT 3: Doanh nghiệp & Tuyển dụng (x = 980)

  // TẦNG A: Presentation Tier (x=80, 530, 980)
  const clients = [
    {
      id: "ui_student",
      title: "🎓 Student Portal (Trang Sinh viên)",
      details: [
        "<b>CV Engine UI:</b> Upload CV, Chọn JD, Gap Analysis, Duyệt HITL, 3 ATS Template",
        "<b>Mock Interview UI:</b> Room Chat Phỏng vấn (Typewriter), Nhận điểm STAR & Feedback"
      ],
      x: 80, y: 120, w: 420, h: 145, border: "#0284C7", titleColor: "#0369A1"
    },
    {
      id: "ui_counselor",
      title: "👨‍🏫 Counselor Portal (Trang Cố vấn - HITL)",
      details: [
        "<b>Student Monitoring:</b> Dashboard theo dõi tiến độ sinh viên",
        "<b>Evaluation Inspector:</b> Xem EvaluationReport phỏng vấn chi tiết",
        "<b>Feedback Form:</b> Form gửi nhận xét & giao bài tập bổ sung cho SV"
      ],
      x: 530, y: 120, w: 420, h: 145, border: "#0284C7", titleColor: "#0369A1"
    },
    {
      id: "ui_enterprise",
      title: "🏢 Enterprise Portal (Trang Doanh nghiệp)",
      details: [
        "<b>JD Management:</b> Form đăng bài tuyển dụng & Quản lý danh sách JD",
        "<b>Candidate Screening:</b> Bảng điều khiển xem danh sách Top Candidate CV",
        "<b>Interview Scheduling:</b> Duyệt hồ sơ & Gửi Email đặt lịch phỏng vấn"
      ],
      x: 980, y: 120, w: 420, h: 145, border: "#0284C7", titleColor: "#0369A1"
    }
  ];

  clients.forEach(c => {
    const htmlValue = `
<div style="padding:4px; text-align:left;">
  <div style="font-weight:bold; font-size:12px; color:${c.titleColor}; border-bottom:1px solid ${c.border}; padding-bottom:4px; margin-bottom:6px;">${c.title}</div>
  <div style="font-size:10px; color:#1E293B; line-height:1.4;">
    ${c.details.map(d => `• ${d}`).join('<br/>')}
  </div>
</div>`.trim();

    cells.push(
      `        <mxCell id="${c.id}" value="${esc(htmlValue)}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${c.border};strokeWidth=1.5;shadow=1;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" as="geometry" />
          </mxCell>`
    );
  });

  // TẦNG B: Core Backend Layer (Row 1: x=80, 530, 980 | Row 2: x=80, 530, 980)
  const backendModules = [
    {
      id: "backend_router",
      title: "🌐 API Gateway / Router (FastAPI Core)",
      desc: "• Định tuyến HTTP / WebSocket Requests<br/>• Kiểm soát CORS Policy & Middleware Rate-limiting",
      x: 80, y: 360, w: 420, h: 90, border: "#7E22CE", titleColor: "#6B21A8"
    },
    {
      id: "backend_auth",
      title: "🔒 Module Auth & Security",
      desc: "• Xử lý Đăng ký / Đăng nhập & Mã hóa mật khẩu (Bcrypt)<br/>• Phân quyền JWT cho 3 vai trò (Student, Counselor, Enterprise)",
      x: 530, y: 360, w: 420, h: 90, border: "#7E22CE", titleColor: "#6B21A8"
    },
    {
      id: "backend_resume",
      title: "📄 Module Resume & ATS Manager",
      desc: "• Tiếp nhận file CV gốc & Quản lý 3 Template ATS chuẩn<br/>• Xử lý logic Accept/Reject gợi ý (HITL) & Xuất file PDF",
      x: 980, y: 360, w: 420, h: 90, border: "#7E22CE", titleColor: "#6B21A8"
    },
    {
      id: "backend_jd",
      title: "💼 Module Job Description (JD) Manager",
      desc: "• Quản lý Ngân hàng JD Nội bộ doanh nghiệp<br/>• Chuẩn hóa dữ liệu JD dán từ các trang tuyển dụng bên ngoài",
      x: 80, y: 465, w: 420, h: 90, border: "#7E22CE", titleColor: "#6B21A8"
    },
    {
      id: "backend_interview",
      title: "🎙️ Module Interview Session Controller",
      desc: "• Điều phối vòng đời phiên phỏng vấn (Khởi tạo, Hỏi-Đáp, Kết thúc)<br/>• Ghi nhận đánh giá chỉ số hài lòng CSAT (1–5★)",
      x: 530, y: 465, w: 420, h: 90, border: "#7E22CE", titleColor: "#6B21A8"
    },
    {
      id: "backend_feedback",
      title: "💬 Module Counselor Feedback (HITL)",
      desc: "• Lưu trữ nhận xét & bài tập cá nhân hóa từ Cố vấn<br/>• Chuyển tiếp bài tập bổ sung đến giao diện Sinh viên",
      x: 980, y: 465, w: 420, h: 90, border: "#7E22CE", titleColor: "#6B21A8"
    }
  ];

  backendModules.forEach(m => {
    const htmlValue = `
<div style="padding:4px; text-align:left;">
  <div style="font-weight:bold; font-size:11px; color:${m.titleColor}; border-bottom:1px solid #E9D5FF; padding-bottom:3px; margin-bottom:4px;">${m.title}</div>
  <div style="font-size:10px; color:#334155; line-height:1.35;">${m.desc}</div>
</div>`.trim();

    cells.push(
      `        <mxCell id="${m.id}" value="${esc(htmlValue)}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${m.border};strokeWidth=1.5;shadow=1;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" as="geometry" />
          </mxCell>`
    );
  });

  // TẦNG C: AI Engine & Logic Cards (x=80, 530, 980)
  const aiModules = [
    {
      id: "ai_gap",
      title: "📝 CV Gap Analysis Agent (LangGraph)",
      desc: "• So sánh CV vs JD, chỉ ra khoảng cách kỹ năng còn thiếu<br/>• Đưa ra gợi ý cải thiện dựa trên kinh nghiệm THẬT (Guardrail)",
      x: 80, y: 650, w: 420, h: 100, border: "#D97706", titleColor: "#B45309"
    },
    {
      id: "ai_mock",
      title: "🗣️ Mock Interview Agent (LangGraph)",
      desc: "• Quản lý luồng hội thoại phỏng vấn đa vòng thông minh<br/>• Phát hiện câu trả lời ngắn/thiếu ý để hỏi đào sâu (Follow-up)",
      x: 530, y: 650, w: 420, h: 100, border: "#D97706", titleColor: "#B45309"
    },
    {
      id: "ai_star",
      title: "📊 Module STAR Evaluator & Rubric",
      desc: "• Phân rã câu trả lời thành 4 phần (Situation, Task, Action, Result)<br/>• Chấm điểm khách quan theo Rubric phỏng vấn chuẩn",
      x: 980, y: 650, w: 420, h: 100, border: "#D97706", titleColor: "#B45309"
    },
    {
      id: "ai_rag",
      title: "🔍 Module RAG & Vector Pipeline (Qdrant Reranker)",
      desc: "• Chunking dữ liệu JD/ATS/Rubric & Qdrant Semantic Search Engine Rerank bối cảnh",
      x: 80, y: 765, w: 640, h: 65, border: "#D97706", titleColor: "#B45309"
    },
    {
      id: "ai_guard",
      title: "🛡️ Module Guardrails & LLM Judge",
      desc: "• Kiểm tra tính liêm chính dữ liệu (chống hallucination) & Kiểm soát chi phí Token API",
      x: 760, y: 765, w: 640, h: 65, border: "#D97706", titleColor: "#B45309"
    }
  ];

  aiModules.forEach(a => {
    const htmlValue = `
<div style="padding:4px; text-align:left;">
  <div style="font-weight:bold; font-size:11px; color:${a.titleColor}; border-bottom:1px solid #FDE68A; padding-bottom:3px; margin-bottom:4px;">${a.title}</div>
  <div style="font-size:10px; color:#334155; line-height:1.35;">${a.desc}</div>
</div>`.trim();

    cells.push(
      `        <mxCell id="${a.id}" value="${esc(htmlValue)}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${a.border};strokeWidth=1.5;shadow=1;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" as="geometry" />
          </mxCell>`
    );
  });

  // TẦNG D: Database & Storage Cards (x=80, 530, 980)
  const dataNodes = [
    {
      id: "db_postgres",
      title: "🐘 Relational Database (PostgreSQL)",
      details: [
        "<b>Dữ liệu Cấu trúc:</b> User, Student, Counselor, Enterprise",
        "<b>Hồ sơ & Phỏng vấn:</b> Resume, InterviewSession, InterviewQALog",
        "<b>Báo cáo & HITL:</b> EvaluationReport, CounselorFeedback"
      ],
      x: 80, y: 950, w: 420, h: 135, border: "#059669", titleColor: "#047857"
    },
    {
      id: "db_vector",
      title: "🔍 Vector Database (Qdrant)",
      details: [
        "<b>JD Embeddings:</b> Ngân hàng JD tuyển dụng chuẩn hóa",
        "<b>ATS Criteria:</b> Bộ tiêu chí quét CV theo chuẩn ATS",
        "<b>STAR Rubrics:</b> Bộ tiêu chuẩn đánh giá phỏng vấn STAR"
      ],
      x: 530, y: 950, w: 420, h: 135, border: "#059669", titleColor: "#047857"
    },
    {
      id: "db_storage",
      title: "📦 File Storage (AWS S3 / MinIO / Local)",
      details: [
        "<b>File CV Gốc:</b> Tệp tin PDF / DOCX sinh viên tải lên",
        "<b>File CV Tối ưu:</b> Tệp PDF CV đã qua xử lý xuất ra",
        "<b>Lưu trữ An toàn:</b> Mã hóa tệp tin & Phân quyền truy cập"
      ],
      x: 980, y: 950, w: 420, h: 135, border: "#059669", titleColor: "#047857"
    }
  ];

  dataNodes.forEach(d => {
    const htmlValue = `
<div style="padding:4px; text-align:left;">
  <div style="font-weight:bold; font-size:12px; color:${d.titleColor}; border-bottom:1px solid #A7F3D0; padding-bottom:4px; margin-bottom:6px;">${d.title}</div>
  <div style="font-size:10px; color:#1E293B; line-height:1.4;">
    ${d.details.map(item => `• ${item}`).join('<br/>')}
  </div>
</div>`.trim();

    cells.push(
      `        <mxCell id="${d.id}" value="${esc(htmlValue)}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${d.border};strokeWidth=1.5;shadow=1;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" as="geometry" />
          </mxCell>`
    );
  });

  // TẦNG E: Infrastructure & DevOps Cards (x=80, 530, 980)
  const infraNodes = [
    {
      id: "infra_docker",
      title: "🐳 Docker & Docker Compose Containerization",
      desc: "• Đóng gói Containers độc lập: nextjs-frontend, fastapi-backend, qdrant-db, postgres-db",
      x: 80, y: 1180, w: 420, h: 120, border: "#DC2626", titleColor: "#B91C1C"
    },
    {
      id: "infra_nginx",
      title: "🌐 Nginx Reverse Proxy & Security Load Balancer",
      desc: "• Cấu hình SSL / TLS Encryption & Cân bằng tải Load Balancing Traffic",
      x: 530, y: 1180, w: 420, h: 120, border: "#DC2626", titleColor: "#B91C1C"
    },
    {
      id: "infra_cicd",
      title: "⚡ CI/CD Pipeline (GitHub Actions Automation)",
      desc: "• Tự động hóa Auto Testing, Build Docker Image & Deploy Staging Server",
      x: 980, y: 1180, w: 420, h: 120, border: "#DC2626", titleColor: "#B91C1C"
    }
  ];

  infraNodes.forEach(i => {
    const htmlValue = `
<div style="padding:4px; text-align:left;">
  <div style="font-weight:bold; font-size:11px; color:${i.titleColor}; border-bottom:1px solid #FECACA; padding-bottom:3px; margin-bottom:4px;">${i.title}</div>
  <div style="font-size:10px; color:#334155; line-height:1.35;">${i.desc}</div>
</div>`.trim();

    cells.push(
      `        <mxCell id="${i.id}" value="${esc(htmlValue)}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${i.border};strokeWidth=1.5;shadow=1;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" as="geometry" />
          </mxCell>`
    );
  });

  // MŨI TÊN CHỈ ĐI THẲNG DỌC CÙNG CỘT (PARALLEL NON-CROSSING VERTICAL FLOWS)
  const edges = [
    // Cột 1 Flows (x=80)
    { from: "ui_student", to: "backend_router", label: "HTTPS / WebSocket Stream" },
    { from: "backend_router", to: "backend_jd", label: "REST Requests" },
    { from: "backend_jd", to: "ai_gap", label: "Trigger Gap Analysis" },
    { from: "ai_gap", to: "db_postgres", label: "Save Gap Results" },

    // Cột 2 Flows (x=530)
    { from: "ui_counselor", to: "backend_auth", label: "JWT Auth Check" },
    { from: "backend_auth", to: "backend_interview", label: "Session Control" },
    { from: "backend_interview", to: "ai_mock", label: "STAR Interview Loop" },
    { from: "ai_mock", to: "db_vector", label: "Qdrant RAG Query" },

    // Cột 3 Flows (x=980)
    { from: "ui_enterprise", to: "backend_resume", label: "Manage ATS Resume" },
    { from: "backend_resume", to: "backend_feedback", label: "Forward Feedback" },
    { from: "backend_feedback", to: "ai_star", label: "STAR Rubric Judge" },
    { from: "ai_star", to: "db_storage", label: "Export PDF & File Store" }
  ];

  edges.forEach((e, idx) => {
    cells.push(
      `        <mxCell id="edge_arch_${idx}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=#475569;strokeWidth=1.5;fontSize=9;fontColor=#334155;backgroundOutline=1;" edge="1" parent="1" source="${e.from}" target="${e.to}">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`
    );
  });

  return createDrawioXml("architecture-p041", "Sơ đồ Kiến trúc Hệ thống", 1480, 1380, cells);
}

// ---------------------------------------------------------
// 3. SƠ ĐỒ LUỒNG NGƯỜI DÙNG (USER FLOW ACTIVITY)
// ---------------------------------------------------------
function generateUserFlow() {
  const cells = [];

  cells.push(
    `        <mxCell id="title" value="${esc("SƠ ĐỒ LUỒNG NGƯỜI DÙNG CHI TIẾT (USER FLOW ACTIVITY DIAGRAM)")}" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=20;fontStyle=1;fontColor=#1E293B;" vertex="1" parent="1">
          <mxGeometry x="150" y="20" width="950" height="40" as="geometry" />
        </mxCell>`
  );

  const swimlanes = [
    { id: "lane_ent", label: "🏢 DOANH NGHIỆP TUYỂN DỤNG", x: 60, y: 80, w: 290, h: 950, fill: "#D5E8D4", stroke: "#16A34A" },
    { id: "lane_adv", label: "👨‍🏫 CỐ VẤN HƯỚNG NGHIỆP (HITL)", x: 350, y: 80, w: 250, h: 950, fill: "#FFF2CC", stroke: "#CA8A04" },
    { id: "lane_stu", label: "🎓 SINH VIÊN ỨNG TUYỂN", x: 600, y: 80, w: 330, h: 950, fill: "#DAE8FC", stroke: "#2563EB" },
    { id: "lane_ai", label: "🤖 TRỢ LÝ AI & MOCK INTERVIEW", x: 930, y: 80, w: 330, h: 950, fill: "#FFE6CC", stroke: "#D97706" }
  ];

  swimlanes.forEach(s => {
    cells.push(
      `        <mxCell id="${s.id}" value="${esc(s.label)}" style="swimlane;whiteSpace=wrap;html=1;startSize=35;fillColor=${s.fill};strokeColor=${s.stroke};fontColor=#0F172A;fontSize=13;fontStyle=1;" vertex="1" parent="1">
            <mxGeometry x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" as="geometry" />
          </mxCell>`
    );
  });

  // Enterprise Track
  const entNodes = [
    { id: "e1", label: "1. Đăng bài tuyển dụng (Thư viện / Dán JD)", y: 130 },
    { id: "e2", label: "2. Nhận thông báo Sinh viên nộp CV", y: 340 },
    { id: "e3", label: "3. Xem Dashboard danh sách Top CV", y: 440 },
    { id: "e_dec", label: "Doanh nghiệp Duyệt?", y: 540, shape: "rhombus" },
    { id: "e_app", label: "ĐƯỢC DUYỆT:\nGửi email & Đặt lịch phỏng vấn", y: 660 },
    { id: "e_rej", label: "TỪ CHỐI:\nGửi email thông báo từ chối", y: 770 }
  ];

  entNodes.forEach(n => {
    const parent = "lane_ent";
    if (n.shape === "rhombus") {
      cells.push(
        `        <mxCell id="${n.id}" value="${esc(n.label)}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#FFFFC0;strokeColor=#CA8A04;fontColor=#0F172A;fontSize=11;fontStyle=1;" vertex="1" parent="${parent}">
              <mxGeometry x="75" y="${n.y}" width="140" height="80" as="geometry" />
            </mxCell>`
      );
    } else {
      cells.push(
        `        <mxCell id="${n.id}" value="${esc(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#16A34A;fontColor=#0F172A;fontSize=11;align=center;" vertex="1" parent="${parent}">
              <mxGeometry x="40" y="${n.y}" width="210" height="55" as="geometry" />
            </mxCell>`
      );
    }
  });

  // Advisor Track
  const advNodes = [
    { id: "a1", label: "1. Xem danh sách Sinh viên phụ trách", y: 130 },
    { id: "a2", label: "2. Theo dõi tiến độ CV & Kết quả Phỏng vấn", y: 340 },
    { id: "a3", label: "3. Gửi Nhận xét & Bài tập (CounselorFeedback)", y: 440 },
    { id: "a4", label: "4. Giám sát tính liêm chính & Đạo đức AI", y: 660 }
  ];

  advNodes.forEach(n => {
    cells.push(
      `        <mxCell id="${n.id}" value="${esc(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#CA8A04;fontColor=#0F172A;fontSize=11;align=center;" vertex="1" parent="lane_adv">
            <mxGeometry x="30" y="${n.y}" width="190" height="55" as="geometry" />
          </mxCell>`
    );
  });

  // Student Track
  const stuNodes = [
    { id: "s1", label: "Bắt đầu: Đăng nhập Sinh viên", y: 130 },
    { id: "s_dec_cv", label: "Đã có sẵn CV?", y: 210, shape: "rhombus" },
    { id: "s_up", label: "CÓ CV: Upload PDF & Parse dữ liệu", y: 310 },
    { id: "s_create", label: "CHƯA CÓ CV: Chọn 1/3 Template ATS", y: 310 },
    { id: "s_match", label: "Chọn JD -> Xem ATS Score & Gap", y: 440 },
    { id: "s_opt", label: "Duyệt Accept/Reject gợi ý (Xác nhận THẬT)", y: 560 },
    { id: "s_sub", label: "Xuất file PDF & Nộp cho Doanh nghiệp", y: 660 },
    { id: "s_int_start", label: "Vào Phỏng vấn -> Đánh giá điểm CSAT (1-5★)", y: 770 }
  ];

  stuNodes.forEach(n => {
    const parent = "lane_stu";
    if (n.shape === "rhombus") {
      cells.push(
        `        <mxCell id="${n.id}" value="${esc(n.label)}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#FFFFC0;strokeColor=#CA8A04;fontColor=#0F172A;fontSize=11;fontStyle=1;" vertex="1" parent="${parent}">
              <mxGeometry x="95" y="${n.y}" width="140" height="75" as="geometry" />
            </mxCell>`
      );
    } else {
      cells.push(
        `        <mxCell id="${n.id}" value="${esc(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#2563EB;fontColor=#0F172A;fontSize=11;align=center;" vertex="1" parent="${parent}">
              <mxGeometry x="50" y="${n.y}" width="230" height="55" as="geometry" />
            </mxCell>`
      );
    }
  });

  // AI Track
  const aiNodes = [
    { id: "ai_parse", label: "AI Parse CV & Cảnh báo missingInformation", y: 310 },
    { id: "ai_gap", label: "AI RAG Vector Search & ATS Score", y: 440 },
    { id: "ai_opt", label: "AI Đề xuất Tối ưu (Guardrail Check)", y: 560 },
    { id: "ai_val", label: "Kiểm tra CV + JD -> Bắt đầu phỏng vấn", y: 770 },
    { id: "ai_q_loop", label: "AI Trích xuất STAR -> Phỏng vấn & Follow-up", y: 860 }
  ];

  aiNodes.forEach(n => {
    const parent = "lane_ai";
    cells.push(
      `        <mxCell id="${n.id}" value="${esc(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#D97706;fontColor=#0F172A;fontSize=11;align=center;" vertex="1" parent="${parent}">
            <mxGeometry x="50" y="${n.y}" width="230" height="55" as="geometry" />
          </mxCell>`
    );
  });

  // Edges
  const flowEdges = [
    { from: "s1", to: "s_dec_cv", label: "" },
    { from: "s_dec_cv", to: "s_up", label: "Có CV" },
    { from: "s_dec_cv", to: "s_create", label: "Chưa CV" },
    { from: "s_up", to: "ai_parse", label: "" },
    { from: "s_create", to: "ai_parse", label: "" },
    { from: "ai_parse", to: "s_match", label: "" },
    { from: "s_match", to: "ai_gap", label: "" },
    { from: "ai_gap", to: "ai_opt", label: "" },
    { from: "ai_opt", to: "s_opt", label: "" },
    { from: "s_opt", to: "s_sub", label: "" },
    { from: "s_sub", to: "e2", label: "Nộp đơn" },
    { from: "e2", to: "e3", label: "" },
    { from: "e3", to: "e_dec", label: "" },
    { from: "e_dec", to: "e_app", label: "Duyệt" },
    { from: "e_dec", to: "e_rej", label: "Từ chối" },
    { from: "s_opt", to: "s_int_start", label: "Luyện phỏng vấn" },
    { from: "s_int_start", to: "ai_val", label: "" },
    { from: "ai_val", to: "ai_q_loop", label: "Đủ CV+JD" }
  ];

  flowEdges.forEach((e, idx) => {
    cells.push(
      `        <mxCell id="edge_flow_${idx}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;strokeColor=#475569;fontSize=10;" edge="1" parent="1" source="${e.from}" target="${e.to}">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`
    );
  });

  return createDrawioXml("userflow-p041", "Sơ đồ Luồng Người dùng", 1300, 1050, cells);
}

// ---------------------------------------------------------
// 4. SƠ ĐỒ LỚP (UML CLASS DIAGRAM - ENHANCED CLASS DETAILS)
// ---------------------------------------------------------
function generateClassDiagram() {
  const cells = [];

  cells.push(
    `        <mxCell id="title" value="${esc("UML CLASS DIAGRAM - CAREER ASSISTANT X SYSTEM (DETAILED USAGE SPEC)")}" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=20;fontStyle=1;fontColor=#1E293B;" vertex="1" parent="1">
          <mxGeometry x="150" y="20" width="1050" height="40" as="geometry" />
        </mxCell>`
  );

  const classes = [
    {
      id: "cls_user", name: "User (Base Class)", x: 50, y: 80, w: 230, h: 160,
      attrs: ["+ id: string", "+ email: string", "+ passwordHash: string", "+ fullName: string", "+ role: UserRole", "+ createdAt: DateTime"],
      methods: ["+ register(): void", "+ login(): void"]
    },
    {
      id: "cls_student", name: "Student (Actor 1)", x: 50, y: 280, w: 230, h: 160,
      attrs: ["+ university: string", "+ major: string", "+ graduationYear: int", "+ phone: string"],
      methods: ["+ getResumes(): Resume[]", "+ getSessions(): Session[]"]
    },
    {
      id: "cls_counselor", name: "Counselor (Actor 2 - HITL)", x: 50, y: 480, w: 230, h: 160,
      attrs: ["+ department: string", "+ title: string"],
      methods: ["+ sendFeedback(studentId, text): void", "+ getAssignedStudents(): Student[]"]
    },
    {
      id: "cls_enterprise", name: "Enterprise (Actor 3)", x: 330, y: 80, w: 240, h: 160,
      attrs: ["+ companyName: string", "+ industry: string", "+ website: string"],
      methods: ["+ getJobDescriptions(): JD[]", "+ reviewCandidates(): void"]
    },
    {
      id: "cls_resume", name: "Resume", x: 330, y: 280, w: 260, h: 210,
      attrs: ["+ id: string", "+ studentId: string", "+ title: string", "+ templateId: string (3 ATS)", "+ rawFilePath: string", "+ parsedContent: JSON", "+ acceptedSuggestions: JSON", "+ missingInformation: List<string>", "+ isVerifiedReal: boolean"],
      methods: ["+ acceptSuggestion(id): void", "+ rejectSuggestion(id): void", "+ exportPdf(): File"]
    },
    {
      id: "cls_feedback", name: "CounselorFeedback (HITL)", x: 330, y: 530, w: 260, h: 180,
      attrs: ["+ id: string", "+ counselorId: string", "+ studentId: string", "+ sessionId: string", "+ reportId: string", "+ feedbackText: string", "+ assignedTask: string", "+ createdAt: DateTime"],
      methods: ["+ sendFeedback(): void"]
    },
    {
      id: "cls_jd", name: "JobDescription", x: 630, y: 80, w: 260, h: 180,
      attrs: ["+ id: string", "+ enterpriseId: string", "+ title: string", "+ descriptionText: string", "+ requiredSkills: List<string>", "+ sourceType: JdSourceType", "+ vectorId: string (Qdrant)"],
      methods: ["+ postJD(): void", "+ updateJD(): void"]
    },
    {
      id: "cls_match", name: "CvJdMatch", x: 630, y: 300, w: 260, h: 190,
      attrs: ["+ id: string", "+ resumeId: string", "+ jdId: string", "+ matchScore: float", "+ atsScore: float", "+ missingSkills: List<string>", "+ guardrailFlags: List<string>", "+ gapAnalysis: JSON"],
      methods: ["+ calculateMatch(): float"]
    },
    {
      id: "cls_session", name: "InterviewSession", x: 940, y: 80, w: 270, h: 200,
      attrs: ["+ id: string", "+ studentId: string", "+ resumeId: string", "+ jdId: string", "+ totalQuestions: int", "+ currentStep: int", "+ overallScore: float", "+ status: SessionStatus", "+ csatScore: int (1-5★)", "+ csatFeedback: string"],
      methods: ["+ startSession(): void", "+ completeSession(): void", "+ submitCSAT(score, text): void"]
    },
    {
      id: "cls_qa", name: "InterviewQALog", x: 940, y: 310, w: 270, h: 210,
      attrs: ["+ id: string", "+ sessionId: string", "+ questionNumber: int", "+ questionText: string", "+ studentAnswer: string", "+ situationText: string", "+ taskText: string", "+ actionText: string", "+ resultText: string", "+ isFollowUpRequired: boolean", "+ starScores: JSON"],
      methods: ["+ saveQA(): void"]
    },
    {
      id: "cls_report", name: "EvaluationReport", x: 940, y: 550, w: 270, h: 180,
      attrs: ["+ id: string", "+ sessionId: string", "+ overallScore: float", "+ starScores: JSON", "+ detailedFeedbacks: List<string>", "+ counselorNotes: string", "+ disclaimerText: string"],
      methods: ["+ generateReport(): Report"]
    }
  ];

  classes.forEach(c => {
    const rawHtml = `<b>${c.name}</b><hr/>${c.attrs.join("<br/>")}<hr/>${c.methods.join("<br/>")}`;
    cells.push(
      `        <mxCell id="${c.id}" value="${esc(rawHtml)}" style="swipeable=0;html=1;whiteSpace=wrap;fillColor=#DAE8FC;strokeColor=#2563EB;fontColor=#0F172A;fontSize=10;align=left;spacingLeft=6;spacingRight=6;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" as="geometry" />
          </mxCell>`
    );
  });

  const classEdges = [
    { from: "cls_user", to: "cls_student", label: "Extends" },
    { from: "cls_user", to: "cls_counselor", label: "Extends" },
    { from: "cls_user", to: "cls_enterprise", label: "Extends" },
    { from: "cls_counselor", to: "cls_student", label: "supervises (1..*)" },
    { from: "cls_counselor", to: "cls_feedback", label: "sends (1..*)" },
    { from: "cls_student", to: "cls_feedback", label: "receives (1..*)" },
    { from: "cls_student", to: "cls_resume", label: "owns (1..*)" },
    { from: "cls_enterprise", to: "cls_jd", label: "posts (1..*)" },
    { from: "cls_resume", to: "cls_match", label: "analyzed_in (1..*)" },
    { from: "cls_jd", to: "cls_match", label: "target_in (1..*)" },
    { from: "cls_student", to: "cls_session", label: "practices (1..*)" },
    { from: "cls_session", to: "cls_qa", label: "contains (1..*)" },
    { from: "cls_session", to: "cls_report", label: "generates (1..1)" }
  ];

  classEdges.forEach((e, idx) => {
    cells.push(
      `        <mxCell id="edge_cls_${idx}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=open;strokeColor=#475569;fontSize=10;" edge="1" parent="1" source="${e.from}" target="${e.to}">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`
    );
  });

  return createDrawioXml("classdiagram-p041", "UML Class Diagram", 1300, 800, cells);
}

// ---------------------------------------------------------
// 5. SƠ ĐỒ CƠ SỞ DỮ LIỆU (DATABASE ERD ENHANCED)
// ---------------------------------------------------------
function generateDatabaseErd() {
  const cells = [];

  cells.push(
    `        <mxCell id="title" value="${esc("SƠ ĐỒ CƠ SỞ DỮ LIỆU (DATABASE ERD DIAGRAM) - TRỢ LÝ NGHỀ NGHIỆP X")}" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=20;fontStyle=1;fontColor=#1E293B;" vertex="1" parent="1">
          <mxGeometry x="150" y="20" width="950" height="40" as="geometry" />
        </mxCell>`
  );

  const tables = [
    {
      id: "tbl_users", name: "nguoi_dung (users)", x: 50, y: 80, w: 240, h: 180,
      cols: ["PK  ma_nguoi_dung : uuid", "UK  email : varchar", "    mat_khau_hash : varchar", "    ho_ten : varchar", "    vai_tro : varchar", "    ngay_tao : timestamp"]
    },
    {
      id: "tbl_students", name: "sinh_vien (students)", x: 50, y: 300, w: 240, h: 160,
      cols: ["PK  ma_sinh_vien : uuid", "FK  ma_nguoi_dung : uuid", "    truong_dai_hoc : varchar", "    chuyen_nganh : varchar", "    nam_tot_nghiep : int", "    so_dien_thoai : varchar"]
    },
    {
      id: "tbl_counselors", name: "co_van (counselors)", x: 50, y: 500, w: 240, h: 150,
      cols: ["PK  ma_co_van : uuid", "FK  ma_nguoi_dung : uuid", "    phong_ban : varchar", "    chuc_danh : varchar"]
    },
    {
      id: "tbl_enterprises", name: "doanh_nghiep (enterprises)", x: 330, y: 80, w: 250, h: 150,
      cols: ["PK  ma_doanh_nghiep : uuid", "FK  ma_nguoi_dung : uuid", "    ten_cong_ty : varchar", "    linh_vuc : varchar", "    website_url : varchar"]
    },
    {
      id: "tbl_resumes", name: "ho_so_cv (resumes)", x: 330, y: 280, w: 260, h: 200,
      cols: ["PK  ma_cv : uuid", "FK  ma_sinh_vien : uuid", "    tieu_de_cv : varchar", "    template_id : varchar (3 ATS)", "    duong_dan_file_goc : varchar", "    du_lieu_trich_xuat_json : jsonb", "    accepted_suggestions_json : jsonb", "    missing_info_json : jsonb", "    is_verified_real : boolean"]
    },
    {
      id: "tbl_feedback", name: "counselor_feedbacks", x: 330, y: 520, w: 260, h: 180,
      cols: ["PK  ma_feedback : uuid", "FK  ma_co_van : uuid", "FK  ma_sinh_vien : uuid", "FK  ma_phien_pv : uuid", "FK  ma_bao_cao : uuid", "    feedback_text : text", "    assigned_task : text", "    created_at : timestamp"]
    },
    {
      id: "tbl_jds", name: "bai_tuyen_dung (job_descriptions)", x: 630, y: 80, w: 270, h: 180,
      cols: ["PK  ma_jd : uuid", "FK  ma_doanh_nghiep : uuid", "    vi_tri_tuyen_dung : varchar", "    mo_ta_cong_viec : text", "    source_type : varchar (INTERNAL/EXTERNAL)", "    vector_id : varchar (Qdrant)"]
    },
    {
      id: "tbl_matches", name: "ket_qua_so_khop (cv_jd_matches)", x: 630, y: 300, w: 270, h: 180,
      cols: ["PK  ma_so_khop : uuid", "FK  ma_cv : uuid", "FK  ma_jd : uuid", "    diem_match_score : float", "    ats_score : float", "    missing_skills_json : jsonb", "    guardrail_flags_json : jsonb"]
    },
    {
      id: "tbl_sessions", name: "phien_phong_van (interview_sessions)", x: 940, y: 80, w: 270, h: 200,
      cols: ["PK  ma_phien_pv : uuid", "FK  ma_sinh_vien : uuid", "FK  ma_cv : uuid", "FK  ma_jd : uuid", "    tong_so_cau_hoi : int", "    current_step : int", "    trang_thai : varchar (IN_PROGRESS/DONE)", "    diem_tong_ket : float", "    csat_score : int (1-5★)", "    csat_feedback : text"]
    },
    {
      id: "tbl_logs", name: "nhat_ky_hoi_dap (interview_qa_logs)", x: 940, y: 300, w: 270, h: 220,
      cols: ["PK  ma_nhat_ky : uuid", "FK  ma_phien_pv : uuid", "    so_thu_tu_cau_hoi : int", "    question_text : text (Nội dung AI hỏi)", "    student_answer : text (Sinh viên trả lời)", "    situation_text : text (STAR)", "    task_text : text (STAR)", "    action_text : text (STAR)", "    result_text : text (STAR)", "    is_followup_required : boolean"]
    },
    {
      id: "tbl_evals", name: "bao_cao_danh_gia (evaluation_reports)", x: 940, y: 530, w: 270, h: 180,
      cols: ["PK  ma_bao_cao : uuid", "FK  ma_phien_pv : uuid", "    diem_tong_ket : float", "    star_scores_json : jsonb", "    detailed_feedbacks_json : jsonb", "    counselor_notes : text", "    disclaimer_text : text"]
    }
  ];

  tables.forEach(t => {
    const rawHtml = `<b>bảng: ${t.name}</b><hr/>${t.cols.join("<br/>")}`;
    cells.push(
      `        <mxCell id="${t.id}" value="${esc(rawHtml)}" style="shape=table;childLayout=tableLayout;whiteSpace=wrap;html=1;fillColor=#D1FAE5;strokeColor=#059669;fontColor=#0F172A;fontSize=10;align=left;spacingLeft=6;verticalAlign=top;" vertex="1" parent="1">
            <mxGeometry x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" as="geometry" />
          </mxCell>`
    );
  });

  const erdEdges = [
    { from: "tbl_users", to: "tbl_students", label: "1 : 1" },
    { from: "tbl_users", to: "tbl_counselors", label: "1 : 1" },
    { from: "tbl_users", to: "tbl_enterprises", label: "1 : 1" },
    { from: "tbl_counselors", to: "tbl_feedback", label: "1 : N" },
    { from: "tbl_students", to: "tbl_feedback", label: "1 : N" },
    { from: "tbl_students", to: "tbl_resumes", label: "1 : N" },
    { from: "tbl_enterprises", to: "tbl_jds", label: "1 : N" },
    { from: "tbl_resumes", to: "tbl_matches", label: "1 : N" },
    { from: "tbl_jds", to: "tbl_matches", label: "1 : N" },
    { from: "tbl_students", to: "tbl_sessions", label: "1 : N" },
    { from: "tbl_sessions", to: "tbl_logs", label: "1 : N" },
    { from: "tbl_sessions", to: "tbl_evals", label: "1 : 1" }
  ];

  erdEdges.forEach((e, idx) => {
    cells.push(
      `        <mxCell id="edge_erd_${idx}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=ERoneToMany;strokeColor=#059669;fontSize=10;" edge="1" parent="1" source="${e.from}" target="${e.to}">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`
    );
  });

  return createDrawioXml("database-erd-p041", "Sơ đồ Cơ sở Dữ liệu ERD", 1300, 800, cells);
}

// Write files
const files = [
  { name: "CareerAssistantX_Hierarchy.drawio", content: generateHierarchy() },
  { name: "CareerAssistantX_Architecture.drawio", content: generateArchitecture() },
  { name: "CareerAssistantX_UserFlow.drawio", content: generateUserFlow() },
  { name: "CareerAssistantX_ClassDiagram.drawio", content: generateClassDiagram() },
  { name: "CareerAssistantX_DatabaseERD.drawio", content: generateDatabaseErd() }
];

files.forEach(f => {
  OUT_DIRS.forEach(dir => {
    const filePath = join(dir, f.name);
    writeFileSync(filePath, f.content, { encoding: "utf8" });
    console.log(`Generated: ${filePath}`);
  });
});

console.log("All 5 Draw.io files updated with full detailed specs!");
