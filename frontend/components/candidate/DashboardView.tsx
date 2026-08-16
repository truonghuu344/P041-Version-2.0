'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import BuddyTourGuide from './BuddyTourGuide';

function goTo(primaryId: string, fallbackId?: string) {
  const target =
    document.getElementById(primaryId) || (fallbackId ? document.getElementById(fallbackId) : null);
  target?.click();
}

interface StatItem {
  id: string;
  label: string;
  targetValue: number;
  suffix: string;
  decimals?: number;
  description: string;
}

const STATS_DATA: StatItem[] = [
  {
    id: 'stat-cv',
    label: 'CV được tối ưu chuẩn ATS',
    targetValue: 50000,
    suffix: '+',
    description: 'Định dạng chuẩn STAR & ATS quốc tế',
  },
  {
    id: 'stat-satisfaction',
    label: 'Tỷ lệ ứng viên hài lòng',
    targetValue: 98.5,
    suffix: '%',
    decimals: 1,
    description: 'Tự tin vượt qua các vòng sàng lọc hồ sơ',
  },
  {
    id: 'stat-interview',
    label: 'Phiên luyện phỏng vấn Voice AI',
    targetValue: 15000,
    suffix: '+',
    description: 'Tương tác giọng nói tự nhiên thời gian thực',
  },
  {
    id: 'stat-partners',
    label: 'Doanh nghiệp & JD kết nối',
    targetValue: 500,
    suffix: '+',
    description: 'Dữ liệu chuẩn hóa từ các tập đoàn hàng đầu',
  },
];

