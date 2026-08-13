/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X, Send, PlayCircle, BarChart3, Star, MessageSquareText
} from 'lucide-react';

export default function InterviewView(props: any) {
  return (
    <>
      <section className="app-view buddy-landing" id="view-interview">
        <div className="buddy-hero-shell" style={{ display: 'block', padding: '40px 0', minHeight: 'auto' }}>
          
          <div className="buddy-section-heading" style={{ marginBottom: 32 }}>
            <div>
              <h2 id="buddy-journey-title">Luyện phỏng vấn bằng giọng nói.</h2>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#607184', fontWeight: 600 }}>Trả lời bằng mic · hệ thống chấm theo transcript</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 2fr)', gap: '24px', alignItems: 'start' }}>
            
            {/* Cột 1: Setup */}
            <div className="buddy-template-card" id="page-interview-setup" style={{ padding: '32px', background: '#fff', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--buddy-navy)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlayCircle color="var(--buddy-emerald)" size={20} />
                  Thiết lập phỏng vấn voice
                </h3>
                <p style={{ fontSize: '14px', color: '#607184', margin: 0 }}>Chọn CV và công việc để chuẩn bị câu hỏi phù hợp, rồi trả lời bằng giọng nói.</p>
                <p style={{ fontSize: '13px', color: '#607184', margin: '8px 0 0' }}>Bạn có thể luyện phỏng vấn ngay; kết quả Match chỉ bổ sung ngữ cảnh khi có.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Chọn CV phỏng vấn *</label>
                  <div className="gap-select-shell" style={{ position: 'relative' }}>
                    <FileText size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#607184' }} />
                    <select id="page-interview-select-cv" className="ship-input gap-select" style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9', appearance: 'none' }}>
                      <option value="">Chọn một CV đã lưu</option>
                    </select>
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#607184' }}>⌄</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Chọn vị trí ứng tuyển *</label>
                  <div className="gap-select-shell" style={{ position: 'relative' }}>
                    <Briefcase size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#607184' }} />
                    <select id="page-interview-select-jd" className="ship-input gap-select" style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9', appearance: 'none' }}>
                      <option value="">Chọn một JD đã lưu</option>
                    </select>
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#607184' }}>⌄</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Chế độ phỏng vấn</label>
                  <select id="interview-mode" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9' }}>
                    <option value="MIXED">Hỗn hợp (Mixed)</option>
                    <option value="TECHNICAL">Chuyên môn (Technical)</option>
                    <option value="BEHAVIORAL">Hành vi (Behavioral)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Thời lượng</label>
                    <select id="interview-duration" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9' }}>
                      <option value="15">15 phút</option>
                      <option value="30" defaultValue="30">30 phút</option>
                      <option value="45">45 phút</option>
                      <option value="60">60 phút</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Ngôn ngữ</label>
                    <select id="interview-language" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9' }}>
                      <option value="FOLLOW_CANDIDATE">Theo ứng viên</option>
                      <option value="VI">Tiếng Việt</option>
                      <option value="EN">Tiếng Anh</option>
                    </select>
                  </div>
                </div>

                <button id="page-btn-start-interview" className="buddy-primary-button" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                  BẮT ĐẦU PHỎNG VẤN VOICE
                </button>
              </div>
            </div>

            {/* Cột 2: Chat Box & Report */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Chat Card */}
              <div className="buddy-template-card" id="page-interview-chat" style={{ padding: '0', background: '#fff', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '600px' /* default none initially? no, keep it block but use JS to toggle later, or just mock it */}}>
                
                <div style={{ padding: '20px 24px', background: '#f8faf9', borderBottom: '1px solid #e1e8e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--buddy-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <Mic size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--buddy-navy)' }}>Career Buddy</h3>
                      <span style={{ fontSize: '12px', color: 'var(--buddy-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--buddy-emerald)', display: 'inline-block' }}></span>
                        Đang phỏng vấn
                      </span>
                    </div>
                  </div>
                  <span id="page-interview-progress-text" style={{ fontSize: '13px', fontWeight: 700, color: '#607184', padding: '6px 12px', background: '#fff', borderRadius: '12px', border: '1px solid #dcece5' }}>
                    Câu hỏi 1 / 5
                  </span>
                </div>

                <div id="page-interview-chat-history" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fbfcfc' }}>
                  {/* Chat messages will be injected here */}
                  <div style={{ textAlign: 'center', color: '#a0aab2', fontSize: '13px', fontStyle: 'italic', margin: 'auto' }}>
                    <MessageSquareText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    Bấm Bắt đầu phỏng vấn ở cột bên trái
                  </div>
                </div>

                <div id="page-interview-stt-indicator" style={{ display: 'none', padding: '8px 24px', background: '#f8faf9', borderTop: '1px solid #e1e8e5', fontSize: '13px', color: '#607184', fontStyle: 'italic' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--buddy-emerald)', display: 'inline-block', marginRight: '8px', animation: 'pulse 1.5s infinite' }}></span>
                  <span id="stt-partial-text">Đang nghe...</span>
                </div>

                <form id="page-interview-answer-form" style={{ padding: '20px 24px', background: '#fff', borderTop: '1px solid #e1e8e5', display: 'flex', gap: '12px' }}>
                  <input type="text" id="page-interview-answer-input" placeholder="Nhập câu trả lời theo mô hình STAR..." required style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9', outline: 'none' }} />
                  <button type="button" id="page-interview-voice" style={{ width: '46px', height: '46px', borderRadius: '12px', border: '1px solid #dcece5', background: '#fff', color: '#607184', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Trả lời bằng giọng nói">
                    <Mic size={20} />
                  </button>
                  <button type="submit" className="buddy-primary-button" style={{ padding: '0 20px' }}>
                    <Send size={18} /> Gửi
                  </button>
                </form>
              </div>

              {/* Report Card (Hidden by default) */}
              <div className="buddy-template-card" id="page-interview-report" style={{ display: 'none', padding: '32px', background: '#fff', borderRadius: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e6f3eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart3 color="var(--buddy-emerald)" size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '18px', color: 'var(--buddy-navy)', margin: 0 }}>Báo Cáo Chấm Điểm Phỏng Vấn</h3>
                    <p style={{ fontSize: '14px', color: '#607184', margin: 0 }}>Đánh giá chi tiết dựa trên phương pháp STAR</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: '#607184', fontWeight: 600, display: 'block', marginBottom: '4px' }}>TỔNG ĐIỂM</span>
                    <span id="page-report-total-score" style={{ fontSize: '28px', color: 'var(--buddy-emerald)', fontWeight: 800, lineHeight: 1 }}>85/100</span>
                  </div>
                </div>

                <div id="page-report-star-breakdown" style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
                  {/* injected star breakdown */}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  <div style={{ padding: '20px', background: '#f4fbf7', borderRadius: '16px', border: '1px solid #e1f0e8' }}>
                    <h5 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--buddy-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={16}/> Điểm Mạnh</h5>
                    <ul id="page-report-strengths-list" style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#607184', display: 'flex', flexDirection: 'column', gap: '8px' }}></ul>
                  </div>
                  <div style={{ padding: '20px', background: '#fff9f5', borderRadius: '16px', border: '1px solid #fbe5d8' }}>
                    <h5 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--buddy-orange)', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{fontWeight: 'bold'}}>!</span> Cần Cải Thiện</h5>
                    <ul id="page-report-improvements-list" style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#607184', display: 'flex', flexDirection: 'column', gap: '8px' }}></ul>
                  </div>
                </div>

                <div style={{ padding: '20px', background: '#f3ebf8', borderRadius: '16px', border: '1px solid #e6d8f2', marginBottom: '32px' }}>
                  <h5 style={{ margin: '0 0 12px', fontSize: '14px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}><Star size={16}/> Lời Khuyên Luyện Tập</h5>
                  <ul id="page-report-recommendations-list" style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#607184', display: 'flex', flexDirection: 'column', gap: '8px' }}></ul>
                </div>

                <div style={{ padding: '24px', background: '#fbfcfc', borderRadius: '16px', border: '1px dashed #dcece5' }}>
                  <h5 style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--buddy-navy)', textAlign: 'center' }}>Đánh giá phiên luyện tập này</h5>
                  <form id="page-interview-csat-form" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select id="page-interview-csat" required style={{ width: '160px', padding: '12px', borderRadius: '12px', border: '1px solid #dcece5', background: '#fff' }}>
                      <option value="">Chọn 1–5 sao</option>
                      <option value="5">5 — Rất hữu ích</option>
                      <option value="4">4 — Hữu ích</option>
                      <option value="3">3 — Bình thường</option>
                      <option value="2">2 — Chưa tốt</option>
                      <option value="1">1 — Không hữu ích</option>
                    </select>
                    <input id="page-interview-csat-comment" placeholder="Góp ý thêm (tùy chọn)" style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #dcece5', background: '#fff' }} />
                    <button type="submit" className="buddy-text-button" style={{ border: '1px solid #dcece5', background: '#fff' }}>Gửi</button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </>
  );
}
