import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  FileText,
  MessageSquareText,
  Mic,
  Play,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';

export default function InterviewView() {
  return (
    <section className="app-view buddy-landing interview-workspace" id="view-interview">
      <div className="interview-shell">
        <header className="interview-page-header">
          <span className="interview-eyebrow"><Mic size={14} /> VOICE MOCK INTERVIEW</span>
          <h2>Luyện nói tự tin trước buổi phỏng vấn thật.</h2>
          <p>Chọn CV và vị trí. Trả lời bằng giọng nói, nhận phản hồi STAR dựa trên nội dung bạn thực sự nói.</p>
        </header>

        <div className="interview-layout">
          <section className="interview-setup-card" id="page-interview-setup">
            <div className="interview-card-heading">
              <span className="interview-icon"><Play size={18} /></span>
              <div><h3>Thiết lập phiên luyện tập</h3><p>3–10 câu hỏi, bám sát CV và JD bạn chọn.</p></div>
            </div>

            <div className="interview-form-grid">
              <label className="interview-field interview-field-wide"><span><FileText size={15} /> CV phỏng vấn</span><select id="page-interview-select-cv"><option value="">Chọn CV đã lưu</option></select></label>
              <label className="interview-field interview-field-wide"><span><BriefcaseBusiness size={15} /> Vị trí ứng tuyển</span><select id="page-interview-select-jd"><option value="">Chọn JD đã lưu</option></select></label>
              <label className="interview-field"><span>Kiểu câu hỏi</span><select id="interview-mode"><option value="MIXED">Hỗn hợp</option><option value="TECHNICAL">Chuyên môn</option><option value="BEHAVIORAL">Hành vi</option></select></label>
              <label className="interview-field"><span>Ngôn ngữ</span><select id="interview-language"><option value="FOLLOW_CANDIDATE">Theo ứng viên</option><option value="VI">Tiếng Việt</option><option value="EN">Tiếng Anh</option></select></label>
              <label className="interview-field"><span>Thời lượng</span><select id="interview-duration"><option value="15">15 phút</option><option value="30" defaultValue="30">30 phút</option><option value="45">45 phút</option><option value="60">60 phút</option></select></label>
            </div>

            <div className="interview-setup-note"><Sparkles size={15} /><span>Voice được chuyển thành transcript để chấm điểm. Bạn luôn có thể sửa câu trả lời trước khi gửi.</span></div>
            <button id="page-btn-start-interview" className="interview-start-button"><Mic size={18} /> Bắt đầu phỏng vấn voice</button>
          </section>

          <section className="interview-live-card" id="page-interview-chat">
            <header className="interview-live-header">
              <div><span className="interview-icon live"><Mic size={18} /></span><div><h3>Career Buddy</h3><p><i /> Sẵn sàng phỏng vấn</p></div></div>
              <span id="page-interview-progress-text">Câu hỏi 1 / 5</span>
            </header>
            <div id="page-interview-chat-history" className="interview-chat-history">
              <div className="interview-empty-chat"><MessageSquareText size={28} /><strong>Bắt đầu khi bạn sẵn sàng</strong><span>Câu hỏi đầu tiên sẽ xuất hiện tại đây.</span></div>
            </div>
            <div id="page-interview-stt-indicator" className="interview-stt-indicator"><i /><span id="stt-partial-text">Đang nghe...</span></div>
            <form id="page-interview-answer-form" className="interview-answer-form">
              <input id="page-interview-answer-input" placeholder="Trả lời theo cấu trúc STAR…" required />
              <button type="button" id="page-interview-voice" className="interview-mic-button" aria-label="Trả lời bằng giọng nói"><Mic size={20} /></button>
              <button type="submit" className="interview-send-button"><Send size={17} /><span>Gửi</span></button>
            </form>
          </section>
        </div>

        <section className="interview-report-card" id="page-interview-report">
          <header><span className="interview-icon"><BarChart3 size={19} /></span><div><h3>Báo cáo phiên luyện tập</h3><p>Chỉ chấm các nội dung có trong câu trả lời của bạn.</p></div><strong id="page-report-total-score">—</strong></header>
          <div id="page-report-star-breakdown" className="interview-score-breakdown" />
          <div className="interview-report-columns">
            <article><h4><Check size={16} /> Điểm mạnh</h4><ul id="page-report-strengths-list" /></article>
            <article><h4><Star size={16} /> Cần cải thiện</h4><ul id="page-report-improvements-list" /></article>
          </div>
          <article className="interview-recommendations"><h4><Sparkles size={16} /> Gợi ý luyện tập tiếp</h4><ul id="page-report-recommendations-list" /></article>
          <form id="page-interview-csat-form" className="interview-feedback-form"><select id="page-interview-csat" required><option value="">Đánh giá phiên này</option><option value="5">5 — Rất hữu ích</option><option value="4">4 — Hữu ích</option><option value="3">3 — Bình thường</option><option value="2">2 — Chưa tốt</option><option value="1">1 — Không hữu ích</option></select><input id="page-interview-csat-comment" placeholder="Góp ý thêm (tuỳ chọn)" /><button type="submit">Gửi đánh giá</button></form>
        </section>
      </div>
    </section>
  );
}
