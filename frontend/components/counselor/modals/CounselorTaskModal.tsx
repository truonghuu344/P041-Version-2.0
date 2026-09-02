/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState } from 'react';
import { ClipboardList, Calendar, AlertCircle, X, PlusCircle } from 'lucide-react';

interface CounselorTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentId?: string;
  onAssignTask: (task: {
    title: string;
    description: string;
    dueDate: string;
    notes: string;
    studentId?: string;
  }) => void;
}

export default function CounselorTaskModal({
  isOpen,
  onClose,
  studentName,
  studentId,
  onAssignTask,
}: CounselorTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('2026-08-30');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAssignTask({
      title: title.trim(),
      description: description.trim(),
      dueDate,
      notes: notes.trim(),
      studentId,
    });
    setTitle('');
    setDescription('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-lg w-full p-5 border border-[#E2E8F0] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2 text-[#006948]">
            <ClipboardList size={22} />
            <h3 id="task-modal-title" className="text-lg font-bold text-[#0F172A] font-headline">
              Giao nhiệm vụ cải thiện kỹ năng
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

        <div className="p-3 bg-[#ECFDF5] border border-[#006948]/20 rounded-xl text-xs text-[#065F46]">
          Giao nhiệm vụ định hướng cho sinh viên: <strong>{studentName}</strong>. Sinh viên sẽ nhận thông báo trên bảng điều khiển cá nhân.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Tên nhiệm vụ <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Bổ sung Dockerfile cho dự án Spring Boot"
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Mô tả chi tiết yêu cầu <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cụ thể đầu ra cần đạt được, tài liệu tham khảo hoặc tiêu chí đánh giá..."
              className="w-full p-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5 flex items-center gap-1">
              <Calendar size={14} className="text-[#006948]" />
              Hạn hoàn thành <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
          </div>

          {/* Counselor Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Ghi chú thêm từ Cố vấn
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Cần ưu tiên làm trước buổi phỏng vấn ngày 02/09..."
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
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
              <PlusCircle size={16} />
              Giao nhiệm vụ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
