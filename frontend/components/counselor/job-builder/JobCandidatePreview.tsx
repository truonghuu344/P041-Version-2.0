/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  MapPin,
  Briefcase,
  DollarSign,
  Calendar,
  Building,
  CheckCircle2,
  Bookmark,
  Send,
  HelpCircle,
  Users,
  Banknote,
  Sparkles,
} from 'lucide-react';

import { JobSectionData } from './JobSectionBlock';

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: 'text' | 'yes_no' | 'number';
  required: boolean;
}

interface Props {
  title: string;
  department: string;
  level: string;
  employmentType: string;
  workModel: string;
  locationCity: string;
  address: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryVisibility: string;
  deadline: string;
  quantity?: string;
  tags: string[];
  sections: JobSectionData[];
  questions: ScreeningQuestion[];
  imageUrl?: string;
  companyName?: string;
}

export default function JobCandidatePreview({
  title,
  employmentType,
  workModel,
  locationCity,
  address,
  salaryMin,
  salaryMax,
  salaryCurrency,
  salaryVisibility,
  deadline,
  quantity,
  tags,
  sections,
  questions,
  imageUrl,
  companyName,
}: Props) {
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');

  const formattedSalary = salaryVisibility === 'Công khai' && (salaryMin || salaryMax)
    ? `${salaryMin ? salaryMin + ' ' : ''}${salaryMax ? '- ' + salaryMax + ' ' : ''}${salaryCurrency}/tháng`
    : 'Thỏa thuận khi phỏng vấn';

  return (
    <div className="space-y-4" data-testid="job-candidate-preview">
      {/* Device Switcher Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <CheckCircle2 size={16} className="text-[#006948]" />
          <span>Giao diện ứng viên sẽ nhìn thấy (WYSIWYG Candidate View)</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceView === 'desktop' ? 'bg-white text-[#006948] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setDeviceView('desktop')}
          >
            <Monitor size={14} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceView === 'mobile' ? 'bg-white text-[#006948] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setDeviceView('mobile')}
          >
            <Smartphone size={14} />
            <span>Mobile Phone</span>
          </button>
        </div>
      </div>

      {/* Simulator Frame */}
      <div className={`mx-auto transition-all ${deviceView === 'mobile' ? 'max-w-md' : 'w-full'}`}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Cover / Banner image if provided */}
          {imageUrl && (
            <div className="w-full h-44 sm:h-52 overflow-hidden relative">
              <img src={imageUrl} alt="Job Banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          )}

          {/* Top Job Banner */}
          <div className="p-6 md:p-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200/70 text-[#006948] text-xs font-bold">
              <Building size={14} />
              <span>{companyName || 'Doanh nghiệp đối tác'}</span>
            </div>

            <h1 className="font-['Plus_Jakarta_Sans'] text-xl md:text-2xl font-bold text-slate-900 leading-tight">
              {title || 'Tiêu đề vị trí tuyển dụng'}
            </h1>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <MapPin size={15} className="text-slate-400 shrink-0" />
                <span className="truncate">{locationCity} {address ? `(${address})` : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <Briefcase size={15} className="text-slate-400 shrink-0" />
                <span>{employmentType} · {workModel}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <Users size={15} className="text-slate-400 shrink-0" />
                <span>Chỉ tiêu: <strong className="text-slate-900 font-bold">{quantity ? `${quantity} người` : '1 người'}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/70 col-span-2 sm:col-span-1">
                <Banknote size={15} className="text-[#006948] shrink-0" />
                <span className="font-bold text-[#006948] truncate">{formattedSalary}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2 sm:col-span-2">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <span>Hạn nộp hồ sơ: <strong className="text-slate-900 font-semibold">{deadline || '30/09/2026'}</strong></span>
              </div>
            </div>

            {/* Tags / Skills */}
            {tags && tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {tags.map((t) => (
                  <span key={t} className="px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-lg text-xs font-semibold text-[#006948]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Structured Rich Sections */}
          <div className="p-6 md:p-8 space-y-6">
            {sections.map((sec) => {
              if (!sec.content || sec.content === '<p><br></p>') return null;
              return (
                <section key={sec.id} className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#006948]">
                    {sec.title}
                  </h2>
                  <div
                    className="text-sm text-slate-700 leading-relaxed space-y-2"
                    dangerouslySetInnerHTML={{ __html: sec.content }}
                  />
                </section>
              );
            })}
          </div>

          {/* Screening Questions Preview */}
          {questions && questions.length > 0 && (
            <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <HelpCircle size={15} className="text-[#006948]" />
                <span>Câu hỏi khảo sát khi ứng tuyển ({questions.length} câu)</span>
              </h3>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-900">
                      <strong>Câu {i + 1}:</strong> {q.question}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    <input
                      type="text"
                      className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500"
                      placeholder="Câu trả lời của ứng viên..."
                      disabled
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
