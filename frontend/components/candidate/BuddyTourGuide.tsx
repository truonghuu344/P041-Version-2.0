'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronRight, X } from 'lucide-react';

const steps = [
  { targetId: 'intent-card-match', title: 'Match CV', content: 'Chọn CV và công việc để xem mức độ phù hợp và gợi ý cải thiện.' },
  { targetId: 'intent-card-cv', title: 'Tạo hoặc cập nhật CV', content: 'Bắt đầu từ mẫu có sẵn hoặc tải CV hiện có lên hệ thống.' },
  { targetId: 'intent-card-interview', title: 'Luyện phỏng vấn', content: 'Thực hành trả lời bằng giọng nói và nhận phản hồi theo phương pháp STAR.' },
];

export default function BuddyTourGuide() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 16, left: 16 });

  const close = () => { localStorage.setItem('cv-assistant-tour-seen', '1'); setVisible(false); };
  useEffect(() => {
    setVisible(localStorage.getItem('cv-assistant-tour-seen') !== '1');
    const onRestart = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener('cv-assistant-restart-tour', onRestart);
    return () => window.removeEventListener('cv-assistant-restart-tour', onRestart);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const target = document.getElementById(steps[step].targetId);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const isCompact = window.innerWidth < 700;
      setPosition({ top: Math.min(window.innerHeight - 190, Math.max(12, isCompact ? rect.top + 12 : rect.top + 18)), left: Math.min(window.innerWidth - 310, Math.max(12, isCompact ? 12 : rect.right + 16)) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step, visible]);
  if (!visible) return null;
  const current = steps[step];
  return <aside className="buddy-tour" style={position} aria-live="polite">
    <div className="buddy-tour-mascot"><Image src="/images/buddy1.png" alt="Career Buddy" width={44} height={44} /></div>
    <div className="buddy-tour-card"><button type="button" className="buddy-tour-close" onClick={close} aria-label="Đóng hướng dẫn"><X size={15} /></button><h3>{current.title}</h3><p>{current.content}</p><footer><span>{step + 1} / {steps.length}</span><button type="button" onClick={() => step === steps.length - 1 ? close() : setStep(step + 1)}>{step === steps.length - 1 ? 'Hoàn thành' : 'Tiếp tục'} <ChevronRight size={14} /></button></footer></div>
  </aside>;
}
