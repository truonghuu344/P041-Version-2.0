import Image from 'next/image';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  MessageSquareText,
  Mic,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';

const cvLines = [92, 76, 88, 67, 82];

function MiniCV({ variant = 'modern' }: { variant?: 'modern' | 'classic' | 'mint' | 'warm' }) {
  return (
    <div className={`buddy-mini-cv buddy-mini-cv-${variant}`} aria-hidden="true">
      <div className="buddy-mini-cv-head"><i></i><span></span></div>
      <b></b><em></em>
      <div className="buddy-mini-cv-rule"></div>
      {cvLines.map((width, index) => <i key={index} style={{ width: `${width}%` }}></i>)}
    </div>
  );
}

export default function DashboardView() {
  return (
    <section className="app-view active buddy-landing" id="view-dashboard">
      <div className="buddy-hero-shell">
        <div className="buddy-hero-copy">
          <span className="buddy-kicker"><Sparkles size={15} /> Career Buddy của bạn</span>
          <h1>CV tốt hơn.<br /><span>Cơ hội tốt hơn.</span></h1>
          <p>Tải CV, chọn công việc bạn muốn và cùng Career Buddy chuẩn bị cho vòng phỏng vấn.</p>
          <div className="buddy-hero-actions">
            <button className="buddy-primary-button" id="btn-consult">
              <Upload size={19} /> Tải CV để bắt đầu
            </button>
            <button className="buddy-text-button" id="btn-try-free">
              Luyện phỏng vấn <ArrowRight size={18} />
            </button>
          </div>
          <div className="buddy-proof"><CheckCircle2 size={17} /> PDF hoặc DOCX · miễn phí để bắt đầu</div>
        </div>

        <div className="buddy-hero-visual">
          <Image
            src="/images/buddy.png"
            alt="Career Buddy đang giúp chỉnh sửa CV với điểm ATS và mức độ phù hợp công việc"
            width={1536}
            height={1024}
            priority
          />
        </div>
      </div>

      <section className="buddy-journey" aria-labelledby="buddy-journey-title">
        <div className="buddy-section-intro">
          <span>Chỉ 3 bước</span>
          <h2 id="buddy-journey-title">Từ CV đến buổi phỏng vấn.</h2>
        </div>
        <div className="buddy-journey-grid">
          <article className="buddy-scene buddy-scene-cv">
            <div className="buddy-scene-art"><FileText /><div className="buddy-paper-lines"><i></i><i></i><i></i></div><span className="buddy-scene-mascot">✦</span></div>
            <div><strong>Chỉnh CV</strong><p>Biết ngay cần giữ và cần sửa.</p></div>
          </article>
          <article className="buddy-scene buddy-scene-job">
            <div className="buddy-scene-art"><BriefcaseBusiness /><Search className="buddy-search-icon" /><span className="buddy-match-pill">87% phù hợp</span></div>
            <div><strong>Tìm việc phù hợp</strong><p>Ưu tiên JD hợp với CV của bạn.</p></div>
          </article>
          <article className="buddy-scene buddy-scene-interview">
            <div className="buddy-scene-art"><Mic /><div className="buddy-sound-wave"><i></i><i></i><i></i><i></i></div><span className="buddy-scene-mascot">✓</span></div>
            <div><strong>Luyện phỏng vấn</strong><p>Tập trả lời, nhận điểm và tiến bộ.</p></div>
          </article>
        </div>
      </section>

      <section className="buddy-template-section" aria-labelledby="buddy-template-title">
        <div className="buddy-section-heading">
          <div><span>Showroom CV</span><h2 id="buddy-template-title">Chọn một mẫu, rồi làm nó thành của bạn.</h2></div>
          <button className="buddy-link-button" onClick={() => document.getElementById('nav-cv')?.click()}><span>Xem tất cả mẫu</span><ArrowRight size={17} /></button>
        </div>
        <div className="buddy-template-grid">
          {[
            ['modern', 'Tối giản hiện đại', 'Phù hợp Product, Marketing'],
            ['classic', 'Classic ATS', 'Rõ ràng, dễ quét'],
            ['mint', 'Portfolio Mint', 'Cho Creative và Tech'],
            ['warm', 'Executive', 'Gọn gàng cho người có kinh nghiệm'],
          ].map(([variant, name, description]) => (
            <article className="buddy-template-card" key={variant}>
              <div className="buddy-template-preview"><MiniCV variant={variant as 'modern' | 'classic' | 'mint' | 'warm'} /></div>
              <div className="buddy-template-info"><h3>{name}</h3><p>{description}</p></div>
              <div className="buddy-template-actions"><button onClick={() => document.getElementById('nav-cv')?.click()}>Xem mẫu</button><button onClick={() => document.getElementById('nav-cv')?.click()}>Dùng mẫu này</button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="buddy-before-after" aria-labelledby="buddy-before-after-title">
        <div className="buddy-before-copy">
          <span>Trước &amp; sau</span>
          <h2 id="buddy-before-after-title">Một CV tốt không cần dài hơn. Chỉ cần đúng hơn.</h2>
          <p>Career Buddy giúp bạn đưa thành tựu, kỹ năng và từ khóa quan trọng vào đúng chỗ.</p>
          <button className="buddy-primary-button" onClick={() => document.getElementById('nav-cv')?.click()}>Xem CV của tôi <ArrowRight size={18} /></button>
        </div>
        <div className="buddy-compare-card" aria-label="Minh họa CV trước và sau tối ưu">
          <div className="buddy-compare-side buddy-before"><span>TRƯỚC</span><MiniCV variant="classic" /></div>
          <div className="buddy-compare-divider"><div><ArrowRight size={19} /></div></div>
          <div className="buddy-compare-side buddy-after"><span>SAU</span><MiniCV variant="mint" /><div className="buddy-improved-chip">+12 điểm ATS</div></div>
        </div>
      </section>

      <section className="buddy-interview-section" aria-labelledby="buddy-interview-title">
        <div className="buddy-interview-visual" aria-hidden="true">
          <div className="buddy-interview-desk"></div>
          <div className="buddy-interview-person buddy-interview-user"></div>
          <div className="buddy-interview-person buddy-interview-mascot"><Mic size={24} /></div>
          <div className="buddy-interview-card"><MessageSquareText size={18} /><span>Câu hỏi 3 / 5</span></div>
        </div>
        <div className="buddy-interview-copy">
          <span>Luyện phỏng vấn</span>
          <h2 id="buddy-interview-title">Nói tự tin hơn trong buổi phỏng vấn thật.</h2>
          <p>Trả lời theo STAR. Sau mỗi lượt, bạn biết ngay điểm mạnh và điều cần cải thiện.</p>
          <div className="buddy-score-list">
            <div><span>Giao tiếp</span><b>82</b><i style={{ width: '82%' }}></i></div>
            <div><span>STAR</span><b>76</b><i style={{ width: '76%' }}></i></div>
            <div><span>Chuyên môn</span><b>84</b><i style={{ width: '84%' }}></i></div>
          </div>
          <button className="buddy-text-button" onClick={() => document.getElementById('nav-interview')?.click()}>Thử một buổi phỏng vấn <ArrowRight size={18} /></button>
        </div>
      </section>
    </section>
  );
}
