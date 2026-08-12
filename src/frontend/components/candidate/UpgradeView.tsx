/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Check, X } from 'lucide-react';

export default function UpgradeView(props: any) {
  return (
    <section className="app-view" id="view-upgrade">
      <div className="section-header center-header" style={{ marginTop: '40px' }}>
        <span className="section-tag" data-i18n="pricing-tag">⚡ NÂNG CẤP SỨC MẠNH AI</span>
        <h2 className="section-title-large" data-i18n="pricing-title">Các Gói Dịch Vụ & Nâng Cấp</h2>
        <p className="section-subtitle" data-i18n="pricing-sub">Lựa chọn gói phù hợp để làm chủ hành trình chinh phục mọi nhà tuyển dụng</p>
      </div>

      <div className="pricing-grid">
        {/* Basic Plan */}
        <div className="pricing-card basic-card">
          <div className="card-badge-placeholder"></div>
          <div className="plan-header">
            <h3 className="plan-title" data-i18n="plan-basic-name">Gói Cơ Bản</h3>
            <p className="plan-desc" data-i18n="plan-basic-desc">Trải nghiệm các tính năng cốt lõi cho ứng viên mới bắt đầu</p>
            <div className="plan-price">
              <span className="price-amount" data-i18n="plan-basic-price">0đ</span>
              <span className="price-period" data-i18n="plan-free-forever">/ Trọn đời</span>
            </div>
          </div>
          <ul className="plan-features">
            <li><Check size={16} className="check-icon" /> <span data-i18n="feat-b1">Tối ưu 3 CV cơ bản</span></li>
            <li><Check size={16} className="check-icon" /> <span data-i18n="feat-b2">Luyện phỏng vấn STAR 5 lượt/tháng</span></li>
            <li><Check size={16} className="check-icon" /> <span data-i18n="feat-b3">Tra cứu Thư viện JD mẫu hệ thống</span></li>
            <li className="dimmed"><X size={16} className="cross-icon" /> <span data-i18n="feat-b4">Anti-Hallucination chuyên sâu</span></li>
            <li className="dimmed"><X size={16} className="cross-icon" /> <span data-i18n="feat-b5">Tạo Custom Job Description</span></li>
          </ul>
          <button className="pricing-btn basic-btn" id="btn-plan-basic" data-i18n="btn-plan-basic">Bắt Đầu Miễn Phí</button>
        </div>

        {/* Pro Plan (Highlighted) */}
        <div className="pricing-card pro-card popular-highlight">
          <div className="popular-badge" data-i18n="badge-popular">🔥 PHỔ BIẾN NHẤT</div>
          <div className="plan-header">
            <h3 className="plan-title pro-title" data-i18n="plan-pro-name">Gói Pro Copilot</h3>
            <p className="plan-desc" data-i18n="plan-pro-desc">Tăng 300% cơ hội nhận Offer với sự trợ giúp toàn diện của AI Agent</p>
            <div className="plan-price">
              <span className="price-amount pro-price" data-i18n="plan-pro-price">199.000đ</span>
              <span className="price-period" data-i18n="plan-period-month">/ Tháng</span>
            </div>
          </div>
          <ul className="plan-features">
            <li><Check size={16} className="check-icon cyan" /> <strong data-i18n="feat-p1">Không giới hạn tối ưu CV theo JD</strong></li>
            <li><Check size={16} className="check-icon cyan" /> <strong data-i18n="feat-p2">Luyện phỏng vấn STAR AI toàn diện & gợi mở follow-up</strong></li>
            <li><Check size={16} className="check-icon cyan" /> <span data-i18n="feat-p3">Thuật toán Anti-Hallucination bảo toàn 100% độ thật</span></li>
            <li><Check size={16} className="check-icon cyan" /> <span data-i18n="feat-p4">Phân tích Gap Analysis & Đề xuất từ khóa ATS</span></li>
            <li><Check size={16} className="check-icon cyan" /> <span data-i18n="feat-p5">Xuất báo cáo đánh giá kỹ năng phỏng vấn PDF</span></li>
          </ul>
          <button className="pricing-btn pro-btn" id="btn-plan-pro" data-i18n="btn-plan-pro">Nâng Cấp Pro Ngay</button>
        </div>

        {/* Enterprise / Mentor Plan */}
        <div className="pricing-card enterprise-card">
          <div className="card-badge-placeholder"></div>
          <div className="plan-header">
            <h3 className="plan-title" data-i18n="plan-ent-name">Gói Enterprise / Mentor</h3>
            <p className="plan-desc" data-i18n="plan-ent-desc">Giải pháp chuyên sâu cho Nhà tuyển dụng, HR & Chuyên gia Hướng nghiệp</p>
            <div className="plan-price">
              <span className="price-amount" data-i18n="plan-ent-price">499.000đ</span>
              <span className="price-period" data-i18n="plan-period-month">/ Tháng</span>
            </div>
          </div>
          <ul className="plan-features">
            <li><span className="check-icon purple">✓</span> <strong data-i18n="feat-e1">Tất cả đặc quyền của Gói Pro</strong></li>
            <li><span className="check-icon purple">✓</span> <strong data-i18n="feat-e2">Tạo Custom Job Description không giới hạn</strong></li>
            <li><span className="check-icon purple">✓</span> <span data-i18n="feat-e3">Thiết lập bộ Rubric STAR phỏng vấn riêng</span></li>
            <li><span className="check-icon purple">✓</span> <span data-i18n="feat-e4">Quản lý kho ứng viên & Phân tích khớp hồ sơ hàng loạt</span></li>
            <li><span className="check-icon purple">✓</span> <span data-i18n="feat-e5">Hỗ trợ kỹ thuật 24/7 & API Integration</span></li>
          </ul>
          <button className="pricing-btn enterprise-btn" id="btn-plan-enterprise" data-i18n="btn-plan-enterprise">Liên Hệ Tư Vấn Enterprise</button>
        </div>
      </div>

{/* Testimonials moved back to DashboardView */}
    </section>
  );
}
