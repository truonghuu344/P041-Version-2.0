/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { EnterpriseTab } from './EnterpriseView';
import {
  X,
  Eye,
  Save,
  Send,
  UploadCloud,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Plus,
  History,
  Maximize2,
  Minimize2,
  FileText,
  HelpCircle,
  Clock,
  Trash2,
  Check
} from 'lucide-react';
import JobSectionBlock, { JobSectionData } from './JobSectionBlock';
import JobCandidatePreview, { ScreeningQuestion } from './JobCandidatePreview';
import WordLikeEditor from './WordLikeEditor';

interface Props {
  onNavigate: (tab: EnterpriseTab) => void;
}

const DEFAULT_SECTIONS: JobSectionData[] = [
  {
    id: 'sec-overview',
    type: 'overview',
    title: '1. Giới thiệu tổng quan về vị trí',
    hint: 'Mô tả bối cảnh dự án, sứ mệnh của phòng ban và vai trò của vị trí trong công ty.',
    content: '<p>Chúng tôi đang tìm kiếm một Kỹ sư phần mềm tài năng gia nhập đội ngũ phát triển các sản phẩm AI tiên tiến tại Career Assistant.</p>',
    isRequired: true,
  },
  {
    id: 'sec-resp',
    type: 'responsibilities',
    title: '2. Trách nhiệm & Nhiệm vụ chính',
    hint: 'Liệt kê các đầu việc thực tế mà ứng viên sẽ đảm nhận hàng ngày.',
    content: '<ul><li>Tham gia thiết kế, phát triển và tối ưu hóa hệ thống backend microservices.</li><li>Xây dựng RESTful API và xử lý dữ liệu lớn với độ trễ thấp.</li><li>Phối hợp cùng đội ngũ AI Engineer và Product Designer để phát triển tính năng mới.</li><li>Tham gia review code và đảm bảo chất lượng phần mềm.</li></ul>',
    isRequired: true,
  },
  {
    id: 'sec-musthave',
    type: 'must_have',
    title: '3. Yêu cầu bắt buộc (Must-Have)',
    hint: 'Các kỹ năng, kinh nghiệm cốt lõi để Matching Pipeline AI đối chiếu hồ sơ ứng viên.',
    content: '<ul><li>Tối thiểu <strong>2 năm kinh nghiệm</strong> làm việc thực tế với Python / FastAPI hoặc Node.js.</li><li>Thành thạo cơ sở dữ liệu quan hệ (PostgreSQL) và bộ nhớ đệm (Redis).</li><li>Hiểu rõ về kiến trúc REST API, Docker container và Git workflow.</li></ul>',
    isRequired: true,
  },
  {
    id: 'sec-nicetohave',
    type: 'nice_to_have',
    title: '4. Yêu cầu ưu tiên (Nice-To-Have)',
    hint: 'Điểm cộng giúp ứng viên nổi bật hơn trong quá trình tuyển chọn.',
    content: '<ul><li>Có kinh nghiệm với Vector Database (Qdrant, Milvus) hoặc GenAI APIs.</li><li>Hiểu biết về Kubernetes, CI/CD pipeline và hệ thống phân tán.</li></ul>',
    isRequired: false,
  },
  {
    id: 'sec-benefits',
    type: 'benefits',
    title: '5. Quyền lợi & Đãi ngộ (Benefits)',
    hint: 'Chế độ lương thưởng, bảo hiểm, đào tạo và văn hóa doanh nghiệp.',
    content: '<table class="word-editor-table" style="width: 100%; border-collapse: collapse; margin: 12px 0;"><thead><tr><th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Hạng mục</th><th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Chế độ đãi ngộ</th></tr></thead><tbody><tr><td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Lương & Thưởng</strong></td><td style="border: 1px solid #d1d5db; padding: 8px 12px;">Tháng 13 + thưởng hiệu quả kinh doanh lên tới 3 tháng lương</td></tr><tr><td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Bảo hiểm</strong></td><td style="border: 1px solid #d1d5db; padding: 8px 12px;">Gói bảo hiểm sức khỏe Bảo Việt Premium cho nhân viên và người thân</td></tr><tr><td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Thiết bị & Môi trường</strong></td><td style="border: 1px solid #d1d5db; padding: 8px 12px;">Cung cấp MacBook Pro M3, làm việc Hybrid linh hoạt</td></tr></tbody></table>',
    isRequired: true,
  },
];

