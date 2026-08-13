'use client';

import Image from 'next/image';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileText,
  MessageSquareText,
  Mic,
  PenTool,
  Search,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import BuddyTourGuide from './BuddyTourGuide';

const cvLines = [92, 76, 88, 67, 82];

type CVVariant = 'modern' | 'classic' | 'mint' | 'warm';

function goTo(primaryId: string, fallbackId?: string) {
  const target =
    document.getElementById(primaryId) ||
    (fallbackId ? document.getElementById(fallbackId) : null);

  target?.click();
}

function MiniCV({ variant = 'modern' }: { variant?: CVVariant }) {
  return (
    <div
      className={`dashboard-mini-cv dashboard-mini-cv-${variant}`}
      aria-hidden="true"
    >
      <div className={'dashboard-mini-cvheader'}>
        <i />
        <span />
      </div>

      <b />
      <em />

      <div className={'dashboard-mini-cvrule'} />

      {cvLines.map((width, index) => (
        <i key={index} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

function ToolArrow() {
  return (
    <span className={'dashboard-tool-arrow'}>
      <ArrowRight size={17} />
    </span>
  );
}

export default function DashboardView() {
  return (
    <section
      className={`app-view active ${'dashboard-dashboard'}`}
      id="view-dashboard"
    >
      {/* =========================================================
          HERO
      ========================================================== */}
      <section className={'dashboard-hero'}>
        <div className={'dashboard-hero-glow-one'} aria-hidden="true" />
        <div className={'dashboard-hero-glow-two'} aria-hidden="true" />
        <div className={'dashboard-hero-grid'} aria-hidden="true" />

        <div className={'dashboard-hero-copy'}>
          <h1 className={'dashboard-hero-title'}>
            Chuẩn bị tốt hơn
            <span> cho công việc bạn muốn.</span>
          </h1>

          <p className={'dashboard-hero-description'}>
            Tạo hoặc cải thiện CV, kiểm tra độ phù hợp và luyện phỏng vấn.
            Bắt đầu từ việc bạn cần nhất hôm nay.
          </p>

          <div className={'dashboard-hero-actions'}>
            <button
              type="button"
              className={'dashboard-primary-button'}
              onClick={() => goTo('nav-cv')}
            >
              <FileText size={18} />
              Quản lý CV
              <ArrowRight size={17} />
            </button>

            <button
              type="button"
              className={'dashboard-secondary-button'}
              onClick={() => goTo('nav-match')}
            >
              <Search size={17} />
              Match CV
            </button>
          </div>

        </div>

        {/* Hero Visual */}
        <div className={'dashboard-hero-visual'}>
          <div className={'dashboard-visual-aura'} aria-hidden="true" />

          <div className={'dashboard-buddy-stage'}>
            <Image
              src="/images/buddy2.png"
              alt="Career Buddy"
              width={1536}
              height={1024}
              className={'dashboard-buddy-image'}
              priority
            />
          </div>

          {/* Floating CV */}
          <div className={`${'dashboard-float-card'} ${'dashboard-float-cv'}`}>
            <div className={'dashboard-float-icon'}>
              <FileText size={17} />
            </div>

            <div>
              <small>YOUR CV</small>
              <strong>AI Engineer CV</strong>
              <span>Python · RAG · FastAPI</span>
            </div>

            <div className={'dashboard-success-dot'}>
              <Check size={11} />
            </div>
          </div>

          {/* Floating Job */}
          <div className={`${'dashboard-float-card'} ${'dashboard-float-job'}`}>
            <div className={'dashboard-float-icon'}>
              <BriefcaseBusiness size={17} />
            </div>

            <div>
              <small>TARGET JOB</small>
              <strong>AI Engineer</strong>
              <span>Hà Nội · Hybrid</span>
            </div>
          </div>

          {/* Demo Match */}
          <div className={'dashboard-match-demo'}>
            <div className={'dashboard-demo-label'}>MINH HỌA</div>

            <div className={'dashboard-demo-score'}>
              <span>87</span>
              <small>%</small>
            </div>

            <strong>Strong Match</strong>

            <div className={'dashboard-demo-progress'}>
              <i />
            </div>

            <div className={'dashboard-demo-meta'}>
              <span>12 matched</span>
              <span>3 gaps</span>
            </div>
          </div>

          <div className={'dashboard-ai-core'} aria-hidden="true">
            <Sparkles size={20} />
          </div>
        </div>
      </section>

      {/* =========================================================
          INTENT / BENTO WORKSPACE
      ========================================================== */}
      <section
        className={'dashboard-intent-section'}
        aria-labelledby="intent-workspace-title"
      >
        <header className={'dashboard-section-header'}>
          <div>
            <h2 id="intent-workspace-title">
              Hôm nay bạn muốn làm gì?
            </h2>
          </div>

          <p>
            Không có bước bắt buộc. Chọn đúng công cụ cho nhu cầu hiện tại
            của bạn.
          </p>
        </header>

        <div className={'dashboard-bento-grid'}>
          {/* Featured Match */}
          <button
            type="button"
            id="intent-card-match"
            className={`${'dashboard-tool-card'} ${'dashboard-match-card'}`}
            onClick={() => goTo('nav-match', 'nav-gap')}
          >
            <div className={'dashboard-tool-top'}>
              <div className={`${'dashboard-tool-icon'} ${'dashboard-tool-icon-dark'}`}>
                <Target size={21} />
              </div>

            </div>

            <div className={'dashboard-match-card-content'}>
              <div>
                <h3>Match CV với công việc</h3>

                <p>
                  Chọn một CV và công việc để xem những điểm phù hợp và cần bổ sung.
                </p>
              </div>

              <div className={'dashboard-match-illustration'} aria-hidden="true">
                <div className={'dashboard-match-source'}>
                  <FileText size={18} />
                  <span>CV</span>
                </div>

                <div className={'dashboard-match-line'}>
                  <i />
                </div>

                <div className={'dashboard-match-core'}>
                  <Sparkles size={18} />
                </div>

                <div className={'dashboard-match-line'}>
                  <i />
                </div>

                <div className={'dashboard-match-source'}>
                  <BriefcaseBusiness size={18} />
                  <span>JOB</span>
                </div>
              </div>
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>Xem mức độ phù hợp</span>
              <ToolArrow />
            </div>
          </button>

          {/* Create CV */}
          <button
            type="button"
            id="intent-card-cv"
            className={`${'dashboard-tool-card'} ${'dashboard-cv-card'}`}
            onClick={() => goTo('nav-cv')}
          >
            <div className={'dashboard-tool-top'}>
              <div className={'dashboard-tool-icon'}>
                <FileText size={20} />
              </div>

            </div>

            <h3>Tạo hoặc cập nhật CV</h3>

            <p>
              Bắt đầu từ mẫu có sẵn hoặc tải lên CV hiện có.
            </p>

            <div className={'dashboard-paper-stack'} aria-hidden="true">
              <div />
              <div />
              <div>
                <span />
                <i />
                <i />
                <i />
              </div>
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>Tạo & chỉnh sửa CV</span>
              <ToolArrow />
            </div>
          </button>

          {/* Jobs */}
          <button
            type="button"
            id="intent-card-jobs"
            className={`${'dashboard-tool-card'} ${'dashboard-jobs-card'}`}
            onClick={() => goTo('nav-find-jobs')}
          >
            <div className={'dashboard-tool-top'}>
              <div className={'dashboard-tool-icon'}>
                <BriefcaseBusiness size={20} />
              </div>

              <span className={'dashboard-tool-number'}>02</span>
            </div>

            <span className={'dashboard-tool-label'}>JOB DISCOVERY</span>

            <h3>Tìm việc phù hợp</h3>

            <p>
              Khám phá vị trí, xem yêu cầu và lưu công việc bạn quan tâm.
            </p>

            <div className={'dashboard-job-preview-list'} aria-hidden="true">
              <div>
                <i>AI</i>
                <span>
                  <strong>AI Engineer</strong>
                  <small>Python · RAG</small>
                </span>
              </div>

              <div>
                <i>BE</i>
                <span>
                  <strong>Backend Engineer</strong>
                  <small>Java · Docker</small>
                </span>
              </div>
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>Khám phá Jobs</span>
              <ToolArrow />
            </div>
          </button>

          {/* Optimize */}
          <button
            type="button"
            className={`${'dashboard-tool-card'} ${'dashboard-optimize-card'}`}
            onClick={() => goTo('nav-gap')}
          >
            <div className={'dashboard-tool-top'}>
              <div className={'dashboard-tool-icon'}>
                <WandSparkles size={20} />
              </div>

              <span className={'dashboard-tool-number'}>03</span>
            </div>

            <span className={'dashboard-tool-label'}>CV OPTIMIZATION</span>

            <h3>Cải thiện nội dung CV</h3>

            <p>
              Diễn đạt kinh nghiệm rõ ràng hơn, dựa trên những gì bạn đã làm.
            </p>

            <div className={'dashboard-rewrite-preview'} aria-hidden="true">
              <span>Trước</span>
              <i />
              <ArrowRight size={14} />
              <span>Sau</span>
              <b />
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>Tối ưu CV</span>
              <ToolArrow />
            </div>
          </button>

          {/* Interview */}
          <button
            type="button"
            className={`${'dashboard-tool-card'} ${'dashboard-interview-card'}`}
            onClick={() => goTo('nav-interview')}
          >
            <div className={'dashboard-tool-top'}>
              <div className={'dashboard-tool-icon'}>
                <Mic size={20} />
              </div>

            </div>

            <h3>Luyện phỏng vấn</h3>

            <p>
              Chọn CV và công việc để thực hành, rồi xem phản hồi cụ thể.
            </p>

            <div className={'dashboard-wave'} aria-hidden="true">
              {[30, 55, 85, 45, 70, 36, 64, 26].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>Luyện phỏng vấn</span>
              <ToolArrow />
            </div>
          </button>
        </div>
      </section>

      {/* =========================================================
          ECOSYSTEM - KHÔNG PHẢI PIPELINE
      ========================================================== */}
      <section className={'dashboard-ecosystem-section'}>
        <div className={'dashboard-ecosystem-intro'}>
          <span className={'dashboard-section-eyebrow'}>
            MODULAR CAREER TOOLS
          </span>

          <h2>
            Mỗi công cụ hoạt động độc lập.
            <br />
            <span>Kết nối khi bạn cần.</span>
          </h2>

          <p>
            Bạn có thể chỉ viết CV, chỉ tìm việc, hoặc đưa ngay CV + JD vào
            AI Match. Hệ thống giữ context để bạn không phải bắt đầu lại.
          </p>

          <button
            type="button"
            className={'dashboard-text-button'}
            onClick={() => goTo('nav-match', 'nav-gap')}
          >
            Thử AI Match
            <ArrowRight size={17} />
          </button>
        </div>

        <div className={'dashboard-ecosystem-visual'}>
          <div className={'dashboard-ecosystem-core'}>
            <div>
              <Sparkles size={24} />
            </div>
            <strong>Career AI</strong>
            <span>Context-aware</span>
          </div>

          <div className={`${'dashboard-orbit-item'} ${'dashboard-orbit-cv'}`}>
            <FileText size={17} />
            <span>CV</span>
          </div>

          <div className={`${'dashboard-orbit-item'} ${'dashboard-orbit-job'}`}>
            <BriefcaseBusiness size={17} />
            <span>Jobs</span>
          </div>

          <div className={`${'dashboard-orbit-item'} ${'dashboard-orbit-match'}`}>
            <Target size={17} />
            <span>Match</span>
          </div>

          <div className={`${'dashboard-orbit-item'} ${'dashboard-orbit-interview'}`}>
            <Mic size={17} />
            <span>Interview</span>
          </div>

          <div className={'dashboard-orbit-circle-one'} aria-hidden="true" />
          <div className={'dashboard-orbit-circle-two'} aria-hidden="true" />
        </div>
      </section>

      {/* =========================================================
          CV SHOWROOM
      ========================================================== */}
      <section
        className={'dashboard-template-section'}
        aria-labelledby="dashboard-template-title"
      >
        <header className={'dashboard-section-header'}>
          <div>
            <span className={'dashboard-section-eyebrow'}>CV SHOWROOM</span>

            <h2 id="dashboard-template-title">
              Chọn một phong cách.
              <br />
              Biến nó thành CV của bạn.
            </h2>
          </div>

          <button
            type="button"
            className={'dashboard-text-button'}
            onClick={() => goTo('nav-cv')}
          >
            Xem tất cả mẫu
            <ArrowRight size={17} />
          </button>
        </header>

        <div className={'dashboard-template-grid'}>
          {[
            {
              variant: 'modern' as CVVariant,
              name: 'Modern Focus',
              description: 'Tối giản · Product & Marketing',
              code: '01',
            },
            {
              variant: 'classic' as CVVariant,
              name: 'Classic ATS',
              description: 'Rõ ràng · Dễ quét ATS',
              code: '02',
            },
            {
              variant: 'mint' as CVVariant,
              name: 'Tech Portfolio',
              description: 'Hiện đại · Creative & Tech',
              code: '03',
            },
            {
              variant: 'warm' as CVVariant,
              name: 'Executive',
              description: 'Tinh gọn · Experienced',
              code: '04',
            },
          ].map((template) => (
            <article className={'dashboard-template-card'} key={template.variant}>
              <div className={'dashboard-template-top'}>
                <span>{template.code}</span>

                <button
                  type="button"
                  aria-label={`Sử dụng mẫu ${template.name}`}
                  onClick={() => goTo('nav-cv')}
                >
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className={'dashboard-template-preview'}>
                <div className={'dashboard-sheet-back'} />
                <MiniCV variant={template.variant} />
              </div>

              <div className={'dashboard-template-info'}>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* =========================================================
          BEFORE AFTER
      ========================================================== */}
      <section
        className={'dashboard-transform-section'}
        aria-labelledby="dashboard-transform-title"
      >
        <div className={'dashboard-transform-copy'}>
          <span className={'dashboard-section-eyebrow'}>WRITE WITH EVIDENCE</span>

          <h2 id="dashboard-transform-title">
            CV tốt hơn không có nghĩa là
            <span> bịa thêm.</span>
          </h2>

          <p>
            Career Assistant giúp bạn làm nổi bật đúng bằng chứng đã có,
            diễn đạt rõ thành tựu và đặt thông tin quan trọng vào đúng vị trí.
          </p>

          <ul>
            <li>
              <Check size={15} />
              Giữ nguyên sự thật trong CV
            </li>
            <li>
              <Check size={15} />
              Làm rõ kỹ năng bằng bằng chứng
            </li>
            <li>
              <Check size={15} />
              Tối ưu theo mục tiêu khi bạn chọn Job
            </li>
          </ul>

          <button
            type="button"
            className={'dashboard-primary-button'}
            onClick={() => goTo('nav-cv')}
          >
            <PenTool size={17} />
            Mở CV của tôi
            <ArrowRight size={16} />
          </button>
        </div>

        <div className={'dashboard-compare-stage'}>
          <div className={`${'dashboard-compare-document'} ${'dashboard-before-doc'}`}>
            <span className={'dashboard-compare-label'}>TRƯỚC</span>

            <MiniCV variant="classic" />

            <div className={'dashboard-compare-note'}>
              Nội dung còn chung chung
            </div>
          </div>

          <div className={'dashboard-transform-arrow'}>
            <Sparkles size={20} />
            <span>AI</span>
          </div>

          <div className={`${'dashboard-compare-document'} ${'dashboard-after-doc'}`}>
            <span className={'dashboard-compare-label'}>SAU</span>

            <MiniCV variant="mint" />

            <div className={'dashboard-compare-note-success'}>
              Bằng chứng rõ hơn
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          INTERVIEW EXPERIENCE
      ========================================================== */}
      <section
        className={'dashboard-interview-section'}
        aria-labelledby="dashboard-interview-title"
      >
        <div className={'dashboard-interview-visual'}>
          <div className={'dashboard-interview-orb'} aria-hidden="true" />

          <div className={'dashboard-question-card'}>
            <div>
              <MessageSquareText size={16} />
              <span>AI Interview</span>
            </div>

            <strong>
              “Hãy kể về một lần bạn giải quyết vấn đề khó trong dự án.”
            </strong>

            <small>Câu hỏi 3 / 5</small>
          </div>

          <div className={'dashboard-interview-wave'} aria-hidden="true">
            {[42, 74, 54, 88, 65, 40, 78, 52, 70, 36].map(
              (height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              )
            )}
          </div>

          <div className={'dashboard-score-bubble'}>
            <span>STAR</span>
            <strong>82</strong>
          </div>
        </div>

        <div className={'dashboard-interview-copy'}>
          <span className={'dashboard-section-eyebrow'}>AI INTERVIEW COACH</span>

          <h2 id="dashboard-interview-title">
            Đừng để buổi phỏng vấn thật là lần đầu bạn thử trả lời.
          </h2>

          <p>
            Luyện phỏng vấn theo CV hoặc Job bạn chọn. Sau mỗi lượt, bạn
            nhận phản hồi để biết mình đang nói tốt ở đâu và cần cải thiện
            điều gì.
          </p>

          <div className={'dashboard-score-rows'}>
            <div>
              <span>Giao tiếp</span>
              <b>82</b>
              <i>
                <em style={{ width: '82%' }} />
              </i>
            </div>

            <div>
              <span>STAR</span>
              <b>76</b>
              <i>
                <em style={{ width: '76%' }} />
              </i>
            </div>

            <div>
              <span>Chuyên môn</span>
              <b>84</b>
              <i>
                <em style={{ width: '84%' }} />
              </i>
            </div>
          </div>

          <button
            type="button"
            className={'dashboard-text-button'}
            onClick={() => goTo('nav-interview')}
          >
            Bắt đầu luyện tập
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* =========================================================
          FINAL CTA
      ========================================================== */}
      <section className={'dashboard-final-cta'}>
        <div className={'dashboard-final-glow'} aria-hidden="true" />

        <div>
          <span>
            <Sparkles size={14} />
            CAREER BUDDY
          </span>

          <h2>
            Không cần biết phải bắt đầu từ “pipeline” nào.
          </h2>

          <p>
            Chỉ cần chọn điều bạn muốn làm ngay lúc này.
          </p>
        </div>

        <div className={'dashboard-final-actions'}>
          <button
            type="button"
            className={'dashboard-light-button'}
            onClick={() => goTo('nav-cv')}
          >
            <FileText size={17} />
            Tạo CV
          </button>

          <button
            type="button"
            className={'dashboard-white-button'}
            onClick={() => goTo('nav-match', 'nav-gap')}
          >
            <Target size={17} />
            AI Match
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <BuddyTourGuide />
    </section>
  );
}
