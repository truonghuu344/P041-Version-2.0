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
            Chu?n b? t?t hõn
            <span> cho công vi?c b?n mu?n.</span>
          </h1>

          <p className={'dashboard-hero-description'}>
            T?o ho?c c?i thi?n CV, ki?m tra ð? phù h?p và luy?n ph?ng v?n.
            B?t ð?u t? vi?c b?n c?n nh?t hôm nay.
          </p>

          <div className={'dashboard-hero-actions'}>
            <button
              type="button"
              className={'dashboard-primary-button'}
              onClick={() => goTo('nav-cv')}
            >
              <FileText size={18} />
              Qu?n l? CV
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
              <span>Hà N?i · Hybrid</span>
            </div>
          </div>

          {/* Demo Match */}
          <div className={'dashboard-match-demo'}>
            <div className={'dashboard-demo-label'}>MINH H?A</div>

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
              Hôm nay b?n mu?n làm g??
            </h2>
          </div>

          <p>
            Không có bý?c b?t bu?c. Ch?n ðúng công c? cho nhu c?u hi?n t?i
            c?a b?n.
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
                <h3>Match CV v?i công vi?c</h3>

                <p>
                  Ch?n m?t CV và công vi?c ð? xem nh?ng ði?m phù h?p và c?n b? sung.
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
              <span>Xem m?c ð? phù h?p</span>
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

            <h3>T?o ho?c c?p nh?t CV</h3>

            <p>
              B?t ð?u t? m?u có s?n ho?c t?i lên CV hi?n có.
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
              <span>T?o & ch?nh s?a CV</span>
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

            <h3>T?m vi?c phù h?p</h3>

            <p>
              Khám phá v? trí, xem yêu c?u và lýu công vi?c b?n quan tâm.
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

            <h3>C?i thi?n n?i dung CV</h3>

            <p>
              Di?n ð?t kinh nghi?m r? ràng hõn, d?a trên nh?ng g? b?n ð? làm.
            </p>

            <div className={'dashboard-rewrite-preview'} aria-hidden="true">
              <span>Trý?c</span>
              <i />
              <ArrowRight size={14} />
              <span>Sau</span>
              <b />
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>T?i ýu CV</span>
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

            <h3>Luy?n ph?ng v?n</h3>

            <p>
              Ch?n CV và công vi?c ð? th?c hành, r?i xem ph?n h?i c? th?.
            </p>

            <div className={'dashboard-wave'} aria-hidden="true">
              {[30, 55, 85, 45, 70, 36, 64, 26].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>

            <div className={'dashboard-tool-footer'}>
              <span>Luy?n ph?ng v?n</span>
              <ToolArrow />
            </div>
          </button>
        </div>
      </section>

      {/* =========================================================
          ECOSYSTEM - KHÔNG PH?I PIPELINE
      ========================================================== */}
      <section className={'dashboard-ecosystem-section'}>
        <div className={'dashboard-ecosystem-intro'}>
          <span className={'dashboard-section-eyebrow'}>
            MODULAR CAREER TOOLS
          </span>

          <h2>
            M?i công c? ð?ng ð?c l?p.
            <br />
            <span>K?t n?i khi b?n c?n.</span>
          </h2>

          <p>
            B?n có th? ch? vi?t CV, ch? t?m vi?c, ho?c ðýa ngay CV + JD vào
            AI Match. H? th?ng gi? context ð? b?n không ph?i b?t ð?u l?i.
          </p>

          <button
            type="button"
            className={'dashboard-text-button'}
            onClick={() => goTo('nav-match', 'nav-gap')}
          >
            Th? AI Match
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
              Ch?n m?t phong cách.
              <br />
              Bi?n nó thành CV c?a b?n.
            </h2>
          </div>

          <button
            type="button"
            className={'dashboard-text-button'}
            onClick={() => goTo('nav-cv')}
          >
            Xem t?t c? m?u
            <ArrowRight size={17} />
          </button>
        </header>

        <div className={'dashboard-template-grid'}>
          {[
            {
              variant: 'modern' as CVVariant,
              name: 'Modern Focus',
              description: 'T?i gi?n · Product & Marketing',
              code: '01',
            },
            {
              variant: 'classic' as CVVariant,
              name: 'Classic ATS',
              description: 'R? ràng · D? quét ATS',
              code: '02',
            },
            {
              variant: 'mint' as CVVariant,
              name: 'Tech Portfolio',
              description: 'Hi?n ð?i · Creative & Tech',
              code: '03',
            },
            {
              variant: 'warm' as CVVariant,
              name: 'Executive',
              description: 'Tinh g?n · Experienced',
              code: '04',
            },
          ].map((template) => (
            <article className={'dashboard-template-card'} key={template.variant}>
              <div className={'dashboard-template-top'}>
                <span>{template.code}</span>

                <button
                  type="button"
                  aria-label={`S? d?ng m?u ${template.name}`}
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
            CV t?t hõn không có ngh?a là
            <span> b?a thêm.</span>
          </h2>

          <p>
            Career Assistant giúp b?n làm n?i b?t ðúng b?ng ch?ng ð? có,
            di?n ð?t r? thành t?u và ð?t thông tin quan tr?ng vào ðúng v? trí.
          </p>

          <ul>
            <li>
              <Check size={15} />
              Gi? nguyên s? th?t trong CV
            </li>
            <li>
              <Check size={15} />
              Làm r? k? nãng b?ng b?ng ch?ng
            </li>
            <li>
              <Check size={15} />
              T?i ýu theo m?c tiêu khi b?n ch?n Job
            </li>
          </ul>

          <button
            type="button"
            className={'dashboard-primary-button'}
            onClick={() => goTo('nav-cv')}
          >
            <PenTool size={17} />
            M? CV c?a tôi
            <ArrowRight size={16} />
          </button>
        </div>

        <div className={'dashboard-compare-stage'}>
          <div className={`${'dashboard-compare-document'} ${'dashboard-before-doc'}`}>
            <span className={'dashboard-compare-label'}>TRÝ?C</span>

            <MiniCV variant="classic" />

            <div className={'dashboard-compare-note'}>
              N?i dung c?n chung chung
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
              B?ng ch?ng r? hõn
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
              “H?y k? v? m?t l?n b?n gi?i quy?t v?n ð? khó trong d? án.”
            </strong>

            <small>Câu h?i 3 / 5</small>
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
            Ð?ng ð? bu?i ph?ng v?n th?t là l?n ð?u b?n th? tr? l?i.
          </h2>

          <p>
            Luy?n ph?ng v?n theo CV ho?c Job b?n ch?n. Sau m?i lý?t, b?n
            nh?n ph?n h?i ð? bi?t m?nh ðang nói t?t ? ðâu và c?n c?i thi?n
            ði?u g?.
          </p>

          <div className={'dashboard-score-rows'}>
            <div>
              <span>Giao ti?p</span>
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
            B?t ð?u luy?n t?p
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
            Không c?n bi?t ph?i b?t ð?u t? “pipeline” nào.
          </h2>

          <p>
            Ch? c?n ch?n ði?u b?n mu?n làm ngay lúc này.
          </p>
        </div>

        <div className={'dashboard-final-actions'}>
          <button
            type="button"
            className={'dashboard-light-button'}
            onClick={() => goTo('nav-cv')}
          >
            <FileText size={17} />
            T?o CV
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