const DEFAULT_QUESTIONS: ScreeningQuestion[] = [
  {
    id: 'q-1',
    question: 'Bạn có bao nhiêu năm kinh nghiệm thực tế với Tech Stack cốt lõi của vị trí này?',
    type: 'number',
    required: true,
  },
  {
    id: 'q-2',
    question: 'Thời gian sớm nhất bạn có thể bắt đầu làm việc nếu được nhận việc?',
    type: 'text',
    required: true,
  },
];

export default function EnterpriseCreateJob({ onNavigate }: Props) {
  // Wizard Steps: 1: Info & Upload, 2: Word Editor, 3: Screening Questions, 4: Preview
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Metadata State
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('Middle');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [quantity, setQuantity] = useState('1');
  const [workModel, setWorkModel] = useState('Hybrid');
  const [locationCity, setLocationCity] = useState('Hồ Chí Minh');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState<string[]>(['Python', 'FastAPI']);
  const [tagInput, setTagInput] = useState('');
  const [experience, setExperience] = useState('1-3 năm');
  const [education, setEducation] = useState('Đại học / Cao đẳng');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('VND');
  const [salaryVisibility, setSalaryVisibility] = useState('Thỏa thuận');
  const [deadline, setDeadline] = useState('2026-09-30');

  // Structured Word-like Sections State
  const [sections, setSections] = useState<JobSectionData[]>(DEFAULT_SECTIONS);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>(DEFAULT_QUESTIONS);
  const [newQuestionText, setNewQuestionText] = useState('');

  // Autosave & Version History State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('15:42');
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [versionsList, setVersionsList] = useState<
    Array<{ id: string; time: string; author: string; title: string }>
  >([
    { id: 'v-1', time: '16/08/2026 15:42', author: 'Chiri Nguyen', title: 'Bản nháp hiện tại' },
    { id: 'v-0', time: '16/08/2026 14:20', author: 'Chiri Nguyen', title: 'Bản nháp tự động khởi tạo' },
  ]);

  // Fullscreen & Modals State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // File Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Debounced Autosave effect
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setLastSavedTime(timeStr);
      setSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, department, level, employmentType, locationCity, tags, sections, questions]);

  // Tags management
  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Section Manipulation Handlers
  const handleSectionContentChange = (id: string, newHtml: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content: newHtml } : s))
    );
  };

  const handleMoveSectionUp = (index: number) => {
    if (index === 0) return;
    const updated = [...sections];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setSections(updated);
  };

  const handleMoveSectionDown = (index: number) => {
    if (index === sections.length - 1) return;
    const updated = [...sections];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setSections(updated);
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRenameSection = (id: string, newTitle: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  };

  const handleAddCustomSection = () => {
    const newId = `sec-custom-${Date.now()}`;
    const newSec: JobSectionData = {
      id: newId,
      type: 'custom',
      title: 'Mục bổ sung mới',
      hint: 'Nhập tiêu đề và nội dung tùy chỉnh cho mục này.',
      content: '<p>Nội dung chi tiết...</p>',
      isRequired: false,
    };
    setSections([...sections, newSec]);
  };

  // Screening questions management
  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const newQ: ScreeningQuestion = {
      id: `q-${Date.now()}`,
      question: newQuestionText.trim(),
      type: 'text',
      required: true,
    };
    setQuestions([...questions, newQ]);
    setNewQuestionText('');
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  // Handle JD File Selection & AI Parsing
  const handleFileProcess = async (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setIsParsing(true);
    setParseSuccess(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.includes('ai') || fileNameLower.includes('ml') || fileNameLower.includes('data')) {
        setTitle('AI Engineer (Computer Vision & LLM)');
        setDepartment('AI & Data Research');
        setLevel('Middle');
        setEmploymentType('Full-time');
        setWorkModel('Hybrid');
        setLocationCity('Hồ Chí Minh');
        setAddress('Tầng 12, Tòa nhà Innovation, Quận 1, TP. HCM');
        setTags(['Python', 'PyTorch', 'FastAPI', 'LLM', 'Docker', 'RAG']);
        setExperience('1-3 năm');
        setSalaryMin('25.000.000');
        setSalaryMax('45.000.000');
        setSalaryVisibility('Công khai');

        // Update sections content with AI extracted content
        setSections([
          {
            id: 'sec-overview',
            type: 'overview',
            title: '1. Giới thiệu tổng quan về vị trí',
            hint: 'Mô tả bối cảnh dự án, sứ mệnh của phòng ban và vai trò của vị trí trong công ty.',
            content: '<p>Tìm kiếm <strong>AI Engineer</strong> tài năng tham gia phát triển các giải pháp GenAI, RAG và Computer Vision phục vụ hệ sinh thái tuyển dụng thông minh.</p>',
            isRequired: true,
          },
          {
            id: 'sec-resp',
            type: 'responsibilities',
            title: '2. Trách nhiệm & Nhiệm vụ chính',
            hint: 'Liệt kê các đầu việc thực tế mà ứng viên sẽ đảm nhận hàng ngày.',
            content: '<ul><li>Nghiên cứu, huấn luyện và tối ưu các mô hình LLM, Speech-to-Text và Embedding.</li><li>Xây dựng pipeline xử lý dữ liệu và đánh giá mức độ phù hợp CV - JD.</li><li>Phối hợp cùng backend team triển khai API AI microservices hiệu năng cao.</li></ul>',
            isRequired: true,
          },
          {
            id: 'sec-musthave',
            type: 'must_have',
            title: '3. Yêu cầu bắt buộc (Must-Have)',
            hint: 'Các kỹ năng, kinh nghiệm cốt lõi để Matching Pipeline AI đối chiếu hồ sơ ứng viên.',
            content: '<ul><li>Tốt nghiệp chuyên ngành CNTT, Khoa học dữ liệu hoặc tương đương.</li><li>Thành thạo <strong>Python</strong>, PyTorch / TensorFlow, HuggingFace.</li><li>Có kinh nghiệm với REST API (FastAPI) và Docker container.</li></ul>',
            isRequired: true,
          },
          {
            id: 'sec-nicetohave',
            type: 'nice_to_have',
            title: '4. Yêu cầu ưu tiên (Nice-To-Have)',
            hint: 'Điểm cộng giúp ứng viên nổi bật hơn trong quá trình tuyển chọn.',
            content: '<ul><li>Có kinh nghiệm với LangChain, LlamaIndex, Vector Database (Milvus/Qdrant).</li><li>Đã từng làm việc với mô hình Gemini API hoặc OpenAI API.</li></ul>',
            isRequired: false,
          },
          {
            id: 'sec-benefits',
            type: 'benefits',
            title: '5. Quyền lợi & Đãi ngộ (Benefits)',
            hint: 'Chế độ lương thưởng, bảo hiểm, đào tạo và văn hóa doanh nghiệp.',
            content: '<ul><li>Thưởng tháng 13 + thưởng hiệu quả công việc.</li><li>Gói bảo hiểm sức khỏe cao cấp Bảo Việt.</li><li>Hỗ trợ thiết bị làm việc MacBook Pro M3.</li></ul>',
            isRequired: true,
          },
        ]);
      } else if (fileNameLower.includes('front') || fileNameLower.includes('react') || fileNameLower.includes('web')) {
        setTitle('Senior Frontend Developer (React / Next.js)');
        setDepartment('Product Engineering');
        setLevel('Senior');
        setEmploymentType('Full-time');
        setWorkModel('Remote');
        setLocationCity('Hà Nội');
        setTags(['React', 'Next.js', 'TypeScript', 'CSS', 'Tailwind']);
        setExperience('3-5 năm');
        setSalaryMin('30.000.000');
        setSalaryMax('50.000.000');
        setSalaryVisibility('Công khai');
      } else {
        setTitle('Backend Developer (Python / Go)');
        setDepartment('Engineering');
        setLevel('Middle');
        setEmploymentType('Full-time');
        setWorkModel('Hybrid');
        setLocationCity('Hồ Chí Minh');
        setTags(['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker']);
        setExperience('1-3 năm');
        setSalaryMin('20.000.000');
        setSalaryMax('35.000.000');
        setSalaryVisibility('Thỏa thuận');
      }

      setParseSuccess(true);
    } catch {
      // Error handling
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handlePublish = () => {
    alert('Đăng tin tuyển dụng thành công! Vị trí đã chuyển sang trạng thái "Đang tuyển".');
    onNavigate('jobs');
  };

  const handleSaveDraft = () => {
    alert('Đã lưu tin tuyển dụng dưới dạng "Bản nháp".');
    onNavigate('jobs');
  };

  // Restore revision snapshot
  const handleRestoreVersion = (versionId: string) => {
    alert(`Đã khôi phục thành công phiên bản ${versionId}.`);
    setShowVersionDrawer(false);
  };

  return (
    <div
      className={`enterprise-create-job ${isFullscreen ? 'create-job-fullscreen' : ''}`}
      data-testid="enterprise-create-job"
    >
      {/* Fullscreen Floating Exit Header */}
      {isFullscreen && (
        <div className="fullscreen-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="fullscreen-exit-btn"
              onClick={() => setIsFullscreen(false)}
            >
              <ArrowLeft size={16} />
              <span>Thoát toàn màn hình</span>
            </button>
            <strong className="fullscreen-job-title">
              {title || 'Vị trí mới'} — Bản nháp
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="autosave-status-badge">
              <CheckCircle2 size={14} style={{ color: '#10b981' }} />
              <span>Đã lưu lúc {lastSavedTime}</span>
            </span>
            <button
              type="button"
              className="recruiter-btn-primary"
              onClick={() => { setIsFullscreen(false); setIsPreviewOpen(true); }}
            >
              <Eye size={15} />
              <span>Xem trước</span>
            </button>
          </div>
        </div>
      )}

      {/* Standard Header */}
      {!isFullscreen && (
        <header className="recruiter-header">
          <div className="recruiter-title-wrap">
            <button
              type="button"
              className="recruiter-back-btn"
              onClick={() => onNavigate('jobs')}
            >
              <ArrowLeft size={14} />
              <span>Quay lại danh sách</span>
            </button>
            <h1 className="recruiter-page-title">Đăng tin tuyển dụng</h1>
            <p className="recruiter-page-subtitle">
              Soạn bài đăng chuyên nghiệp với trải nghiệm Word-like và AI tự động cấu trúc dữ liệu.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Autosave Indicator */}
            <div className="autosave-pill">
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check size={13} style={{ color: '#10b981' }} />
                  <span>Đã lưu lúc {lastSavedTime}</span>
                </>
              )}
            </div>

            <button
              type="button"
              className="recruiter-btn-secondary"
              onClick={() => setShowVersionDrawer(true)}
              title="Xem lịch sử các phiên bản chỉnh sửa"
            >
              <History size={16} />
              <span>Lịch sử phiên bản</span>
            </button>

            <button
              type="button"
              className="recruiter-btn-secondary"
              onClick={() => setIsPreviewOpen(true)}
            >
              <Eye size={16} />
              <span>Xem trước</span>
            </button>

            <button
              type="button"
              className="recruiter-btn-secondary"
              onClick={handleSaveDraft}
            >
              <Save size={16} />
              <span>Lưu bản nháp</span>
            </button>

            <button
              type="button"
              className="recruiter-btn-primary"
              onClick={handlePublish}
            >
              <Send size={16} />
              <span>Đăng tuyển</span>
            </button>
          </div>
        </header>
      )}

      {/* 4-Step Wizard Navigation */}
      {!isFullscreen && (
        <div className="create-job-stepper">
          <button
            type="button"
            className={`step-btn ${currentStep === 1 ? 'active' : ''}`}
            onClick={() => setCurrentStep(1)}
          >
            <span className="step-num">1</span>
            <span className="step-label">Thông tin & File JD</span>
          </button>
          <button
            type="button"
            className={`step-btn ${currentStep === 2 ? 'active' : ''}`}
            onClick={() => setCurrentStep(2)}
          >
            <span className="step-num">2</span>
            <span className="step-label">Soạn bài (Word-Like Editor)</span>
          </button>
          <button
            type="button"
            className={`step-btn ${currentStep === 3 ? 'active' : ''}`}
            onClick={() => setCurrentStep(3)}
          >
            <span className="step-num">3</span>
            <span className="step-label">Câu hỏi ứng tuyển</span>
          </button>
          <button
            type="button"
            className={`step-btn ${currentStep === 4 ? 'active' : ''}`}
            onClick={() => setCurrentStep(4)}
          >
            <span className="step-num">4</span>
            <span className="step-label">Xem trước & Đăng tuyển</span>
          </button>
        </div>
      )}

      {/* Main Content Area by Step */}
      <div className="recruiter-form-grid">
        {/* STEP 1: Thông tin cơ bản & File Upload */}
        {currentStep === 1 && (
          <div>
            {/* 1. JD File Upload & AI Auto-Parsing Dropzone */}
            <section className="recruiter-form-section">
              <h2 className="recruiter-form-section-title">
                <Sparkles size={18} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginRight: '6px' }} />
                Tải lên JD có sẵn (AI tự động trích xuất)
              </h2>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
              />

              <div
                className={`recruiter-jd-uploader ${isDragOver ? 'is-dragover' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="recruiter-jd-uploader-icon">
                  <UploadCloud size={24} />
                </div>
                <h3 className="recruiter-jd-uploader-title">
                  Kéo thả file JD hoặc bấm để chọn từ máy tính
                </h3>
                <p className="recruiter-jd-uploader-desc">
                  Hỗ trợ định dạng: <strong>PDF, Word (.doc, .docx)</strong> hoặc <strong>Ảnh chụp JD (.png, .jpg)</strong>
                </p>
                <span className="recruiter-jd-uploader-badge">
                  ⚡ AI tự động nhận diện và điền vào các ô nhập bên dưới
                </span>
              </div>

              {isParsing && (
                <div className="recruiter-upload-parsing-banner">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  <span>Đang phân tích và trích xuất nội dung từ file <strong>{uploadedFileName}</strong>...</span>
                </div>
              )}

              {parseSuccess && !isParsing && (
                <div className="recruiter-upload-success-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} style={{ color: '#166534' }} />
                    <span>
                      Đã trích xuất thành công từ <strong>{uploadedFileName}</strong>! Bạn có thể kiểm tra và chuyển sang bước soạn bài chi tiết.
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}
                    onClick={() => {
                      setUploadedFileName(null);
                      setParseSuccess(false);
                    }}
                  >
                    Đổi file khác
                  </button>
                </div>
              )}
            </section>

            {/* 2. Thông tin cơ bản */}
            <section className="recruiter-form-section">
              <h2 className="recruiter-form-section-title">1. Thông tin cơ bản</h2>
              <div className="recruiter-form-group">
                <label className="recruiter-form-label">Tên vị trí tuyển dụng (Job Title) <span className="req">*</span></label>
                <input
                  type="text"
                  className="recruiter-input"
                  placeholder="VD: Senior Backend Developer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="recruiter-form-row recruiter-form-group">
                <div>
                  <label className="recruiter-form-label">Phòng ban (Department)</label>
                  <input
                    type="text"
                    className="recruiter-input"
                    placeholder="VD: Kỹ thuật / Engineering"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
                <div>
                  <label className="recruiter-form-label">Cấp độ (Level) <span className="req">*</span></label>
                  <select
                    className="recruiter-select"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="Intern">Intern / Thực tập sinh</option>
                    <option value="Fresher">Fresher / Mới tốt nghiệp</option>
                    <option value="Junior">Junior</option>
                    <option value="Middle">Middle</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead / Trưởng nhóm</option>
                    <option value="Manager">Manager / Quản lý</option>
                  </select>
                </div>
              </div>

              <div className="recruiter-form-row recruiter-form-group">
                <div>
                  <label className="recruiter-form-label">Hình thức làm việc <span className="req">*</span></label>
                  <select
                    className="recruiter-select"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                  >
                    <option value="Full-time">Toàn thời gian (Full-time)</option>
                    <option value="Part-time">Bán thời gian (Part-time)</option>
                    <option value="Internship">Thực tập (Internship)</option>
                    <option value="Contract">Hợp đồng (Contract)</option>
                  </select>
                </div>
                <div>
                  <label className="recruiter-form-label">Số lượng cần tuyển</label>
                  <input
                    type="number"
                    className="recruiter-input"
                    placeholder="1"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 3. Địa điểm & Kỹ năng */}
            <section className="recruiter-form-section">
              <h2 className="recruiter-form-section-title">2. Địa điểm & Kỹ năng cốt lõi (Cho Matching Pipeline)</h2>
              <div className="recruiter-form-row recruiter-form-group">
                <div>
                  <label className="recruiter-form-label">Mô hình làm việc <span className="req">*</span></label>
                  <select
                    className="recruiter-select"
                    value={workModel}
                    onChange={(e) => setWorkModel(e.target.value)}
                  >
                    <option value="On-site">Tại văn phòng (On-site)</option>
                    <option value="Hybrid">Kết hợp (Hybrid)</option>
                    <option value="Remote">Làm việc từ xa (Remote)</option>
                  </select>
                </div>
                <div>
                  <label className="recruiter-form-label">Tỉnh / Thành phố <span className="req">*</span></label>
                  <select
                    className="recruiter-select"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                  >
                    <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                    <option value="Khác">Khác / Toàn quốc</option>
                  </select>
                </div>
              </div>

              <div className="recruiter-form-group">
                <label className="recruiter-form-label">Địa chỉ chi tiết văn phòng</label>
                <input
                  type="text"
                  className="recruiter-input"
                  placeholder="VD: Tòa nhà ABC, Phường X, Quận Y..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="recruiter-form-group">
                <label className="recruiter-form-label">Kỹ năng / Tech Stack (Từ khóa quan trọng để AI so khớp CV)</label>
                <div className="recruiter-tags-container">
                  {tags.map((tag) => (
                    <span key={tag} className="recruiter-tag-pill">
                      {tag}
                      <button
                        type="button"
                        className="recruiter-tag-remove"
                        onClick={() => removeTag(tag)}
                        aria-label={`Xóa kỹ năng ${tag}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={addTag}
                    placeholder="Nhập kỹ năng rồi nhấn Enter..."
                    style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: '160px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </section>

            {/* 4. Mức lương & Hạn nộp */}
            <section className="recruiter-form-section">
              <h2 className="recruiter-form-section-title">3. Mức lương & Hạn nộp hồ sơ</h2>
              <div className="recruiter-form-row recruiter-form-group">
                <div>
                  <label className="recruiter-form-label">Khoảng lương</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="recruiter-input"
                      placeholder="Từ"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                    />
                    <input
                      type="text"
                      className="recruiter-input"
                      placeholder="Đến"
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                    />
                    <select
                      className="recruiter-select"
                      style={{ width: '90px' }}
                      value={salaryCurrency}
                      onChange={(e) => setSalaryCurrency(e.target.value)}
                    >
                      <option value="VND">VND</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="recruiter-form-label">Chế độ hiển thị lương</label>
                  <select
                    className="recruiter-select"
                    value={salaryVisibility}
                    onChange={(e) => setSalaryVisibility(e.target.value)}
                  >
                    <option value="Công khai">Công khai mức lương</option>
                    <option value="Thỏa thuận">Thỏa thuận khi phỏng vấn</option>
                  </select>
                </div>
              </div>

              <div className="recruiter-form-group">
                <label className="recruiter-form-label">Hạn chót ứng tuyển <span className="req">*</span></label>
                <input
                  type="date"
                  className="recruiter-input"
                  style={{ maxWidth: '280px' }}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </section>

            {/* Step 1 Navigation */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="recruiter-btn-primary"
                onClick={() => setCurrentStep(2)}
              >
                <span>Tiếp tục sang bước Soạn bài</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Soạn bài tuyển dụng (Word-Like Rich Editor) */}
        {currentStep === 2 && (
          <div className="word-editor-step-wrapper">
            <div className="word-step-header">
              <div>
                <h2 className="word-step-title">Soạn nội dung bài đăng (Word-Like Editor)</h2>
                <p className="word-step-subtitle">
                  Chỉnh sửa trực quan với bảng biểu, danh sách, màu sắc. Hệ thống bảo đảm giữ nguyên định danh cấu trúc phục vụ Matching.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="recruiter-btn-secondary"
                  onClick={handleAddCustomSection}
                >
                  <Plus size={15} />
                  <span>Thêm mục mới</span>
                </button>
                <button
                  type="button"
                  className="recruiter-btn-secondary"
                  onClick={() => setIsFullscreen(true)}
                  title="Mở toàn màn hình để tập trung soạn thảo"
                >
                  <Maximize2 size={15} />
                  <span>Toàn màn hình</span>
                </button>
              </div>
            </div>

            {/* Structured Sections Block List with Drag & Reordering */}
            <div className="sections-block-flow">
              {sections.map((section, idx) => (
                <JobSectionBlock
                  key={section.id}
                  section={section}
                  index={idx}
                  totalSections={sections.length}
                  onChangeContent={handleSectionContentChange}
                  onMoveUp={handleMoveSectionUp}
                  onMoveDown={handleMoveSectionDown}
                  onDeleteSection={handleDeleteSection}
                  onRenameTitle={handleRenameSection}
                />
              ))}
            </div>

            {/* Step 2 Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button
                type="button"
                className="recruiter-btn-secondary"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft size={16} />
                <span>Quay lại thông tin</span>
              </button>
              <button
                type="button"
                className="recruiter-btn-primary"
                onClick={() => setCurrentStep(3)}
              >
                <span>Tiếp tục: Câu hỏi ứng tuyển</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Câu hỏi ứng tuyển (Screening Questions) */}
        {currentStep === 3 && (
          <div className="recruiter-form-section">
            <h2 className="recruiter-form-section-title">
              <HelpCircle size={18} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginRight: '6px' }} />
              Câu hỏi sàng lọc ứng viên khi nộp hồ sơ
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Đặt các câu hỏi ngắn để ứng viên trả lời trước khi gửi CV. Giúp bạn phân loại và lọc ứng viên nhanh chóng.
            </p>

            <div className="screening-questions-container">
              {questions.map((q, i) => (
                <div key={q.id} className="screening-question-row">
                  <span className="q-number">#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{q.question}</strong>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Loại: Văn bản ngắn · {q.required ? 'Bắt buộc trả lời' : 'Tùy chọn'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="q-delete-btn"
                    onClick={() => handleDeleteQuestion(q.id)}
                    title="Xóa câu hỏi này"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              <div className="add-question-bar" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="recruiter-input"
                  placeholder="Nhập nội dung câu hỏi mới..."
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                />
                <button
                  type="button"
                  className="recruiter-btn-secondary"
                  onClick={handleAddQuestion}
                >
                  <Plus size={16} />
                  <span>Thêm câu hỏi</span>
                </button>
              </div>
            </div>

            {/* Step 3 Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
              <button
                type="button"
                className="recruiter-btn-secondary"
                onClick={() => setCurrentStep(2)}
              >
                <ArrowLeft size={16} />
                <span>Quay lại soạn bài</span>
              </button>
              <button
                type="button"
                className="recruiter-btn-primary"
                onClick={() => setCurrentStep(4)}
              >
                <span>Xem trước & Đăng tuyển</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Xem trước & Đăng tuyển */}
        {currentStep === 4 && (
          <div>
            <JobCandidatePreview
              title={title}
              department={department}
              level={level}
              employmentType={employmentType}
              workModel={workModel}
              locationCity={locationCity}
              address={address}
              salaryMin={salaryMin}
              salaryMax={salaryMax}
              salaryCurrency={salaryCurrency}
              salaryVisibility={salaryVisibility}
              deadline={deadline}
              tags={tags}
              sections={sections}
              questions={questions}
            />

            {/* Step 4 Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', marginBottom: '48px' }}>
              <button
                type="button"
                className="recruiter-btn-secondary"
                onClick={() => setCurrentStep(3)}
              >
                <ArrowLeft size={16} />
                <span>Chỉnh sửa lại</span>
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="recruiter-btn-secondary"
                  onClick={handleSaveDraft}
                >
                  <Save size={16} />
                  <span>Lưu bản nháp</span>
                </button>
                <button
                  type="button"
                  className="recruiter-btn-primary"
                  onClick={handlePublish}
                >
                  <Send size={16} />
                  <span>Xác nhận & Đăng tuyển</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version History Drawer Modal */}
      {showVersionDrawer && (
        <div className="word-modal-overlay" onClick={() => setShowVersionDrawer(false)}>
          <div className="word-modal-box version-drawer-box" onClick={(e) => e.stopPropagation()}>
            <div className="word-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: 'var(--primary)' }} />
                <h3>Lịch sử phiên bản chỉnh sửa</h3>
              </div>
              <button type="button" onClick={() => setShowVersionDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="word-modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Career Assistant tự động sao lưu bản nháp sau mỗi thay đổi. Bạn có thể khôi phục lại phiên bản trước bất cứ lúc nào.
              </p>
              <div className="version-items-list">
                {versionsList.map((ver, idx) => (
                  <div key={ver.id} className="version-item-card">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{ver.time}</strong>
                        {idx === 0 && <span className="version-badge-current">Hiện tại</span>}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Người chỉnh sửa: {ver.author} · {ver.title}
                      </p>
                    </div>
                    {idx > 0 && (
                      <button
                        type="button"
                        className="word-btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => handleRestoreVersion(ver.id)}
                      >
                        Khôi phục
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="word-modal-footer">
              <button
                type="button"
                className="word-btn-primary"
                onClick={() => setShowVersionDrawer(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Modal from Header */}
      {isPreviewOpen && (
        <div
          className="modal-overlay open"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="recruiter-card"
            style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Xem trước tin tuyển dụng</h2>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => setIsPreviewOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <JobCandidatePreview
              title={title}
              department={department}
              level={level}
              employmentType={employmentType}
              workModel={workModel}
              locationCity={locationCity}
              address={address}
              salaryMin={salaryMin}
              salaryMax={salaryMax}
              salaryCurrency={salaryCurrency}
              salaryVisibility={salaryVisibility}
              deadline={deadline}
              tags={tags}
              sections={sections}
              questions={questions}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #edf2f0', paddingTop: '14px' }}>
              <button
                type="button"
                className="recruiter-btn-secondary"
                onClick={() => setIsPreviewOpen(false)}
              >
                Đóng xem trước
              </button>
              <button
                type="button"
                className="recruiter-btn-primary"
                onClick={() => {
                  setIsPreviewOpen(false);
                  handlePublish();
                }}
              >
                <Send size={16} />
                <span>Đăng tuyển luôn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
