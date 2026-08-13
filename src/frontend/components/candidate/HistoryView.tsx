/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X, History, FileCheck, Award
} from 'lucide-react';

export default function HistoryView(props: any) {
  return (
    <>
      <section className="app-view buddy-landing" id="view-history">
        <div className="buddy-hero-shell" style={{ display: 'block', padding: '40px 0', minHeight: 'auto' }}>
          
          <div className="buddy-section-heading" style={{ marginBottom: 32 }}>
            <div>
              <span className="buddy-kicker" style={{ marginBottom: 8 }}><History size={15} /> Lịch sử hoạt động</span>
              <h2 id="buddy-journey-title">Kho lưu trữ nhiệm vụ.</h2>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#607184', fontWeight: 600 }}>Xem lại kết quả phân tích & phỏng vấn</span>
            </div>
          </div>

          <div className="buddy-template-card" style={{ padding: '32px', background: '#fff', borderRadius: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <button className="buddy-primary-button" data-filter="all" style={{ padding: '0 20px', height: '40px', fontSize: '13px' }}>Tất cả</button>
              <button className="buddy-text-button" data-filter="cv" style={{ padding: '0 20px', height: '40px', fontSize: '13px', background: '#f8faf9', border: '1px solid #dcece5' }}>
                <FileText size={16} /> Phân tích CV
              </button>
              <button className="buddy-text-button" data-filter="interview" style={{ padding: '0 20px', height: '40px', fontSize: '13px', background: '#f8faf9', border: '1px solid #dcece5' }}>
                <Mic size={16} /> Phỏng vấn STAR
              </button>
              <button className="buddy-text-button" data-filter="gap" style={{ padding: '0 20px', height: '40px', fontSize: '13px', background: '#f8faf9', border: '1px solid #dcece5' }}>
                <Target size={16} /> Gap Analysis
              </button>
            </div>

            <div id="archive-timeline-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Card 1 */}
              <div style={{ padding: '24px', background: '#fbfcfc', borderRadius: '16px', border: '1px solid #dcece5', display: 'flex', flexDirection: 'column', gap: '16px' }} data-type="cv">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '4px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><FileCheck size={14}/> CV SCANNER</span>
                  <span style={{ fontSize: '12px', color: '#7d8a90' }}>Hôm nay, 09:30</span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--buddy-navy)' }}>CV Software Engineer 2026</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#607184', lineHeight: 1.5 }}>Trích xuất 14 Hard Skills • Đạt chuẩn ATS</p>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e1e8e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--buddy-emerald)' }}>SUCCESS // PARSED</span>
                  <button id="btn-archive-view-cv" style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Xem Chi Tiết ➔</button>
                </div>
              </div>

              {/* Card 2 */}
              <div style={{ padding: '24px', background: '#fbfcfc', borderRadius: '16px', border: '1px solid #dcece5', display: 'flex', flexDirection: 'column', gap: '16px' }} data-type="interview">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', background: '#f3ebf8', padding: '4px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><Mic size={14}/> STAR INTERVIEW</span>
                  <span style={{ fontSize: '12px', color: '#7d8a90' }}>Hôm qua, 15:45</span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--buddy-navy)' }}>Phiên Phỏng Vấn AI Engineer</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#607184', lineHeight: 1.5 }}>Chấm điểm Rubric STAR: 85/100 • 5/5 Câu hỏi hoàn thành</p>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e1e8e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--buddy-emerald)' }}>PASSED // 85 PTS</span>
                  <button id="btn-archive-view-interview" style={{ background: 'none', border: 'none', color: '#8b5cf6', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Xem Báo Cáo ➔</button>
                </div>
              </div>

              {/* Card 3 */}
              <div style={{ padding: '24px', background: '#fbfcfc', borderRadius: '16px', border: '1px solid #dcece5', display: 'flex', flexDirection: 'column', gap: '16px' }} data-type="gap">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--buddy-emerald)', background: '#e6f3eb', padding: '4px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><Target size={14}/> GAP MATCH</span>
                  <span style={{ fontSize: '12px', color: '#7d8a90' }}>05/08/2026</span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--buddy-navy)' }}>CV vs Senior Fullstack JD</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#607184', lineHeight: 1.5 }}>Tỷ lệ phù hợp: 92% • Thiếu 2 kỹ năng nâng cao (Docker, K8s)</p>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e1e8e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--buddy-emerald)' }}>MATCH RATE: 92%</span>
                  <button id="btn-archive-view-gap" style={{ background: 'none', border: 'none', color: 'var(--buddy-emerald)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Xem Lộ Trình ➔</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </>
  );
}