export default function DashboardView() {
  const [hasScrolledStats, setHasScrolledStats] = useState(false);
  const [counterValues, setCounterValues] = useState<Record<string, number>>({
    'stat-cv': 0,
    'stat-satisfaction': 0,
    'stat-interview': 0,
    'stat-partners': 0,
  });

  const statsRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  // ── Scroll Reveal Intersection Observer ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      {
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.1,
      },
    );

    const revealElements = rootRef.current?.querySelectorAll('[data-reveal]');
    revealElements?.forEach(el => observer.observe(el));

    return () => {
      revealElements?.forEach(el => observer.unobserve(el));
    };
  }, []);

  // ── Stats Counter Auto Count-Up on Scroll ──
  useEffect(() => {
    const currentStatsEl = statsRef.current;
    if (!currentStatsEl) return;

    const statsObserver = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasScrolledStats) {
          setHasScrolledStats(true);

          const durationMs = 1800;
          const startTime = performance.now();

          const animateCounters = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            setCounterValues({
              'stat-cv': Math.floor(easeProgress * 50000),
              'stat-satisfaction': Number((easeProgress * 98.5).toFixed(1)),
              'stat-interview': Math.floor(easeProgress * 15000),
              'stat-partners': Math.floor(easeProgress * 500),
            });

            if (progress < 1) {
              requestAnimationFrame(animateCounters);
            }
          };

          requestAnimationFrame(animateCounters);
        }
      },
      { threshold: 0.2 },
    );

    statsObserver.observe(currentStatsEl);

    return () => {
      statsObserver.unobserve(currentStatsEl);
    };
  }, [hasScrolledStats]);

  return (
    <section
      ref={rootRef}
      className="app-view active dashboard-dashboard home-dashboard"
      id="view-dashboard"
    >
      {/* ── 1. HERO SECTION ── */}
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-inner">
          <div className="home-hero-copy" data-reveal="fade-up">
            <div className="home-hero-badge">
              <Sparkles size={14} />
              <span>Nền tảng AI Career Copilot thế hệ mới</span>
            </div>

            <h1 id="home-title" className="home-hero-title">
              Chuẩn bị tốt hơn
              <br />
              <span>cho công việc bạn muốn.</span>
            </h1>

            <p className="home-hero-description">
              Chọn đúng việc bạn cần: tối ưu CV, kiểm tra mức độ phù hợp với JD, hoặc luyện tập
              trước buổi phỏng vấn.
            </p>

            <div className="home-hero-actions" aria-label="Thao tác nhanh">
              <button
                type="button"
                className="home-btn home-btn-primary"
                onClick={() => goTo('nav-cv')}
              >
                Tối ưu CV <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="home-btn home-btn-secondary"
                onClick={() => goTo('nav-match', 'nav-gap')}
              >
                So khớp CV với JD
              </button>
              <button
                type="button"
                className="home-btn home-btn-secondary"
                onClick={() => goTo('nav-interview')}
              >
                Luyện phỏng vấn voice
              </button>
            </div>

            <div className="home-hero-trust-row">
              <div className="trust-item">
                <span className="trust-dot" /> <span>100% Bằng chứng khách quan</span>
              </div>
              <div className="trust-item">
                <span className="trust-dot" /> <span>Chuẩn ATS &amp; Mô hình STAR</span>
              </div>
              <div className="trust-item">
                <span className="trust-dot" /> <span>Bảo mật dữ liệu ứng viên</span>
              </div>
            </div>
          </div>

          {/* ── Fixed Hero Image Showcase ── */}
          <div
            className="home-hero-visual"
            data-reveal="fade-left"
            aria-label="Minh họa tính năng Career Assistant"
          >
            <div className="home-visual-aura" aria-hidden="true" />
            <div className="home-buddy-stage">
              <Image
                src="/images/image1.png"
                alt="Career Assistant Hero"
                width={1536}
                height={1024}
                quality={100}
                unoptimized
                className="home-buddy-image"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. ANIMATED STATS SECTION ── */}
      <section ref={statsRef} className="home-stats-section" aria-labelledby="stats-title">
        <div className="home-stats-container" data-reveal="fade-up">
          <div className="home-stats-grid">
            {STATS_DATA.map((stat, idx) => {
              const currentValue = counterValues[stat.id] ?? 0;
              const formattedVal = stat.decimals
                ? currentValue.toFixed(stat.decimals)
                : currentValue.toLocaleString('en-US');

              return (
                <div
                  key={stat.id}
                  className="home-stat-card"
                  data-reveal="zoom-in"
                  style={{ transitionDelay: `${idx * 100}ms` }}
                >
                  <div className="home-stat-number">
                    {formattedVal}
                    <span className="home-stat-suffix">{stat.suffix}</span>
                  </div>
                  <h3 className="home-stat-label">{stat.label}</h3>
                  <p className="home-stat-desc">{stat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. BENTO GRID FEATURE SUITE ── */}
      <section className="home-features-suite" aria-labelledby="features-suite-title">
        <div className="features-suite-inner">
          <header className="features-suite-header" data-reveal="fade-up">
            <span className="section-pre-title">TÍNH NĂNG TRỌNG TÂM</span>
            <h2 id="features-suite-title">Bộ Công Cụ AI Đột Phá Cho Ứng Viên</h2>
            <p>Khám phá 3 giải pháp trọng tâm được thiết kế chuyên biệt để nâng tầm sự nghiệp của bạn.</p>
          </header>

          <div className="features-bento-grid">
            {/* Bento Card 1: Tối ưu CV */}
            <article
              className="bento-card bento-card-cv"
              data-reveal="fade-up"
              onClick={() => goTo('nav-cv')}
              role="button"
              tabIndex={0}
            >
              <div className="bento-card-header">
                <span className="bento-badge badge-emerald">ATS Tier-1 Ready</span>
              </div>
              <div className="bento-card-body">
                <h3>Tạo &amp; Tối Ưu CV Chuẩn STAR</h3>
                <p>
                  Chuyển hóa từng dòng mô tả thành câu thành tích định lượng theo mô hình STAR, tối ưu
                  từ khóa ngành nghề giúp CV nổi bật trước hệ thống ATS.
                </p>
                <div className="bento-cv-preview-box">
                  <div className="preview-diff-line before">
                    <span className="diff-marker">Gốc:</span>
                    <em>Tham gia phát triển hệ thống backend và xử lý dữ liệu người dùng.</em>
                  </div>
                  <div className="preview-diff-line after">
                    <span className="diff-marker">✦ AI STAR:</span>
                    <strong>Tối ưu hóa kiến trúc Backend microservices, nâng cao 40% throughput và giảm 25% độ trễ API.</strong>
                  </div>
                </div>
              </div>
              <div className="bento-card-footer">
                <span className="bento-cta-link">
                  Bắt đầu tối ưu CV <ArrowRight size={16} />
                </span>
              </div>
            </article>

            {/* Bento Card 2: So khớp CV với JD */}
            <article
              className="bento-card bento-card-match"
              data-reveal="fade-up"
              style={{ transitionDelay: '120ms' }}
              onClick={() => goTo('nav-match', 'nav-gap')}
              role="button"
              tabIndex={0}
            >
              <div className="bento-card-header">
                <span className="bento-badge badge-purple">Khuyên dùng</span>
              </div>
              <div className="bento-card-body">
                <h3>So Khớp CV &amp; Gap Analysis</h3>
                <p>
                  Đối chiếu chi tiết 100% yêu cầu JD, phát hiện chính xác lỗ hổng kỹ năng còn thiếu và nhận kế hoạch hành động P1–P3 tức thì.
                </p>
                <div className="bento-match-score-widget">
                  <div className="mini-score-ring">
                    <span className="mini-score-val">88%</span>
                    <small>Độ phù hợp</small>
                  </div>
                  <div className="mini-skills-tags">
                    <span className="mini-tag matched">✓ React / Node.js</span>
                    <span className="mini-tag matched">✓ PostgreSQL</span>
                    <span className="mini-tag gap">! Cần thêm Docker</span>
                  </div>
                </div>
              </div>
              <div className="bento-card-footer">
                <span className="bento-cta-link">
                  Phân tích khoảng cách JD <ArrowRight size={16} />
                </span>
              </div>
            </article>

            {/* Bento Card 3: Luyện phỏng vấn Voice AI */}
            <article
              className="bento-card bento-card-voice"
              data-reveal="fade-up"
              style={{ transitionDelay: '240ms' }}
              onClick={() => goTo('nav-interview')}
              role="button"
              tabIndex={0}
            >
              <div className="bento-card-header">
                <span className="bento-badge badge-teal">Real-time Voice AI</span>
              </div>
              <div className="bento-card-body">
                <h3>Luyện Phỏng Vấn Giọng Nói 1-1</h3>
                <p>
                  Thực hành tương tác trực tiếp bằng giọng nói với AI Coach. Nhận báo cáo phân tích độ tự tin, cấu trúc ý tưởng và phản xạ chuyên môn.
                </p>
                <div className="bento-voice-wave-widget">
                  <div className="voice-wave-bars">
                    <span className="bar bar-1" />
                    <span className="bar bar-2" />
                    <span className="bar bar-3" />
                    <span className="bar bar-4" />
                    <span className="bar bar-5" />
                    <span className="bar bar-6" />
                    <span className="bar bar-7" />
                    <span className="bar bar-8" />
                  </div>
                  <span className="voice-wave-status">AI Coach đang lắng nghe và phân tích...</span>
                </div>
              </div>
              <div className="bento-card-footer">
                <span className="bento-cta-link">
                  Vào phòng phỏng vấn thử <ArrowRight size={16} />
                </span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── 4. ABOUT US (Clean Split Column & Colored Matrix) ── */}
      <section className="home-about-showcase" aria-labelledby="about-showcase-title">
        <div className="about-showcase-inner">
          <div className="about-story-col" data-reveal="fade-right">
            <span className="section-pre-title">VỀ CHÚNG TÔI · CAREER ASSISTANT</span>
            <h2 id="about-showcase-title">
              Nâng Tầm Sự Nghiệp Với Trợ Lý AI Đa Tác Tử Tiên Phong
            </h2>
            <p className="about-story-p">
              Career Assistant ra đời với sứ mệnh xóa bỏ rào cản ứng tuyển cho sinh viên và người tìm
              việc tại Việt Nam. Chúng tôi kết hợp sức mạnh của hệ thống AI Đa Tác Tử (Multi-Agent) và
              chuẩn đánh giá tuyển dụng quốc tế, đem đến giải pháp chuẩn bị sự nghiệp khách quan, thực
              chiến và chính xác nhất.
            </p>

            <div className="about-highlights-list">
              <div className="highlight-item">
                <span className="highlight-bullet" />
                <div>
                  <strong>Triệt tiêu ảo giác thông tin (Zero Hallucination)</strong>
                  <span>Mọi điểm số và lời khuyên đều gắn liền với bằng chứng xác thực trong CV.</span>
                </div>
              </div>

              <div className="highlight-item">
                <span className="highlight-bullet" />
                <div>
                  <strong>Cá nhân hóa theo từng JD tuyển dụng</strong>
                  <span>Không dùng mẫu chung chung, tối ưu hóa độc bản cho từng vị trí bạn ứng tuyển.</span>
                </div>
              </div>
            </div>

            <div className="about-story-cta">
              <button
                type="button"
                className="home-btn home-btn-primary"
                onClick={() => goTo('nav-match', 'nav-gap')}
              >
                Trải nghiệm AI ngay <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="about-matrix-col" data-reveal="fade-left">
            <div className="matrix-card card-emerald">
              <span className="matrix-accent-bar" />
              <h4>100% Khách Quan &amp; Bằng Chứng</h4>
              <p>Đánh giá dựa trên văn bản thực tế trong hồ sơ, mang lại kết quả chuẩn xác tuyệt đối.</p>
            </div>

            <div className="matrix-card card-purple">
              <span className="matrix-accent-bar" />
              <h4>Tối Ưu Chuẩn STAR &amp; ATS</h4>
              <p>Chuyển đổi kinh nghiệm thành câu từ ấn tượng, đạt điểm cao nhất khi qua hệ thống quét tự động.</p>
            </div>

            <div className="matrix-card card-teal">
              <span className="matrix-accent-bar" />
              <h4>Mô Phỏng Phỏng Vấn Giọng Nói</h4>
              <p>Tương tác 1-1 trực tiếp với AI Coach, rèn luyện phản xạ và nhận góp ý cải thiện chi tiết.</p>
            </div>

            <div className="matrix-card card-amber">
              <span className="matrix-accent-bar" />
              <h4>Bảo Mật Dữ Liệu Tuyệt Đối</h4>
              <p>Hồ sơ cá nhân luôn thuộc quyền kiểm soát của bạn, tuân thủ nghiêm ngặt chuẩn bảo mật.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. WORKFLOW ROADMAP (Clean Stepper Pipeline) ── */}
      <section className="home-pipeline-section" aria-labelledby="pipeline-title">
        <div className="home-pipeline-inner">
          <header className="pipeline-header" data-reveal="fade-up">
            <span className="section-pre-title">LỘ TRÌNH 3 BƯỚC</span>
            <h2 id="pipeline-title">Hành Trình Bứt Phá Sự Nghiệp Cùng AI</h2>
            <p>Chỉ với 3 bước đơn giản để biến hồ sơ của bạn thành tấm vé vàng chinh phục nhà tuyển dụng.</p>
          </header>

          <div className="pipeline-track">
            {/* Step 1 */}
            <div className="pipeline-step-item" data-reveal="fade-up" style={{ transitionDelay: '0ms' }}>
              <div className="pipeline-node">
                <span className="node-number">01</span>
                <div className="node-glow" />
              </div>
              <div className="pipeline-content-card">
                <h3>Tải CV &amp; Chọn JD Mục Tiêu</h3>
                <p>Tải lên file CV (PDF/DOCX) và dán nội dung JD vị trí mong muốn hoặc chọn từ kho việc làm hàng đầu.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="pipeline-step-item" data-reveal="fade-up" style={{ transitionDelay: '140ms' }}>
              <div className="pipeline-node">
                <span className="node-number">02</span>
                <div className="node-glow" />
              </div>
              <div className="pipeline-content-card highlight-node">
                <h3>AI Đối Chiếu &amp; Tối Ưu Tức Thì</h3>
                <p>AI Agent phân tích khoảng cách kỹ năng (Gap Analysis), đề xuất viết lại câu chuẩn STAR và xuất bản PDF ATS.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="pipeline-step-item" data-reveal="fade-up" style={{ transitionDelay: '280ms' }}>
              <div className="pipeline-node">
                <span className="node-number">03</span>
                <div className="node-glow" />
              </div>
              <div className="pipeline-content-card">
                <h3>Luyện Voice AI &amp; Nhận Offer</h3>
                <p>Luyện tập đối đáp phỏng vấn bằng giọng nói với AI Coach, tự tin thể hiện bản thân và nắm chắc việc làm mơ ước.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. FOOTER & LIÊN HỆ SECTION ── */}
      <footer className="home-main-footer" aria-labelledby="footer-title">
        <div className="home-footer-inner">
          <div className="footer-top-grid" data-reveal="fade-up">
            <div className="footer-col brand-col">
              <div className="footer-brand">
                <Image src="/images/image2.png" alt="Career Assistant Logo" width={40} height={40} />
                <span className="footer-brand-name">Career Assistant</span>
              </div>
              <p className="footer-brand-desc">
                Trợ lý nghề nghiệp AI thế hệ mới đồng hành cùng sinh viên và ứng viên Việt Nam trên
                hành trình phát triển sự nghiệp bền vững.
              </p>
              <div className="footer-social-links" aria-label="Mạng xã hội">
                <a href="#facebook" className="social-pill" aria-label="Facebook">Facebook</a>
                <a href="#linkedin" className="social-pill" aria-label="LinkedIn">LinkedIn</a>
                <a href="#github" className="social-pill" aria-label="GitHub">GitHub</a>
                <a href="#youtube" className="social-pill" aria-label="YouTube">YouTube</a>
              </div>
            </div>

            <div className="footer-col">
              <h4 className="footer-col-title">Giải Pháp</h4>
              <ul className="footer-nav-list">
                <li><button type="button" onClick={() => goTo('nav-cv')}>Tối ưu hóa CV chuẩn ATS</button></li>
                <li><button type="button" onClick={() => goTo('nav-match', 'nav-gap')}>So khớp CV với JD</button></li>
                <li><button type="button" onClick={() => goTo('nav-interview')}>Luyện phỏng vấn Voice AI</button></li>
                <li><button type="button" onClick={() => goTo('nav-find-jobs')}>Tìm kiếm việc làm phù hợp</button></li>
                <li><button type="button" onClick={() => goTo('nav-cv')}>Bộ sưu tập mẫu CV đẹp</button></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-col-title">Công Ty</h4>
              <ul className="footer-nav-list">
                <li><a href="#about-showcase-title">Giới thiệu về chúng tôi</a></li>
                <li><a href="#pipeline-title">Lộ trình 3 bước</a></li>
                <li><a href="#partners">Dành cho Nhà tuyển dụng</a></li>
                <li><a href="#counselors">Dành cho Cố vấn nghề nghiệp</a></li>
                <li><a href="#privacy">Chính sách bảo mật</a></li>
                <li><a href="#terms">Điều khoản sử dụng</a></li>
              </ul>
            </div>

            <div className="footer-col contact-col">
              <h4 className="footer-col-title">Thông Tin Liên Hệ</h4>
              <div className="footer-contact-list">
                <div className="contact-item">
                  <div>
                    <strong>Trụ sở chính:</strong>
                    <span>Tòa nhà Đổi mới Sáng tạo, Cầu Giấy, Hà Nội</span>
                  </div>
                </div>
                <div className="contact-item">
                  <div>
                    <strong>Chi nhánh TP.HCM:</strong>
                    <span>Tòa nhà Tài chính, Quận 1, TP. Hồ Chí Minh</span>
                  </div>
                </div>
                <div className="contact-item">
                  <div>
                    <strong>Email hỗ trợ:</strong>
                    <a href="mailto:contact@careercopilot.vn">contact@careercopilot.vn</a>
                  </div>
                </div>
                <div className="contact-item">
                  <div>
                    <strong>Hotline tư vấn:</strong>
                    <a href="tel:19006868">1900 6868 (8:00 - 20:00)</a>
                  </div>
                </div>
                <div className="contact-item">
                  <div>
                    <strong>Hỗ trợ trực tuyến:</strong>
                    <span>24/7 với AI Assistant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <p>© 2026 Career Assistant Co., Ltd. Tất cả quyền được bảo lưu.</p>
            <div className="footer-bottom-links">
              <a href="#privacy">Bảo mật thông tin</a>
              <span>·</span>
              <a href="#terms">Điều khoản dịch vụ</a>
              <span>·</span>
              <a href="#cookies">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>

      <BuddyTourGuide />
    </section>
  );
}
