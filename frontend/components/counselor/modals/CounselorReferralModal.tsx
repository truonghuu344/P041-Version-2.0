/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useEffect, useState } from 'react';
import { Send, AlertCircle, X, CheckCircle2, Building2, User } from 'lucide-react';
import { CounselorApi, OpportunityItem } from '@/lib/api/counselorApi';

interface StudentOption {
  id: string;
  name: string;
  major: string;
  starScore?: number;
  matchRate?: number;
}

interface CounselorReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetJob?: string;
  targetCompany?: string;
  preSelectedStudent?: StudentOption | null;
  studentsList?: StudentOption[];
  onSubmitReferral: (data: {
    studentId: string;
    jdId: string;
    targetJob: string;
    targetCompany: string;
    note: string;
  }) => Promise<void> | void;
}

export default function CounselorReferralModal({
  isOpen,
  onClose,
  targetJob = 'Frontend Developer Intern',
  targetCompany = 'FPT Software',
  preSelectedStudent,
  studentsList = [
    { id: 'sv01', name: 'Nguyễn Văn A', major: 'Kỹ thuật Phần mềm (K18)', starScore: 84, matchRate: 88 },
    { id: 'sv02', name: 'Trần Thị Bích', major: 'Khoa học Dữ liệu (K18)', starScore: 92, matchRate: 95 },
    { id: 'sv03', name: 'Lê Hoàng Nam', major: 'An toàn Thông tin (K19)', starScore: 76, matchRate: 72 },
    { id: 'sv04', name: 'Phạm Minh Đức', major: 'Kỹ thuật Phần mềm (K18)', starScore: 89, matchRate: 91 },
  ],
  onSubmitReferral,
}: CounselorReferralModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState(preSelectedStudent?.id || '');
  const [jobTitle, setJobTitle] = useState(targetJob);
  const [company, setCompany] = useState(targetCompany);
  const [availableJobs, setAvailableJobs] = useState<OpportunityItem[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [counselorNote, setCounselorNote] = useState(
    'Sinh viên có nền tảng vững chắc, đã hoàn thành thẩm định CV đạt chuẩn và thể hiện tốt trong kỳ phỏng vấn thử STAR.'
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void CounselorApi.getOpportunities({ tab: 'jobs' }).then((items) => {
      if (!active) return;
      setAvailableJobs(items);
      const first = items[0];
      if (first) {
        setSelectedJobId(first.id);
        setJobTitle(first.position);
        setCompany(first.company);
      }
    }).catch(() => active && setAvailableJobs([]));
    if (!preSelectedStudent) {
      void CounselorApi.getStudents({ page: 1, page_size: 100 }).then((result) => {
        if (!active) return;
        const students = result.items.map((item) => ({
          id: item.id,
          name: item.name,
          major: item.major,
          matchRate: item.matchRate,
        }));
        setAvailableStudents(students);
        if (students[0]) setSelectedStudentId(students[0].id);
      }).catch(() => active && setAvailableStudents([]));
    }
    return () => { active = false; };
  }, [isOpen, preSelectedStudent]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !selectedStudentId) return;
    await onSubmitReferral({
      studentId: selectedStudentId,
      jdId: selectedJobId,
      targetJob: jobTitle,
      targetCompany: company,
      note: counselorNote,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-lg w-full p-5 border border-[#E2E8F0] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="referral-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2 text-[#006948]">
            <Send size={22} />
            <h3 id="referral-modal-title" className="text-lg font-bold text-[#0F172A] font-headline">
              Tạo Đề Xuất Tiến Cử 3 Bên
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Job & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5 flex items-center gap-1">
                <Building2 size={13} className="text-[#006948]" />
                Doanh nghiệp
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs bg-[#F8FAFC] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Vị trí tuyển dụng
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs bg-[#F8FAFC] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              JD hệ thống <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => {
                const job = availableJobs.find((item) => item.id === e.target.value);
                setSelectedJobId(e.target.value);
                if (job) {
                  setJobTitle(job.position);
                  setCompany(job.company);
                }
              }}
              required
              disabled={!availableJobs.length}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs bg-white text-[#0F172A] focus:border-[#006948] focus:outline-none focus:ring-2 focus:ring-[#006948]/20"
            >
              {availableJobs.length ? availableJobs.map((job) => (
                <option key={job.id} value={job.id}>{job.position} — {job.company}</option>
              )) : <option value="">Chưa có JD khả dụng</option>}
            </select>
          </div>

          {/* Student Select */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5 flex items-center gap-1">
              <User size={13} className="text-[#006948]" />
              Chọn Sinh viên tiến cử <span className="text-[#EF4444]">*</span>
            </label>
            {preSelectedStudent ? (
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A]">{preSelectedStudent.name}</h4>
                  <p className="text-xs text-[#64748B]">{preSelectedStudent.major}</p>
                </div>
                {preSelectedStudent.starScore && (
                  <span className="text-xs font-bold text-[#006948]">
                    STAR: {preSelectedStudent.starScore}%
                  </span>
                )}
              </div>
            ) : (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!availableStudents.length}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs bg-white text-[#0F172A] focus:border-[#006948] focus:outline-none focus:ring-2 focus:ring-[#006948]/20"
              >
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.major} {s.starScore ? `(STAR: ${s.starScore}%)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Counselor Note */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Ghi chú bảo chứng của Cố vấn <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={counselorNote}
              onChange={(e) => setCounselorNote(e.target.value)}
              placeholder="Nhập nhận xét chuyên môn và lý do tiến cử..."
              className="w-full p-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
          </div>

          {/* Consent Notice */}
          <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-start gap-2.5">
            <AlertCircle size={18} className="text-[#D97706] shrink-0 mt-0.5" />
            <p className="text-xs text-[#92400E] leading-relaxed">
              <strong>Quy trình bảo mật:</strong> Hồ sơ sẽ không gửi trực tiếp ngay sang Doanh nghiệp. Hệ thống sẽ gửi thông báo xin xác nhận (Consent) của Sinh viên trước khi chuyển tiếp.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-lg bg-[#006948] text-white text-xs font-semibold hover:bg-[#047857] shadow-xs transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            >
              <Send size={16} />
              Gửi đề xuất tiến cử
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
