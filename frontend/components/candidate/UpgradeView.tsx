/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Check, X, Zap } from 'lucide-react';

export default function UpgradeView(props: any) {
  return (
    <section className="app-view buddy-landing" id="view-upgrade">
      <div
        className="buddy-hero-shell"
        style={{ display: 'block', padding: '60px 0 80px', minHeight: 'auto', textAlign: 'center' }}
      >
        <div style={{ maxWidth: '600px', margin: '0 auto 48px' }}>
          <span className="buddy-kicker" style={{ justifyContent: 'center', marginBottom: 12 }}>
            <Zap size={15} /> Nâng cấp sức mạnh AI
          </span>
          <h2 id="buddy-journey-title" style={{ fontSize: '36px', marginBottom: '16px' }}>
            Các Gói Dịch Vụ & Nâng Cấp
          </h2>
          <p style={{ fontSize: '16px', color: '#607184', margin: 0, lineHeight: 1.6 }}>
            Lựa chọn gói phù hợp để làm chủ hành trình chinh phục mọi nhà tuyển dụng cùng Career
            Buddy.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
            textAlign: 'left',
          }}
        >
          {/* Basic Plan */}
          <div
            className="buddy-template-card"
            style={{
              padding: '32px',
              background: '#fff',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--buddy-navy)', margin: '0 0 8px' }}>
                Gói Cơ Bản
              </h3>
              <p style={{ fontSize: '14px', color: '#607184', margin: 0, minHeight: '40px' }}>
                Trải nghiệm các tính năng cốt lõi cho ứng viên mới bắt đầu
              </p>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--buddy-navy)' }}>
                0đ
              </span>
              <span
                style={{ fontSize: '14px', color: '#7d8a90', fontWeight: 600, marginLeft: '8px' }}
              >
                / Trọn đời
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Tối ưu 3
                CV cơ bản
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Luyện
                phỏng vấn STAR 5 lượt/tháng
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Tra cứu
                Thư viện JD mẫu hệ thống
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: '#a0aab2',
                }}
              >
                <X size={18} color="#dcece5" style={{ flexShrink: 0 }} /> Anti-Hallucination chuyên
                sâu
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: '#a0aab2',
                }}
              >
                <X size={18} color="#dcece5" style={{ flexShrink: 0 }} /> Tạo Custom Job Description
              </li>
            </ul>
            <button
              id="btn-plan-basic"
              className="buddy-text-button"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: '#f8faf9',
                border: '1px solid #dcece5',
              }}
            >
              Bắt Đầu Miễn Phí
            </button>
          </div>

          {/* Pro Plan (Highlighted) */}
          <div
            className="buddy-template-card"
            style={{
              padding: '36px 32px 32px',
              background: '#fff',
              borderRadius: '24px',
              border: '2px solid var(--buddy-emerald)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(45,140,111,0.1)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-14px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--buddy-orange)',
                color: '#fff',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              🔥 PHỔ BIẾN NHẤT
            </div>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--buddy-navy)', margin: '0 0 8px' }}>
                Gói Pro Copilot
              </h3>
              <p style={{ fontSize: '14px', color: '#607184', margin: 0, minHeight: '40px' }}>
                Tăng 300% cơ hội nhận Offer với sự trợ giúp toàn diện của AI
              </p>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--buddy-emerald)' }}>
                199k
              </span>
              <span
                style={{ fontSize: '14px', color: '#7d8a90', fontWeight: 600, marginLeft: '8px' }}
              >
                / Tháng
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                  fontWeight: 600,
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Không
                giới hạn tối ưu CV theo JD
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                  fontWeight: 600,
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Luyện
                phỏng vấn STAR AI toàn diện & gợi mở follow-up
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Thuật
                toán Anti-Hallucination bảo toàn 100% độ thật
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Phân tích
                Gap Analysis & Đề xuất từ khóa ATS
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="var(--buddy-emerald)" style={{ flexShrink: 0 }} /> Xuất báo
                cáo đánh giá kỹ năng phỏng vấn PDF
              </li>
            </ul>
            <button
              id="btn-plan-pro"
              className="buddy-primary-button"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Nâng Cấp Pro Ngay
            </button>
          </div>

          {/* Enterprise Plan */}
          <div
            className="buddy-template-card"
            style={{
              padding: '32px',
              background: '#fff',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--buddy-navy)', margin: '0 0 8px' }}>
                Gói Enterprise / Mentor
              </h3>
              <p style={{ fontSize: '14px', color: '#607184', margin: 0, minHeight: '40px' }}>
                Giải pháp chuyên sâu cho HR & Chuyên gia Hướng nghiệp
              </p>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--buddy-navy)' }}>
                499k
              </span>
              <span
                style={{ fontSize: '14px', color: '#7d8a90', fontWeight: 600, marginLeft: '8px' }}
              >
                / Tháng
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                  fontWeight: 600,
                }}
              >
                <Check size={18} color="#8b5cf6" style={{ flexShrink: 0 }} /> Tất cả đặc quyền của
                Gói Pro
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                  fontWeight: 600,
                }}
              >
                <Check size={18} color="#8b5cf6" style={{ flexShrink: 0 }} /> Tạo Custom Job
                Description không giới hạn
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="#8b5cf6" style={{ flexShrink: 0 }} /> Thiết lập bộ Rubric
                STAR phỏng vấn riêng
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="#8b5cf6" style={{ flexShrink: 0 }} /> Quản lý kho ứng viên &
                Phân tích khớp hồ sơ hàng loạt
              </li>
              <li
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '14px',
                  color: 'var(--buddy-navy)',
                }}
              >
                <Check size={18} color="#8b5cf6" style={{ flexShrink: 0 }} /> Hỗ trợ kỹ thuật 24/7 &
                API Integration
              </li>
            </ul>
            <button
              id="btn-plan-enterprise"
              className="buddy-text-button"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: '#f3ebf8',
                color: '#8b5cf6',
                border: 'none',
              }}
            >
              Liên Hệ Tư Vấn Enterprise
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
