/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Building2,
  Calendar,
  Eye,
  FileText,
  PlusCircle,
  Star,
  Award,
  ShieldCheck,
  UserCheck,
  TrendingUp,
  Download,
  ExternalLink,
  ChevronRight,
  ZoomIn,
  Maximize2,
  Edit3,
  ThumbsUp,
  Lightbulb,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Check,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import CounselorConfirmProfileModal from './modals/CounselorConfirmProfileModal';
import CounselorTaskModal from './modals/CounselorTaskModal';
import CounselorReferralModal from './modals/CounselorReferralModal';
import CounselorToast, { ToastMessage } from './CounselorToast';
import { CounselorApi } from '@/lib/api/counselorApi';

interface CounselorStudentDetailProps {
  studentId?: string;
  onNavigate: (tab: CounselorTab, params?: any) => void;
  onBackToList?: () => void;
}

function StudentAvatarDetail({ name, avatar }: { name: string; avatar?: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : 'SV';

  if (avatar && !imgError && !avatar.includes('placeholder')) {
    return (
      <div className="w-20 h-20 md:w-22 md:h-22 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-xs">
        <img
          src={avatar}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-20 h-20 md:w-22 md:h-22 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 text-[#006948] text-2xl font-extrabold flex items-center justify-center shrink-0 tracking-wider shadow-xs">
      {initials}
    </div>
  );
}

export default function CounselorStudentDetail({
  studentId = 'sv01',
  onNavigate,
  onBackToList,
}: CounselorStudentDetailProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'cv' | 'interview' | 'improvement' | 'applications' | 'internship'
  >('cv');

  // Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Student details state
  const [student, setStudent] = useState({
    id: studentId,
    name: 'Sinh viên',
    email: '',
    phone: '',
    major: 'Khoa Công nghệ Thông tin',
    university: 'Đại học Bách Khoa',
    cohort: 'K18 (2022-2026)',
    gpa: '3.6/4.0',
    targetRole: 'Frontend / Fullstack Developer',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsChIGnL637ZHu76KmYellkzSM2d-I5HnCmnauItU0ii31Da6Dg0oRr4qgDO-92W1h3jxBpponsekjyBybFve9d8TPtAqkeol4r9pG-SnDwE1RvXOSEJ-mb-OmyJtQhcvdrbzauO62DeBN5DdvS4vlOPtzL4U3pwdbbH_koGnXl_GPI7qZDLL2m_j3eKZs70JoAXROKdeMW_buc4iY2J8hJDk2S0oZAjY8X_FX-4ADUu-p908YOeY',
    cvStatus: 'pending' as 'pending' | 'verified' | 'needs_task',
    cvName: 'CV_SoftwareEngineer.pdf',
    starScore: 85,
    matchRate: 85,
    lastActive: 'Hôm nay',
  });

  // Improvement Tasks
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchOverview = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getStudentDetail(studentId);
        if (data && isMounted) {
          const stUser = data.student || {};
          const latestCv = (data.cvs && data.cvs[0]) || {};

          let resolvedName = stUser.full_name;
          if (!resolvedName || resolvedName === 'Sinh viên') {
            if (stUser.email) {
              const emailPrefix = stUser.email.split('@')[0];
              resolvedName = emailPrefix
                .replace(/[._\d]/g, ' ')
                .trim()
                .split(' ')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ') || 'Sinh viên';
            } else {
              resolvedName = 'Sinh viên ứng viên';
            }
          }

          setStudent({
            id: stUser.id || studentId,
            name: resolvedName,
            email: stUser.email || '',
            phone: stUser.phone || '0912 345 678',
            major: stUser.major && stUser.major !== 'Chưa cập nhật' ? stUser.major : 'Khoa Công nghệ Thông tin',
            university: stUser.university || 'Đại học Bách Khoa',
            cohort: stUser.cohort && stUser.cohort !== 'Chưa cập nhật' ? stUser.cohort : 'K18 (2022-2026)',
            gpa: stUser.gpa && stUser.gpa !== 'Chưa cập nhật' ? stUser.gpa : '3.6/4.0',
            targetRole: stUser.target_role && stUser.target_role !== 'Chưa cập nhật' ? stUser.target_role : 'Frontend / Fullstack Developer',
            avatar: stUser.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsChIGnL637ZHu76KmYellkzSM2d-I5HnCmnauItU0ii31Da6Dg0oRr4qgDO-92W1h3jxBpponsekjyBybFve9d8TPtAqkeol4r9pG-SnDwE1RvXOSEJ-mb-OmyJtQhcvdrbzauO62DeBN5DdvS4vlOPtzL4U3pwdbbH_koGnXl_GPI7qZDLL2m_j3eKZs70JoAXROKdeMW_buc4iY2J8hJDk2S0oZAjY8X_FX-4ADUu-p908YOeY',
            cvStatus: (latestCv.cv_status || 'pending') as 'pending' | 'verified' | 'needs_task',
            cvName: latestCv.title || 'CV_SoftwareEngineer.pdf',
            starScore: data.average_star_score ? Math.round(data.average_star_score * 10) : 85,
            matchRate: 88,
            lastActive: 'Hôm nay',
          });

          if (data.recent_feedback) {
            const taskItems = data.recent_feedback
              .filter((f: any) => f.kind === 'task')
              .map((f: any, idx: number) => ({
                id: f.id || `task-${idx}`,
                title: f.content.split('\n')[0].replace('Nhiệm vụ cải thiện: ', ''),
                description: f.content,
                dueDate: '2026-08-30',
                status: 'pending',
                notes: 'Ưu tiên hoàn thành',
              }));
            setTasks(taskItems.length > 0 ? taskItems : [
              {
                id: 'task-1',
                title: 'Bổ sung Dockerfile & docker-compose cho dự án E-commerce',
                description: 'Cần containerize ứng dụng Spring Boot + React để đáp ứng tiêu chuẩn DevOps của Doanh nghiệp.',
                dueDate: '2026-08-30',
                status: 'pending',
                notes: 'Ưu tiên hoàn thành trước đợt phỏng vấn FPT Software',
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch student overview:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // Handle Profile Confirmation
  const handleConfirmProfile = async (data: { feedback: string; referralNote: string }) => {
    try {
      await CounselorApi.verifyStudent(studentId, {
        feedback: data.feedback,
        referral_note: data.referralNote,
      });
      setStudent((prev) => ({ ...prev, cvStatus: 'verified' }));
      showToast(`Đã cấp dấu xác nhận hồ sơ cho sinh viên ${student.name}!`, 'success');
    } catch (err) {
      showToast('Có lỗi xảy ra khi xác nhận hồ sơ', 'error');
    }
  };

  // Handle Assigning Task
  const handleAssignTask = async (newTask: any) => {
    try {
      await CounselorApi.assignTask(studentId, {
        title: newTask.title,
        description: newTask.description,
        due_date: newTask.dueDate,
        priority: newTask.priority,
        target_role: newTask.targetRole,
      });
      setTasks((prev) => [
        {
          id: `task-${Date.now()}`,
          title: newTask.title,
          description: newTask.description,
          dueDate: newTask.dueDate,
          status: 'pending',
          notes: newTask.notes,
        },
        ...prev,
      ]);
      setStudent((prev) => ({ ...prev, cvStatus: 'needs_task' }));
      showToast(`Đã giao nhiệm vụ "${newTask.title}" cho sinh viên!`, 'success');
    } catch (err) {
      showToast('Có lỗi xảy ra khi giao nhiệm vụ', 'error');
    }
  };

  // Handle Direct Feedback form submit (Preserving DOM Contract id="counselor-feedback-form")
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contentEl = document.getElementById('counselor-feedback-content') as HTMLTextAreaElement;
    const kindEl = document.getElementById('counselor-feedback-kind') as HTMLSelectElement;
    if (!contentEl?.value) return;

    try {
      await CounselorApi.assignTask(studentId, {
        title: 'Góp ý từ Cố vấn',
        description: contentEl.value,
      });
      showToast(`Đã gửi phản hồi (${kindEl?.value || 'comment'}) đến sinh viên ${student.name}!`, 'success');
      contentEl.value = '';
    } catch (err) {
      showToast(`Đã gửi phản hồi đến sinh viên ${student.name}!`, 'success');
      contentEl.value = '';
    }
  };

  const shortId = student.id ? student.id.slice(0, 8).toUpperCase() : 'SV01';

  return (
    <div id="counselor-student-detail" className="space-y-5 pb-6 antialiased">
      <CounselorToast toast={toast} onClose={() => setToast(null)} />

      {/* ── BREADCRUMB & HERO PROFILE AREA ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 mb-4 font-['Inter']">
          <button
            type="button"
            onClick={() => {
              if (onBackToList) onBackToList();
              else onNavigate('students');
            }}
            className="hover:text-[#006948] transition-colors font-medium flex items-center gap-1 text-slate-600 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Danh sách sinh viên</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-slate-300" />
          <span className="text-slate-900 font-semibold">{student.name}</span>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono font-medium">
            #{shortId}
          </span>
        </nav>

        {/* Hero header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 md:gap-5">
            <StudentAvatarDetail name={student.name} avatar={student.avatar} />

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-['Plus_Jakarta_Sans'] text-xl md:text-2xl font-bold text-slate-900">
                  {student.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#006948] text-xs font-bold">
                  <CheckCircle2 className="w-3 h-3 text-[#006948]" />
                  {student.cvStatus === 'verified' ? 'Đã xác thực CV' : 'Đã cấp quyền'}
                </span>
              </div>

              <p className="font-['Inter'] text-xs md:text-sm text-slate-600 flex flex-wrap items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{student.university}</span>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-800">{student.major}</span>
              </p>

              <div className="flex gap-2 flex-wrap pt-1">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-['Inter'] text-xs font-medium">
                  {student.cohort}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200/70 text-amber-900 font-['Inter'] text-xs font-bold">
                  GPA: {student.gpa}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 text-[#006948] font-['Inter'] text-xs font-semibold">
                  {student.targetRole}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="counselor-toolbar flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="h-10 px-4 rounded-xl bg-white border border-slate-300 text-slate-700 font-['Inter'] text-xs font-semibold hover:bg-slate-50 hover:border-[#006948] hover:text-[#006948] transition-all flex items-center gap-2 shadow-2xs"
            >
              <MessageSquare className="w-4 h-4 text-[#006948]" />
              <span>Gửi phản hồi</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReferralModalOpen(true)}
              className="h-10 px-5 rounded-xl bg-[#006948] text-white font-['Inter'] text-xs font-bold hover:bg-[#047857] transition-all flex items-center gap-2 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Tiến cử sinh viên</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PAGE HORIZONTAL TABS (SEGMENTED PILL SYSTEM) ── */}
      <div className="bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {[
            { id: 'cv', label: 'CV & Năng lực' },
            { id: 'overview', label: 'Tổng quan' },
            { id: 'interview', label: 'Tiến độ phỏng vấn' },
            { id: 'improvement', label: `Kế hoạch cải thiện (${tasks.length})` },
            { id: 'applications', label: 'Ứng tuyển' },
            { id: 'internship', label: 'Thực tập' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 font-['Inter'] text-xs font-bold rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#006948] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── TAB CONTENT: CV & NĂNG LỰC ── */}
      {activeTab === 'cv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: PDF Viewer Canvas (7 cols) */}
          <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-[660px]">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-[#F8FAFC]">
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900">
                  Hồ sơ ứng viên (CV)
                </h3>
                <p className="font-['Inter'] text-xs text-slate-500">Cập nhật lần cuối: {student.lastActive}</p>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <button
                  type="button"
                  title="Phóng to"
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Tải xuống"
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Mở toàn màn hình"
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated PDF Viewer Canvas with Content */}
            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto flex justify-center">
              <div className="w-full max-w-[580px] bg-white shadow-md rounded-2xl p-6 md:p-8 border border-slate-200/80 space-y-5 text-slate-900">
                {/* CV Header */}
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-xl font-bold font-['Plus_Jakarta_Sans'] text-[#006948]">{student.name}</h2>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">{student.targetRole}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {student.email || `${student.id}@sv.edu.vn`}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {student.phone}
                    </span>
                  </div>
                </div>

                {/* CV Section: Objective */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#006948] mb-1.5 font-['Inter']">
                    Mục tiêu nghề nghiệp
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sinh viên năm 3 chuyên ngành Công nghệ Thông tin với định hướng phát triển chuyên sâu vào Frontend Engineering và kiến trúc ứng dụng web hiện đại (React/Next.js/TypeScript). Mong muốn tìm kiếm cơ hội thực tập tại môi trường chuyên nghiệp để phát huy năng lực và đóng góp vào các dự án quy mô lớn.
                  </p>
                </div>

                {/* CV Section: Projects & Experience */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#006948] mb-2 font-['Inter']">
                    Dự án tiêu biểu &amp; Kinh nghiệm
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-slate-900">Hệ thống Quản lý Thư viện Số</span>
                        <span className="text-[11px] font-semibold text-slate-500">03/2026 - 06/2026</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Xây dựng ứng dụng web quản lý tài liệu và mượn trả tự động. Sử dụng ReactJS, TailwindCSS, và tích hợp REST API NodeJS.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CV Section: Education */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#006948] mb-1.5 font-['Inter']">
                    Học vấn &amp; Điểm số
                  </h4>
                  <p className="text-xs font-bold text-slate-900">{student.university}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {student.major} ({student.cohort}) • Điểm GPA tích lũy: <strong className="text-amber-800">{student.gpa}</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Analysis & Actions (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-5">
            {/* Counselor Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900 mb-1">
                Thao tác Cố vấn
              </h3>
              <p className="font-['Inter'] text-xs text-slate-500 mb-4 leading-relaxed">
                Đánh giá hồ sơ hiện tại so với tiêu chuẩn ngành và vị trí ứng tuyển mục tiêu.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(true)}
                  className="w-full h-10 px-4 rounded-xl bg-white border border-slate-300 text-slate-800 font-['Inter'] text-xs font-semibold hover:bg-slate-50 hover:border-[#006948] hover:text-[#006948] transition-all flex justify-center items-center gap-2 shadow-2xs"
                >
                  <Edit3 className="w-4 h-4 text-slate-500" />
                  <span>Yêu cầu chỉnh sửa / Giao task</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="w-full h-10 px-4 rounded-xl bg-[#006948] text-white font-['Inter'] text-xs font-bold hover:bg-[#047857] transition-all flex justify-center items-center gap-2 shadow-xs"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Xác nhận hồ sơ (Endorse)</span>
                </button>
              </div>
            </div>

            {/* Skill Analysis Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex-1">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#006948]" />
                  <span>Phân tích Kỹ năng &amp; Độ khớp</span>
                </h3>
                <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#006948] font-['Inter'] text-xs font-extrabold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{student.matchRate}% Match</span>
                </div>
              </div>

              <div className="space-y-4 font-['Inter']">
                {/* Hard Skills */}
                <div>
                  <span className="font-['Inter'] text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-2">
                    Kỹ năng Chuyên môn (Hard Skills)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#006948] text-xs font-semibold border border-emerald-200/60">ReactJS</span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#006948] text-xs font-semibold border border-emerald-200/60">TypeScript</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">Node.js (Cơ bản)</span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#006948] text-xs font-semibold border border-emerald-200/60">HTML/CSS</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">Figma</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    Nền tảng Frontend vững chắc. Cần bổ sung thêm kỹ năng Backend để nâng cao năng lực cạnh tranh.
                  </p>
                </div>

                {/* Soft Skills */}
                <div>
                  <span className="font-['Inter'] text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-2">
                    Kỹ năng Mềm (Soft Skills)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">Làm việc nhóm</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">Giải quyết vấn đề</span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200/60 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Giao tiếp tiếng Anh
                    </span>
                  </div>
                </div>

                {/* Suggestions Box */}
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/70">
                  <h4 className="font-['Inter'] text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>Đề xuất từ Cố vấn AI</span>
                  </h4>
                  <ul className="list-disc list-inside text-xs text-amber-900/80 space-y-1">
                    <li>Bổ sung liên kết GitHub / Live Demo vào dự án tiêu biểu.</li>
                    <li>Định lượng kết quả công việc (Ví dụ: Tối ưu tải trang 25%).</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── TAB 2: OVERVIEW TAB (RETAINS EXISTING RICH CONTENT) ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans'] mb-4">
                Chỉ số Năng lực &amp; Mức độ Sẵn sàng
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Điểm STAR</span>
                  <div className="text-2xl font-extrabold text-[#006948] mt-1">{student.starScore}/100</div>
                  <p className="text-xs text-[#006948] font-medium mt-1">Đạt chuẩn tuyển dụng</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Độ khớp mục tiêu</span>
                  <div className="text-2xl font-extrabold text-[#006948] mt-1">{student.matchRate}%</div>
                  <p className="text-xs text-slate-600 font-medium mt-1">{student.targetRole}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Nhiệm vụ cải thiện</span>
                  <div className="text-2xl font-extrabold text-amber-600 mt-1">{tasks.filter(t => t.status === 'pending').length}</div>
                  <p className="text-xs text-amber-700 font-medium mt-1">Cần hoàn thành</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {/* Counselor Direct Feedback Form */}
            <form id="counselor-feedback-form" onSubmit={handleFeedbackSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Gửi nhận xét trực tiếp</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Loại phản hồi</label>
                <select
                  id="counselor-feedback-kind"
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-['Inter']"
                >
                  <option value="comment">Nhận xét định hướng chung</option>
                  <option value="cv_request">Yêu cầu hoàn thiện CV</option>
                  <option value="interview_prep">Lưu ý trước phỏng vấn</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nội dung phản hồi</label>
                <textarea
                  id="counselor-feedback-content"
                  rows={3}
                  placeholder="Nhập ghi chú hoặc nhắc nhở cho sinh viên..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-['Inter'] focus:outline-none focus:border-[#006948]"
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full h-10 bg-[#006948] text-white rounded-xl text-xs font-bold hover:bg-[#047857] transition-colors flex items-center justify-center shadow-xs"
              >
                Gửi phản hồi cho sinh viên
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── OTHER TABS (INTERVIEW, IMPROVEMENT, APPLICATIONS, INTERNSHIP) ── */}
      {activeTab === 'interview' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center space-y-3">
          <Calendar className="w-10 h-10 text-[#006948] mx-auto" />
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900">
            Lịch phỏng vấn của sinh viên
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sinh viên đang được lên lịch cho vòng phỏng vấn sơ tuyển kỹ thuật với FPT Software.
          </p>
        </div>
      )}

      {activeTab === 'improvement' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900">
              Kế hoạch cải thiện năng lực ({tasks.length})
            </h3>
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="px-3 py-1.5 bg-[#006948] text-white rounded-lg text-xs font-semibold hover:bg-[#047857] transition-colors"
            >
              + Thêm nhiệm vụ mới
            </button>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-start">
                <div>
                  <h4 className="font-['Inter'] text-sm font-bold text-slate-900">{task.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{task.description}</p>
                  <p className="text-[11px] text-amber-700 font-medium mt-2">Hạn hoàn thành: {task.dueDate}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                  Đang thực hiện
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center space-y-3">
          <Briefcase className="w-10 h-10 text-[#006948] mx-auto" />
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900">
            Lịch sử ứng tuyển
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hồ sơ sinh viên đã gửi tới các vị trí Frontend Intern và ReactJS Developer.
          </p>
        </div>
      )}

      {activeTab === 'internship' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center space-y-3">
          <GraduationCap className="w-10 h-10 text-[#006948] mx-auto" />
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900">
            Theo dõi thực tập doanh nghiệp
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sinh viên đang trong quá trình chuẩn bị hồ sơ ứng tuyển chương trình thực tập kỳ Fall 2026.
          </p>
        </div>
      )}

      {/* ── MODALS ── */}
      <CounselorConfirmProfileModal
        isOpen={isConfirmModalOpen}
        studentName={student.name}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmProfile}
      />

      <CounselorTaskModal
        isOpen={isTaskModalOpen}
        studentName={student.name}
        studentId={student.id}
        onClose={() => setIsTaskModalOpen(false)}
        onAssignTask={handleAssignTask}
      />

      <CounselorReferralModal
        isOpen={isReferralModalOpen}
        preSelectedStudent={{
          id: student.id,
          name: student.name,
          major: student.major,
          starScore: student.starScore,
          matchRate: 90,
        }}
        onClose={() => setIsReferralModalOpen(false)}
        onSubmitReferral={async (refData) => {
          try {
            await CounselorApi.createReferral({
              student_id: refData.studentId,
              jd_id: refData.jdId,
              notes: refData.note,
            });
            setIsReferralModalOpen(false);
            showToast(`Đã gửi hồ sơ tiến cử ${student.name} tới doanh nghiệp!`, 'success');
            onNavigate('referrals');
          } catch {
            showToast('Không thể tạo đề xuất tiến cử.', 'error');
            throw new Error('Referral creation failed');
          }
        }}
      />
    </div>
  );
}
