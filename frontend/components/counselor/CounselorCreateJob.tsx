/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CounselorTab } from './CounselorNavbar';
import {
  X,
  Eye,
  Save,
  Send,
  UploadCloud,
  CheckCircle2,
  Loader2,
  FileUp,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  Plus,
  History,
  Maximize2,
  FileText,
  HelpCircle,
  Clock,
  Trash2,
  Check,
  AlertTriangle,
  Building2,
  MapPin,
  Sparkles,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import JobSectionBlock, { JobSectionData } from './job-builder/JobSectionBlock';
import JobCandidatePreview, { ScreeningQuestion } from './job-builder/JobCandidatePreview';
import { buildJobTemplateContent } from './job-builder/jobTemplateHelper';
import AppToast, { AppToastMessage } from '@/components/shared/AppToast';
import { ApiClient } from '@/api-client.js';
import { uploadJDForParsing } from '@/lib/jdUpload';

export interface CounselorPartner {
  id: string;
  name: string;
  location?: string | null;
  logo_url?: string | null;
}

interface CounselorCreateJobProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
  onBack?: () => void;
  onSuccess?: () => void;
  editJobId?: string | null;
}

const DEFAULT_SECTIONS: JobSectionData[] = [
  {
    id: 'sec-overview',
    type: 'overview',
    title: '1. Giới thiệu tổng quan về vị trí',
    hint: 'Mô tả bối cảnh dự án, sứ mệnh của phòng ban và vai trò của vị trí trong công ty.',
    content:
      '<p>Chúng tôi đang tìm kiếm một Kỹ sư phần mềm tài năng gia nhập đội ngũ phát triển các giải pháp công nghệ hiện đại và mở rộng quy mô hệ thống.</p>',
    isRequired: true,
  },
  {
    id: 'sec-resp',
    type: 'responsibilities',
    title: '2. Trách nhiệm & Nhiệm vụ chính',
    hint: 'Liệt kê các đầu việc thực tế mà ứng viên sẽ đảm nhận hàng ngày.',
    content:
      '<ul><li>Tham gia thiết kế, phát triển và tối ưu hóa hệ thống backend microservices / frontend.</li><li>Xây dựng RESTful API và xử lý dữ liệu với độ trễ thấp.</li><li>Phối hợp cùng đội ngũ kỹ thuật và Product Owner để hoàn thiện tính năng mới.</li><li>Tham gia review code và đảm bảo chất lượng phần mềm theo tiêu chuẩn clean code.</li></ul>',
    isRequired: true,
  },
  {
    id: 'sec-musthave',
    type: 'must_have',
    title: '3. Yêu cầu bắt buộc (Must-Have)',
    hint: 'Các kỹ năng, kinh nghiệm cốt lõi bắt buộc ứng viên phải có — dùng để đối chiếu hồ sơ sinh viên.',
    content:
      '<ul><li>Tối thiểu <strong>1-2 năm kinh nghiệm</strong> làm việc thực tế với ngôn ngữ chuyên môn (Python / Java / TypeScript / React / Node.js).</li><li>Nắm vững cơ sở dữ liệu quan hệ (PostgreSQL / MySQL) và tối ưu truy vấn SQL.</li><li>Hiểu rõ về kiến trúc REST API, Docker container và Git workflow.</li><li>Kỹ năng tư duy logic và khả năng làm việc nhóm tốt.</li></ul>',
    isRequired: true,
  },
  {
    id: 'sec-nicetohave',
    type: 'nice_to_have',
    title: '4. Yêu cầu ưu tiên (Nice-To-Have)',
    hint: 'Điểm cộng giúp ứng viên nổi bật hơn trong quá trình tuyển chọn.',
    content:
      '<ul><li>Có kinh nghiệm với điện toán đám mây (AWS / GCP) hoặc các mô hình AI/ML, Vector Search.</li><li>Hiểu biết về CI/CD pipeline và hệ thống phân tán.</li><li>Khả năng đọc hiểu tài liệu tiếng Anh tốt.</li></ul>',
    isRequired: false,
  },
  {
    id: 'sec-benefits',
    type: 'benefits',
    title: '5. Quyền lợi & Đãi ngộ (Benefits)',
    hint: 'Chế độ lương thưởng, bảo hiểm, đào tạo và văn hóa doanh nghiệp.',
    content:
      '<table class="word-editor-table" style="width: 100%; border-collapse: collapse; margin: 12px 0;"><thead><tr><th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Hạng mục</th><th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Chế độ đãi ngộ</th></tr></thead><tbody><tr><td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Lương & Thưởng</strong></td><td style="border: 1px solid #d1d5db; padding: 8px 12px;">Mức thu nhập cạnh tranh theo năng lực, tháng 13 + thưởng hiệu quả công việc</td></tr><tr><td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Bảo hiểm & Phúc lợi</strong></td><td style="border: 1px solid #d1d5db; padding: 8px 12px;">Đóng đầy đủ BHXH/BHYT theo quy định + Gói bảo hiểm sức khỏe cao cấp</td></tr><tr><td style="border: 1px solid #d1d5db; padding: 8px 12px;"><strong>Môi trường & Thiết bị</strong></td><td style="border: 1px solid #d1d5db; padding: 8px 12px;">Cung cấp máy tính cấu hình cao, hỗ trợ làm việc Hybrid linh hoạt</td></tr></tbody></table>',
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

export default function CounselorCreateJob({
  onNavigate,
  onBack,
  onSuccess,
  editJobId,
}: CounselorCreateJobProps) {
  // Wizard Steps: 1: Thông tin & File JD, 2: Soạn bài (Word-Like Editor), 3: Câu hỏi ứng tuyển, 4: Xem trước & Đăng tuyển
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Job ID & State
  const [jobId, setJobId] = useState<string | null>(editJobId || null);
  const [publishedState, setPublishedState] = useState<boolean>(false);
  const [isLoadingJob, setIsLoadingJob] = useState<boolean>(Boolean(editJobId));
  const [loadError, setLoadError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<AppToastMessage | null>(null);

  // Partners & Company selection (Preserve Counselor ownership)
  const [partners, setPartners] = useState<CounselorPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');

  // Form Metadata State
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Công nghệ & Phát triển');
  const [level, setLevel] = useState('Middle');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [quantity, setQuantity] = useState('1');
  const [workModel, setWorkModel] = useState('Hybrid');
  const [locationCity, setLocationCity] = useState('Hồ Chí Minh');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState<string[]>(['React', 'TypeScript', 'Node.js']);
  const [tagInput, setTagInput] = useState('');
  const [experience, setExperience] = useState('1-3 năm');
  const [education, setEducation] = useState('Đại học / Cao đẳng');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('VND');
  const [salaryVisibility, setSalaryVisibility] = useState('Công khai');
  const [deadline, setDeadline] = useState('2026-09-30');

  // Structured Sections & Screening Questions
  const [sections, setSections] = useState<JobSectionData[]>(DEFAULT_SECTIONS);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>(DEFAULT_QUESTIONS);
  const [newQuestionText, setNewQuestionText] = useState('');

  // Autosave & Version History State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('--:--');
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [versionsList, setVersionsList] = useState<
    Array<{ id: string; time: string; author: string; title: string; snapshot?: unknown }>
  >([]);

  // Fullscreen & Modals State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // File & Image Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Helper normalizers for robust field parsing
  const normalizeLevel = (raw?: unknown): string => {
    const s = String(raw || '').toLowerCase().trim();
    if (s.includes('intern') || s.includes('thực tập')) return 'Intern';
    if (s.includes('fresher') || s.includes('mới tốt nghiệp')) return 'Fresher';
    if (s.includes('junior')) return 'Junior';
    if (s.includes('middle') || s.includes('mid')) return 'Middle';
    if (s.includes('senior')) return 'Senior';
    if (s.includes('lead') || s.includes('trưởng nhóm')) return 'Lead';
    if (s.includes('manager') || s.includes('quản lý')) return 'Manager';
    return 'Middle';
  };

  const normalizeEmploymentType = (raw?: unknown): string => {
    const s = String(raw || '').toLowerCase().trim();
    if (s.includes('part') || s.includes('bán thời gian')) return 'Part-time';
    if (s.includes('intern') || s.includes('thực tập')) return 'Internship';
    if (s.includes('contract') || s.includes('hợp đồng')) return 'Contract';
    return 'Full-time';
  };

  const normalizeWorkModel = (raw?: unknown): string => {
    const s = String(raw || '').toLowerCase().trim();
    if (s.includes('on-site') || s.includes('onsite') || s.includes('tại văn phòng')) return 'On-site';
    if (s.includes('remote') || s.includes('từ xa')) return 'Remote';
    return 'Hybrid';
  };

  const normalizeLocationCity = (raw?: unknown): string => {
    const s = String(raw || '').toLowerCase().trim();
    if (s.includes('hà nội') || s.includes('ha noi') || s.includes('hn')) return 'Hà Nội';
    if (s.includes('đà nẵng') || s.includes('da nang')) return 'Đà Nẵng';
    if (s.includes('hồ chí minh') || s.includes('tp.hcm') || s.includes('tphcm') || s.includes('hcm') || s.includes('saigon')) return 'Hồ Chí Minh';
    if (s) return 'Khác';
    return 'Hồ Chí Minh';
  };

  const buildPayloadMetadata = useCallback((partnerId?: string, compName?: string) => ({
    company_id: partnerId || selectedPartnerId || (partners.length > 0 ? partners[0].id : undefined),
    company_name: compName || companyName || (partners.length > 0 ? partners[0].name : ''),
    creator_role: 'counselor',
    department,
    level,
    employment_type: employmentType,
    work_model: workModel,
    tags,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_visibility: salaryVisibility,
    quantity,
    address,
    experience,
    education,
    deadline,
    image_url: imageUrl,
    sections,
    questions,
  }), [
    address,
    companyName,
    deadline,
    department,
    education,
    employmentType,
    experience,
    imageUrl,
    level,
    partners,
    quantity,
    questions,
    salaryCurrency,
    salaryMax,
    salaryMin,
    salaryVisibility,
    sections,
    selectedPartnerId,
    tags,
    workModel,
  ]);

  // Metadata object for reactive preview
  const metadata = useMemo(
    () => buildPayloadMetadata(selectedPartnerId, companyName),
    [buildPayloadMetadata, selectedPartnerId, companyName]
  );

  // 1. Fetch Partner Organizations for Counselor
  useEffect(() => {
    let isMounted = true;
    ApiClient.getCounselorPartners()
      .then((data: CounselorPartner[]) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : [];
        setPartners(list);
        if (list.length > 0) {
          setSelectedPartnerId((prev) => {
            if (prev) {
              const matched = list.find((p) => p.id === prev);
              if (matched) setCompanyName((cur) => cur || matched.name);
              return prev;
            }
            setCompanyName((cur) => cur || list[0].name);
            if (list[0].location) setAddress((cur) => cur || list[0].location || '');
            return list[0].id;
          });
        }
      })
      .catch(() => {
        if (isMounted) setPartners([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load existing job for edit mode if editJobId provided
  useEffect(() => {
    if (!editJobId) {
      setIsLoadingJob(false);
      return;
    }
    let isMounted = true;
    const loadJob = async () => {
      setIsLoadingJob(true);
      setLoadError('');
      try {
        const jd = await (ApiClient as any).getJD(editJobId);
        if (!isMounted) return;

        const meta: Record<string, any> = jd.normalized_json || {};
        setTitle(jd.title || meta.title || '');
        setCompanyName(jd.company || meta.company_name || '');
        if (meta.company_id) setSelectedPartnerId(meta.company_id);
        setLocationCity(normalizeLocationCity(meta.location || jd.location));
        setDepartment(meta.department || '');
        setLevel(normalizeLevel(meta.level || meta.job_level));
        setEmploymentType(normalizeEmploymentType(meta.employment_type));
        setWorkModel(normalizeWorkModel(meta.work_model || meta.remote_type));
        if (Array.isArray(meta.tags) && meta.tags.length > 0) {
          setTags(meta.tags.map(String).filter(Boolean));
        } else if (Array.isArray(meta.skills) && meta.skills.length > 0) {
          setTags(meta.skills.map((s: any) => (typeof s === 'object' && s?.name ? String(s.name) : String(s))).filter(Boolean));
        }
        if (meta.salary_min) setSalaryMin(String(meta.salary_min));
        if (meta.salary_max) setSalaryMax(String(meta.salary_max));
        if (meta.salary_currency) setSalaryCurrency(String(meta.salary_currency));
        if (meta.salary_visibility) setSalaryVisibility(String(meta.salary_visibility));
        if (meta.quantity) setQuantity(String(meta.quantity));
        if (meta.address) setAddress(String(meta.address));
        if (meta.experience) setExperience(String(meta.experience));
        else if (meta.min_years_experience) setExperience(`${meta.min_years_experience} năm`);
        if (meta.education) setEducation(String(meta.education));
        if (meta.deadline) setDeadline(String(meta.deadline).slice(0, 10));
        if (Array.isArray(meta.sections) && meta.sections.length > 0) {
          setSections(meta.sections);
        } else if (jd.requirements_text) {
          const paragraphs = String(jd.requirements_text)
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((p: string) => `<p>${p.replace(/<[^>]+>/g, '').trim()}</p>`)
            .join('');
          setSections([
            { ...DEFAULT_SECTIONS[0], content: paragraphs || DEFAULT_SECTIONS[0].content },
            ...DEFAULT_SECTIONS.slice(1),
          ]);
        }
        if (Array.isArray(meta.questions) && meta.questions.length > 0) setQuestions(meta.questions);
        setPublishedState(jd.is_published !== false);
        setIsLoadingJob(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        setLoadError(err instanceof Error ? err.message : 'Không thể tải tin tuyển dụng.');
        setIsLoadingJob(false);
      }
    };
    void loadJob();
    return () => {
      isMounted = false;
    };
  }, [editJobId]);

  // 3. Seed initial version snapshot
  const initialVersionSeededRef = useRef(false);
  useEffect(() => {
    if (initialVersionSeededRef.current || isLoadingJob) return;
    initialVersionSeededRef.current = true;
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
    setVersionsList([
      {
        id: `v-${now.getTime()}`,
        time: timeStr,
        author: 'Cố vấn',
        title: editJobId ? 'Bản tin đã tải từ máy chủ' : 'Bản nháp ban đầu',
        snapshot: { title, department, level, employmentType, locationCity, tags, sections, questions },
      },
    ]);
  }, [isLoadingJob, editJobId, title, department, level, employmentType, locationCity, tags, sections, questions]);

  // 4. Helpers
  const buildRequirementsText = (secs: JobSectionData[], jobTitle: string) => {
    return secs
      .map((s) => `### ${s.title}\n${s.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
      .join('\n\n');
  };

  const pushVersionSnapshot = (label: string) => {
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    setVersionsList((prev) => [
      {
        id: `v-${Date.now()}`,
        time: timeStr,
        author: 'Cố vấn',
        title: label,
        snapshot: { title, department, level, employmentType, locationCity, tags, sections, questions },
      },
      ...prev.slice(0, 9),
    ]);
  };

  const applySnapshot = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    const s = snapshot as Partial<Record<string, unknown>>;
    if (typeof s.title === 'string') setTitle(s.title);
    if (typeof s.department === 'string') setDepartment(s.department);
    if (typeof s.level === 'string') setLevel(s.level);
    if (typeof s.employmentType === 'string') setEmploymentType(s.employmentType);
    if (typeof s.locationCity === 'string') setLocationCity(s.locationCity);
    if (Array.isArray(s.tags)) setTags(s.tags);
    if (Array.isArray(s.sections)) setSections(s.sections);
    if (Array.isArray(s.questions)) setQuestions(s.questions);
    setToast({ message: 'Đã khôi phục phiên bản đã chọn vào biểu mẫu.', type: 'success' });
  };

  const validateForm = (): string | null => {
    if (!title.trim()) {
      setCurrentStep(1);
      return 'Vui lòng nhập tên vị trí tuyển dụng.';
    }
    if (!locationCity.trim()) {
      setCurrentStep(1);
      return 'Vui lòng chọn địa điểm làm việc.';
    }
    let partnerId = selectedPartnerId;
    if (!partnerId && partners.length > 0) {
      partnerId = partners[0].id;
      setSelectedPartnerId(partnerId);
      setCompanyName(partners[0].name);
    }
    if (!partnerId || !companyName.trim()) {
      setCurrentStep(1);
      return 'Vui lòng chọn doanh nghiệp đối tác sở hữu JD.';
    }
    const hasContent = sections.some((s) => s.content.replace(/<[^>]+>/g, '').trim().length >= 10);
    if (!hasContent) {
      setCurrentStep(2);
      return 'Cần ít nhất một mục mô tả công việc có nội dung.';
    }
    return null;
  };

  // Tags management
  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().replace(/^,|,$/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Section Manipulation Handlers
  const handleSectionContentChange = (id: string, newHtml: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, content: newHtml } : s)));
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
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s)));
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

  // Fill templates
  const handleFillAllTemplates = () => {
    const jobTitle = title.trim() || 'Kỹ sư phần mềm';
    const newSections = buildJobTemplateContent(jobTitle, level, department, tags);
    setSections(newSections);
    setToast({ message: `Đã điền 5 mục nội dung mẫu cho vị trí "${jobTitle}".`, type: 'success' });
  };

  const handleInsertSectionTemplate = (id: string, type: JobSectionData['type']) => {
    const jobTitle = title.trim() || 'Kỹ sư phần mềm';
    const generated = buildJobTemplateContent(jobTitle, level, department, tags);
    const matched = generated.find((s) => s.type === type);
    if (matched) {
      handleSectionContentChange(id, matched.content);
      setToast({ message: `Đã chèn nội dung mẫu cho mục "${matched.title}".`, type: 'info' });
    }
  };

  // File Upload & AI Parse
  const handleFileProcess = async (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setIsParsing(true);
    setParseSuccess(false);

    try {
      const res = await uploadJDForParsing(file);

      if (res.ok) {
        const jd = await res.json();
        if (jd?.id) setJobId(jd.id);
        if (jd?.title) setTitle(jd.title);

        const meta: Record<string, unknown> = jd?.normalized_json || {};
        if (meta.title && !jd?.title) setTitle(String(meta.title));

        // Auto-match company name with counselor partners
        const extractedComp = String(meta.company || jd?.company || '').trim();
        if (extractedComp && partners.length > 0) {
          const matched = partners.find(
            (p) =>
              p.name.toLowerCase().includes(extractedComp.toLowerCase()) ||
              extractedComp.toLowerCase().includes(p.name.toLowerCase())
          );
          if (matched) {
            setSelectedPartnerId(matched.id);
            setCompanyName(matched.name);
          } else if (!selectedPartnerId) {
            setSelectedPartnerId(partners[0].id);
            setCompanyName(partners[0].name);
          }
        } else if (partners.length > 0 && !selectedPartnerId) {
          setSelectedPartnerId(partners[0].id);
          setCompanyName(partners[0].name);
        }

        if (meta.department) setDepartment(String(meta.department));

        // Level
        setLevel(normalizeLevel(meta.level || meta.job_level));

        // Employment Type
        setEmploymentType(normalizeEmploymentType(meta.employment_type));

        // Work Model
        setWorkModel(normalizeWorkModel(meta.work_model || meta.remote_type));

        // Location
        const loc = meta.location || jd?.location;
        if (loc) {
          setLocationCity(normalizeLocationCity(loc));
          setAddress(String(loc));
        }
        if (meta.address) setAddress(String(meta.address));

        // Skills / Tags
        if (Array.isArray(meta.tags) && meta.tags.length > 0) {
          setTags(meta.tags.map(String).filter(Boolean));
        } else if (Array.isArray(meta.must_have_skills) && meta.must_have_skills.length > 0) {
          const extractedTags = meta.must_have_skills
            .map((s: unknown) =>
              typeof s === 'object' && s !== null && 'name' in s ? String((s as { name: unknown }).name) : String(s)
            )
            .filter(Boolean);
          if (extractedTags.length > 0) setTags(extractedTags);
        } else if (Array.isArray(meta.skills) && meta.skills.length > 0) {
          const extractedTags = meta.skills
            .map((s: unknown) =>
              typeof s === 'object' && s !== null && 'name' in s ? String((s as { name: unknown }).name) : String(s)
            )
            .filter(Boolean);
          if (extractedTags.length > 0) setTags(extractedTags);
        }

        // Salary
        if (meta.salary_min) setSalaryMin(String(meta.salary_min));
        if (meta.salary_max) setSalaryMax(String(meta.salary_max));
        if (meta.salary_currency) setSalaryCurrency(String(meta.salary_currency));
        if (meta.salary_visibility) setSalaryVisibility(String(meta.salary_visibility));

        // Quantity & Experience
        if (meta.quantity) setQuantity(String(meta.quantity));
        if (meta.experience) setExperience(String(meta.experience));
        else if (meta.min_years_experience) setExperience(`${meta.min_years_experience} năm`);
        if (meta.education) setEducation(String(meta.education));
        if (meta.deadline) setDeadline(String(meta.deadline).slice(0, 10));

        // Sections
        if (Array.isArray(meta.sections) && meta.sections.length > 0) {
          setSections(meta.sections as JobSectionData[]);
        } else if (
          meta.overview_html ||
          meta.responsibilities_html ||
          meta.must_have_html ||
          meta.nice_to_have_html ||
          meta.benefits_html
        ) {
          setSections([
            { ...DEFAULT_SECTIONS[0], content: String(meta.overview_html || DEFAULT_SECTIONS[0].content) },
            { ...DEFAULT_SECTIONS[1], content: String(meta.responsibilities_html || DEFAULT_SECTIONS[1].content) },
            { ...DEFAULT_SECTIONS[2], content: String(meta.must_have_html || DEFAULT_SECTIONS[2].content) },
            { ...DEFAULT_SECTIONS[3], content: String(meta.nice_to_have_html || DEFAULT_SECTIONS[3].content) },
            { ...DEFAULT_SECTIONS[4], content: String(meta.benefits_html || DEFAULT_SECTIONS[4].content) },
          ]);
        } else if (jd?.requirements_text) {
          const generatedSections = buildJobTemplateContent(
            jd.title || 'Vị trí tuyển dụng',
            String(meta.level || 'Middle'),
            String(meta.department || ''),
            Array.isArray(meta.tags) ? meta.tags.map(String) : []
          );
          const paragraphs = String(jd.requirements_text)
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((p: string) => `<p>${String(p).replace(/<[^>]+>/g, '').trim()}</p>`)
            .join('');
          setSections([
            { ...generatedSections[0], content: paragraphs || generatedSections[0].content },
            ...generatedSections.slice(1),
          ]);
        }

        if (Array.isArray(meta.questions) && meta.questions.length > 0) {
          setQuestions(meta.questions as ScreeningQuestion[]);
        }

        setParseSuccess(true);
        setToast({ message: `Đã trích xuất và tự động điền thông tin JD từ file "${file.name}"!`, type: 'success' });
        return;
      }

      setParseSuccess(false);
      setToast({ message: `Không thể trích xuất tự động từ "${file.name}". Bạn có thể điền thông tin bên dưới.`, type: 'info' });
    } catch {
      setParseSuccess(false);
      setToast({ message: `Chưa thể trích xuất "${file.name}". Vui lòng kiểm tra lại file.`, type: 'error' });
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

  // 5. Save Draft Handler (Counselor API)
  const handleSaveDraft = async () => {
    if (isSubmitting) return;
    if (!title.trim()) {
      setCurrentStep(1);
      setToast({ message: 'Vui lòng nhập tên vị trí trước khi lưu nháp.', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      let activePartnerId = selectedPartnerId;
      let activeCompanyName = companyName;
      if (!activePartnerId && partners.length > 0) {
        activePartnerId = partners[0].id;
        activeCompanyName = partners[0].name;
        setSelectedPartnerId(activePartnerId);
        setCompanyName(activeCompanyName);
      }
      const currentMeta = buildPayloadMetadata(activePartnerId, activeCompanyName);
      const fullText = buildRequirementsText(sections, title);
      const payload = {
        title: title.trim() || 'Bản nháp vị trí',
        company: activeCompanyName.trim() || 'Doanh nghiệp liên kết',
        location: locationCity || 'Hồ Chí Minh',
        requirements_text: fullText.length >= 10 ? fullText : 'Yêu cầu công việc: ' + (title || 'Tuyển dụng'),
        is_published: false,
        metadata: currentMeta,
      };

      let targetId = jobId;
      if (targetId) {
        await (ApiClient as any).updateCounselorJD(targetId, payload);
      } else {
        const created = await (ApiClient as any).createCustomJD(
          payload.title,
          payload.company,
          payload.location,
          payload.requirements_text,
          payload.metadata
        );
        targetId = created?.id;
        if (targetId) setJobId(targetId);
      }

      setPublishedState(false);
      setSaveStatus('saved');
      const now = new Date();
      setLastSavedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      pushVersionSnapshot('Lưu bản nháp');
      window.dispatchEvent(new Event('career:jds-updated'));
      setToast({ message: 'Đã lưu tin tuyển dụng dưới dạng "Bản nháp".', type: 'success' });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onNavigate('jds');
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu bản nháp';
      setToast({ message: `Lỗi: ${msg}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Publish Handler (Counselor API)
  const handlePublish = async () => {
    if (isSubmitting) return;
    const validationError = validateForm();
    if (validationError) {
      setToast({ message: validationError, type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      let activePartnerId = selectedPartnerId;
      let activeCompanyName = companyName;
      if (!activePartnerId && partners.length > 0) {
        activePartnerId = partners[0].id;
        activeCompanyName = partners[0].name;
        setSelectedPartnerId(activePartnerId);
        setCompanyName(activeCompanyName);
      }
      const currentMeta = buildPayloadMetadata(activePartnerId, activeCompanyName);
      const fullText = buildRequirementsText(sections, title);
      const payload = {
        title: title.trim() || 'Vị trí tuyển dụng',
        company: activeCompanyName.trim() || 'Doanh nghiệp liên kết',
        location: locationCity || 'Hồ Chí Minh',
        requirements_text: fullText.length >= 10 ? fullText : 'Yêu cầu công việc: ' + (title || 'Tuyển dụng'),
        is_published: true,
        metadata: currentMeta,
      };

      let targetId = jobId;
      if (targetId) {
        await (ApiClient as any).updateCounselorJD(targetId, payload);
      } else {
        const created = await (ApiClient as any).createCustomJD(
          payload.title,
          payload.company,
          payload.location,
          payload.requirements_text,
          payload.metadata
        );
        targetId = created?.id;
        if (targetId) setJobId(targetId);
      }

      if (targetId) {
        await (ApiClient as any).publishJD(targetId);
      }

      setPublishedState(true);
      setSaveStatus('saved');
      const now = new Date();
      setLastSavedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      pushVersionSnapshot('Đăng tuyển');
      window.dispatchEvent(new Event('career:jds-updated'));
      setToast({
        message: 'Đã công bố JD thành công! Sinh viên đã có thể xem tin để đối chiếu & tối ưu CV.',
        type: 'success',
      });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onNavigate('jds');
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đăng tin tuyển dụng';
      setToast({ message: `Lỗi: ${msg}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePartnerSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setSelectedPartnerId(pId);
    const found = partners.find((p) => p.id === pId);
    if (found) {
      setCompanyName(found.name);
      if (found.location && !address) {
        setAddress(found.location);
      }
    }
  };

  return (
    <div
      className={`space-y-5 pb-12 antialiased ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-6 overflow-y-auto' : ''}`}
      data-testid="counselor-create-job"
    >
      {/* Fullscreen Floating Exit Header */}
      {isFullscreen && (
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
              onClick={() => setIsFullscreen(false)}
            >
              <ArrowLeft size={16} />
              <span>Thoát toàn màn hình</span>
            </button>
            <strong className="text-sm font-bold text-slate-900">
              {title || 'Vị trí mới'} — Bản nháp (Cố vấn)
            </strong>
          </div>

          <div className="flex items-center gap-3">
            {jobId && !isLoadingJob && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-[#006948] text-xs font-semibold border border-emerald-200/60">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Đã lưu lúc {lastSavedTime}</span>
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006948] text-white text-xs font-bold hover:bg-[#047857] shadow-xs transition-all"
              onClick={() => {
                setIsFullscreen(false);
                setIsPreviewOpen(true);
              }}
            >
              <Eye size={15} />
              <span>Xem trước</span>
            </button>
          </div>
        </div>
      )}

      {/* Standard Header */}
      {!isFullscreen && (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#006948] transition-colors mb-1.5"
              onClick={() => (onBack ? onBack() : onNavigate('jds'))}
            >
              <ArrowLeft size={14} />
              <span>Quay lại danh sách JD</span>
            </button>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold tracking-tight text-[#171d19]">
              {editJobId ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng & Quản lý JD (Cố vấn)'}
            </h1>
            <p className="font-['Inter'] text-sm text-[#475569] mt-0.5">
              Tải file JD, trích xuất AI, hoàn thiện nội dung và công bố vị trí cho doanh nghiệp đối tác để sinh viên đối chiếu hồ sơ
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-all"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Lưu bản nháp</span>
            </button>

            <button
              type="button"
              className="h-10 px-4 rounded-xl bg-[#006948] text-white text-xs font-bold hover:bg-[#047857] flex items-center gap-1.5 shadow-xs transition-all"
              onClick={handlePublish}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              <span>{editJobId ? 'Cập nhật & Đăng tuyển' : 'Công bố JD cho SV'}</span>
            </button>
          </div>
        </header>
      )}

      {/* 4-Step Wizard Navigation */}
      {!isFullscreen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentStep === 1
                ? 'bg-[#006948] text-white shadow-xs'
                : 'bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/40'
            }`}
            onClick={() => setCurrentStep(1)}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 1 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              1
            </span>
            <span className="truncate">Thông tin & File JD</span>
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentStep === 2
                ? 'bg-[#006948] text-white shadow-xs'
                : 'bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/40'
            }`}
            onClick={() => setCurrentStep(2)}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 2 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              2
            </span>
            <span className="truncate">Soạn bài (Word-Like Editor)</span>
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentStep === 3
                ? 'bg-[#006948] text-white shadow-xs'
                : 'bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/40'
            }`}
            onClick={() => setCurrentStep(3)}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 3 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              3
            </span>
            <span className="truncate">Câu hỏi ứng tuyển</span>
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentStep === 4
                ? 'bg-[#006948] text-white shadow-xs'
                : 'bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/40'
            }`}
            onClick={() => setCurrentStep(4)}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 4 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              4
            </span>
            <span className="truncate">Xem trước & Công bố</span>
          </button>
        </div>
      )}

      {/* Edit-mode loading / error states */}
      {isLoadingJob && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Loader2 size={22} className="animate-spin text-[#006948] mx-auto mb-2.5" />
          <p className="text-xs text-slate-500">Đang tải tin tuyển dụng cần chỉnh sửa...</p>
        </div>
      )}
      {!isLoadingJob && loadError && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
          <AlertTriangle size={26} className="text-red-600 mx-auto mb-2.5" />
          <p className="text-xs text-slate-600 mb-3.5">{loadError}</p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006948] text-white text-xs font-bold rounded-xl hover:bg-[#047857]"
            onClick={() => (onBack ? onBack() : onNavigate('jds'))}
          >
            <ArrowLeft size={15} />
            <span>Quay lại danh sách</span>
          </button>
        </div>
      )}

      {/* Main Content Area by Step */}
      {!isLoadingJob && !loadError && (
        <div className="space-y-6">
          {/* STEP 1: Thông tin cơ bản, Doanh nghiệp & File Upload */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* 1. Doanh nghiệp đối tác & Ảnh bìa / Logo tin tuyển dụng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Partner selector */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-[#006948] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-bold text-slate-900 block mb-1">
                      Doanh nghiệp đối tác: <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                      value={selectedPartnerId}
                      onChange={handlePartnerSelectChange}
                    >
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.location ? `(${p.location})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Banner / Job Cover Image Picker */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="w-16 h-12 rounded-xl border border-dashed border-slate-300 hover:border-[#006948] bg-slate-50 flex items-center justify-center cursor-pointer shrink-0 overflow-hidden relative group transition-all"
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={18} className="text-slate-400 group-hover:text-[#006948]" />
                    )}
                    <input
                      type="file"
                      ref={imageInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setImageUrl(String(ev.target?.result || ''));
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 block">Hình ảnh bìa JD</span>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-[11px] text-red-600 hover:underline font-semibold"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 overflow-x-auto pb-0.5">
                      {[
                        { name: 'Công nghệ', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&auto=format&fit=crop&q=60' },
                        { name: 'Văn phòng', url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=500&auto=format&fit=crop&q=60' },
                        { name: 'AI / Data', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60' },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImageUrl(preset.url)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap transition-all ${
                            imageUrl === preset.url
                              ? 'bg-emerald-50 border-[#006948] text-[#006948]'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. JD file upload & auto-fill dropzone */}
              <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileUp size={16} className="text-[#006948]" />
                  <span>Tải lên JD có sẵn (tự động bóc tách &amp; điền biểu mẫu)</span>
                </h2>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                />

                <div
                  className={`recruiter-jd-uploader border-2 border-dashed border-slate-300 hover:border-[#006948] bg-slate-50/70 hover:bg-emerald-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 group ${
                    isDragOver ? 'border-[#006948] bg-emerald-50/40 is-dragover' : ''
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006948] flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform shadow-2xs">
                    <UploadCloud size={20} />
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-slate-800">
                    Kéo thả file JD hoặc bấm để chọn từ máy tính
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    PDF, Word (.docx), Văn bản (.txt), Ảnh — AI Parser sẽ tự động bóc tách và điền biểu mẫu
                  </p>
                </div>

                {isParsing && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    <Loader2 size={15} className="animate-spin text-[#006948] shrink-0" />
                    <span>Đang phân tích và trích xuất nội dung từ file <strong>{uploadedFileName}</strong>...</span>
                  </div>
                )}

                {parseSuccess && !isParsing && (
                  <div className="flex items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                      <span>Đã trích xuất thành công từ <strong>{uploadedFileName}</strong>! Thông tin đã được tự động điền vào các ô bên dưới.</span>
                    </div>
                    <button
                      type="button"
                      className="text-emerald-800 font-bold hover:underline shrink-0 text-xs"
                      onClick={() => {
                        setUploadedFileName(null);
                        setParseSuccess(false);
                      }}
                    >
                      Đổi file
                    </button>
                  </div>
                )}
              </section>

              {/* 3. Thông tin vị trí tuyển dụng */}
              <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Thông tin vị trí tuyển dụng
                </h2>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Tên vị trí tuyển dụng (Job Title) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] transition-all shadow-2xs"
                    placeholder="VD: Senior React Developer / AI Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Phòng ban</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                      placeholder="VD: Công nghệ thông tin / Sản phẩm"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Cấp độ (Level) <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs cursor-pointer"
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
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Hình thức làm việc <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs cursor-pointer"
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                    >
                      <option value="Full-time">Toàn thời gian (Full-time)</option>
                      <option value="Part-time">Bán thời gian (Part-time)</option>
                      <option value="Internship">Thực tập (Internship)</option>
                      <option value="Contract">Hợp đồng (Contract)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Số lượng cần tuyển</label>
                    <input
                      type="number"
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                      placeholder="1"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Yêu cầu kinh nghiệm</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                      placeholder="VD: 1-3 năm / Không yêu cầu"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Trình độ học vấn</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                      placeholder="VD: Đại học / Cao đẳng"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* 4. Địa điểm & Kỹ năng cốt lõi */}
              <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Địa điểm &amp; Kỹ năng cốt lõi
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Mô hình làm việc <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs cursor-pointer"
                      value={workModel}
                      onChange={(e) => setWorkModel(e.target.value)}
                    >
                      <option value="On-site">Tại văn phòng (On-site)</option>
                      <option value="Hybrid">Kết hợp (Hybrid)</option>
                      <option value="Remote">Làm việc từ xa (Remote)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Tỉnh / Thành phố <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs cursor-pointer"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                    >
                      <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Đà Nẵng">Đà Nẵng</option>
                      <option value="Khác">Khác / Toàn quốc</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Địa chỉ chi tiết</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                      placeholder="VD: Q. Cầu Giấy / TP. Thủ Đức"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Kỹ năng yêu cầu (Tags dùng để tính điểm Matching AI)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-300 rounded-xl min-h-[42px] shadow-2xs focus-within:border-[#006948] focus-within:ring-1 focus-within:ring-[#006948]">
                    {tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200/70 text-[#006948] text-xs font-semibold rounded-md inline-flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          className="hover:text-red-600 transition-colors"
                          onClick={() => removeTag(tag)}
                          aria-label={`Xóa kỹ năng ${tag}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      placeholder="Nhập kỹ năng rồi nhấn Enter..."
                      className="border-none outline-none bg-transparent flex-1 min-w-[150px] text-xs md:text-sm text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </section>

              {/* 5. Mức lương & Hạn nộp */}
              <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Mức lương &amp; Hạn chót
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Khoảng lương</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        className="w-1/2 h-10 px-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] shadow-2xs"
                        placeholder="Từ (15 tr)"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                      />
                      <input
                        type="text"
                        className="w-1/2 h-10 px-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] shadow-2xs"
                        placeholder="Đến (25 tr)"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                      />
                      <select
                        className="w-20 h-10 px-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#006948] shadow-2xs"
                        value={salaryCurrency}
                        onChange={(e) => setSalaryCurrency(e.target.value)}
                      >
                        <option value="VND">VND</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Chế độ hiển thị lương</label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#006948] shadow-2xs cursor-pointer"
                      value={salaryVisibility}
                      onChange={(e) => setSalaryVisibility(e.target.value)}
                    >
                      <option value="Công khai">Công khai mức lương</option>
                      <option value="Thỏa thuận">Thỏa thuận khi phỏng vấn</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Hạn chót ứng tuyển <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#006948] shadow-2xs cursor-pointer"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Step 1 Navigation */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006948] text-white text-xs font-bold rounded-xl hover:bg-[#047857] transition-all shadow-xs"
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
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Soạn nội dung bài đăng (Word-Like Editor)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chỉnh sửa trực quan với danh sách, bảng biểu, in đậm/nghiêng. Cấu trúc chuẩn hóa giúp thuật toán Matching AI hoạt động chính xác nhất.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
                    onClick={handleAddCustomSection}
                  >
                    <Plus size={15} />
                    <span>Thêm mục mới</span>
                  </button>
                </div>
              </div>

              {/* Quick template bar in the editor */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#006948] flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-slate-900">
                      Điền nhanh bằng nội dung mẫu chuẩn
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tự động điền 5 mục nội dung mẫu (Tổng quan, Nhiệm vụ, Yêu cầu bắt buộc, Yêu cầu ưu tiên, Quyền lợi) cho vị trí <strong>&quot;{title || 'Kỹ sư phần mềm'}&quot;</strong>.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-bold shadow-2xs transition-colors shrink-0"
                  onClick={handleFillAllTemplates}
                >
                  <ClipboardList size={15} />
                  <span>Chèn nội dung mẫu cho tất cả mục</span>
                </button>
              </div>

              {/* Structured Sections Block List with Drag & Reordering */}
              <div className="space-y-4">
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
                    onInsertTemplate={handleInsertSectionTemplate}
                  />
                ))}
              </div>

              {/* Step 2 Navigation */}
              <div className="flex justify-between items-center pt-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-2xs"
                  onClick={() => setCurrentStep(1)}
                >
                  <ArrowLeft size={16} />
                  <span>Quay lại thông tin</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006948] text-white text-xs font-bold rounded-xl hover:bg-[#047857] shadow-xs"
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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle size={18} className="text-[#006948]" />
                  <span>Câu hỏi sàng lọc ứng viên khi nộp hồ sơ</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Thiết lập các câu hỏi ngắn để ứng viên trả lời trước khi gửi CV. Giúp Cố vấn và Doanh nghiệp phân loại hồ sơ nhanh chóng.
                </p>
              </div>

              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <strong className="text-sm font-semibold text-slate-900 block">{q.question}</strong>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Loại: Văn bản ngắn · {q.required ? 'Bắt buộc trả lời' : 'Tùy chọn'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      onClick={() => handleDeleteQuestion(q.id)}
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    className="flex-1 h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] shadow-2xs"
                    placeholder="Nhập nội dung câu hỏi mới..."
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors shadow-2xs"
                    onClick={handleAddQuestion}
                  >
                    <Plus size={16} />
                    <span>Thêm câu hỏi</span>
                  </button>
                </div>
              </div>

              {/* Step 3 Navigation */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-2xs"
                  onClick={() => setCurrentStep(2)}
                >
                  <ArrowLeft size={16} />
                  <span>Quay lại soạn bài</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006948] text-white text-xs font-bold rounded-xl hover:bg-[#047857] shadow-xs"
                  onClick={() => setCurrentStep(4)}
                >
                  <span>Xem trước &amp; Công bố JD</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Xem trước & Công bố JD */}
          {currentStep === 4 && (
            <div className="space-y-6">
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
                quantity={quantity}
                tags={tags}
                sections={sections}
                questions={questions}
                imageUrl={imageUrl}
                companyName={companyName}
              />

              {/* Step 4 Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-2xs"
                  onClick={() => setCurrentStep(3)}
                >
                  <ArrowLeft size={16} />
                  <span>Chỉnh sửa lại</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-2xs"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Lưu bản nháp</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006948] text-white text-xs font-bold hover:bg-[#047857] shadow-xs"
                    onClick={handlePublish}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>{editJobId ? 'Cập nhật & Công bố' : 'Xác nhận & Công bố JD'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Version History Drawer Modal */}
      {showVersionDrawer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowVersionDrawer(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[#006948]" />
                <h3 className="font-bold text-sm text-slate-900">Lịch sử phiên bản chỉnh sửa</h3>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setShowVersionDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">
                Career Assistant tự động sao lưu các mốc chỉnh sửa. Bạn có thể khôi phục lại phiên bản trước bất cứ lúc nào.
              </p>
              <div className="space-y-2">
                {versionsList.map((ver, idx) => (
                  <div key={ver.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-slate-900">{ver.time}</strong>
                        {idx === 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Hiện tại</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Người sửa: {ver.author} · {ver.title}
                      </p>
                    </div>
                    {idx > 0 && (
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          if (ver.snapshot) applySnapshot(ver.snapshot);
                          setShowVersionDrawer(false);
                        }}
                      >
                        Khôi phục
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-[#006948] text-white text-xs font-bold rounded-xl hover:bg-[#047857]"
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
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="font-bold text-sm text-slate-900">Xem trước tin tuyển dụng hiển thị cho Sinh viên</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                aria-label="Đóng"
                onClick={() => setIsPreviewOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
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
                quantity={quantity}
                tags={tags}
                sections={sections}
                questions={questions}
                imageUrl={imageUrl}
                companyName={companyName}
              />
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100"
                onClick={() => setIsPreviewOpen(false)}
              >
                Đóng xem trước
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006948] text-white text-xs font-bold hover:bg-[#047857]"
                onClick={() => {
                  setIsPreviewOpen(false);
                  handlePublish();
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{editJobId ? 'Cập nhật & Công bố' : 'Công bố JD luôn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
