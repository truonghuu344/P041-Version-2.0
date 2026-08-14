import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  Clock3,
  Ear,
  FileText,
  Languages,
  MessageSquareText,
  Mic,
  Play,
  Send,
  Sparkles,
  Star,
  Volume2,
} from 'lucide-react';

export default function InterviewView() {
  return (
    <section className="app-view buddy-landing interview-workspace" id="view-interview">
      <div className="interview-shell">
        <header className="interview-page-header">
          <h2>Phỏng vấn bằng <span>giọng nói</span></h2>
          <p>Career Buddy sẽ hỏi, bạn trả lời bằng giọng nói. Phản hồi STAR chỉ dựa trên nội dung bạn thực sự nói.</p>
        </header>

        <div className="interview-layout">
          <aside className="interview-sidebar">
            <section className="interview-setup-card" id="page-interview-setup">
              <div className="interview-card-heading">
                <span className="interview-icon"><Play size={18} /></span>
                <div><h3>Thiết lập phiên phỏng vấn</h3><p>Chọn CV, vị trí và thời lượng phù hợp.</p></div>
              </div>

              <div className="interview-form-grid">
                <label className="interview-field interview-field-wide"><span><FileText size={15} /> CV của bạn</span><select id="page-interview-select-cv"><option value="">Chọn CV đã lưu</option></select></label>
                <label className="interview-field interview-field-wide"><span><BriefcaseBusiness size={15} /> Vị trí ứng tuyển</span><select id="page-interview-select-jd"><option value="">Chọn JD đã lưu</option></select></label>
                <label className="interview-field"><span>Kiểu câu hỏi</span><select id="interview-mode"><option value="MIXED">Hỗn hợp</option><option value="TECHNICAL">Chuyên môn</option><option value="BEHAVIORAL">Hành vi</option></select></label>
                <label className="interview-field"><span><Languages size={15} /> Ngôn ngữ</span><select id="interview-language"><option value="FOLLOW_CANDIDATE">Theo ứng viên</option><option value="VI">Tiếng Việt</option><option value="EN">Tiếng Anh</option></select></label>
                <label className="interview-field interview-field-wide"><span><Clock3 size={15} /> Thời lượng</span><select id="interview-duration"><option value="15">15 phút</option><option value="30" defaultValue="30">30 phút</option><option value="45">45 phút</option><option value="60">60 phút</option></select></label>
              </div>

              <div className="interview-setup-note"><Sparkles size={15} /><span>Voice được chuyển thành transcript. Bạn luôn có thể chỉnh sửa câu trả lời trước khi gửi.</span></div>
              <button id="page-btn-start-interview" className="interview-start-button"><Mic size={18} /> Bắt đầu phỏng vấn</button>
              <p className="interview-start-hint">Nhấn Enter để bắt đầu khi đã chọn CV và vị trí.</p>
            </section>

            <section className="interview-guide-card" aria-labelledby="interview-guide-title">
              <h3 id="interview-guide-title">Hướng dẫn nhanh</h3>
              <ul>
                <li><span><Volume2 size={16} /></span>AI đọc câu hỏi bằng giọng nói.</li>
                <li><span><Mic size={16} /></span>Bạn trả lời tự nhiên bằng giọng nói.</li>
                <li><span><Ear size={16} /></span>AI lắng nghe và đặt câu hỏi tiếp theo.</li>
              </ul>
            </section>
          </aside>

          <section className="interview-live-card" id="page-interview-chat">
            <header className="interview-live-header">
              <div className="interview-live-progress"><strong id="page-interview-progress-text">Câu hỏi 1 / 5</strong><span className="interview-progress-track"><i id="page-interview-progress-bar" /></span></div>
              <span className="interview-live-status"><Clock3 size={16} /> <span id="page-interview-timer">00:00 / 15:00</span></span>
              <button className="interview-end-session" type="button" disabled title="Phiên được hoàn tất sau câu trả lời cuối cùng">Kết thúc</button>
            </header>
            <div id="page-interview-chat-history" className="interview-chat-history">
              <div className="interview-empty-chat"><MessageSquareText size={28} /><strong>Bắt đầu khi bạn sẵn sàng</strong><span>Câu hỏi đầu tiên sẽ xuất hiện tại đây.</span></div>
            </div>
            <div id="page-interview-stt-indicator" className="interview-stt-indicator"><i /><span id="stt-partial-text">Đang nghe...</span></div>
            <div className="interview-voice-stage">
              <strong>Bạn đang trả lời...</strong>
              <div className="interview-voice-control"><span className="interview-wave-side" aria-hidden="true">······</span><button type="button" id="page-interview-voice" className="interview-mic-button" aria-label="Bắt đầu trả lời bằng giọng nói"><Mic size={32} /></button><span className="interview-wave-side" aria-hidden="true">······</span></div>
              <span id="page-interview-voice-time">00:00</span>
              <p>AI sẽ lắng nghe câu trả lời của bạn.</p>
            </div>
            <form id="page-interview-answer-form" className="interview-answer-form">
              <input id="page-interview-answer-input" placeholder="Hoặc nhập câu trả lời theo cấu trúc STAR…" />
              <button type="submit" className="interview-send-button"><Send size={17} /><span>Kết thúc trả lời</span></button>
            </form>
          </section>
        </div>

        <section className="interview-report-card" id="page-interview-report">
          <header><span className="interview-icon"><BarChart3 size={19} /></span><div><h3>Báo cáo phiên luyện tập</h3><p>Chỉ chấm các nội dung có trong câu trả lời của bạn.</p></div><strong id="page-report-total-score">—</strong></header>
          <div id="page-report-star-breakdown" className="interview-score-breakdown" />
          <div className="interview-report-columns"><article><h4><Check size={16} /> Điểm mạnh</h4><ul id="page-report-strengths-list" /></article><article><h4><Star size={16} /> Cần cải thiện</h4><ul id="page-report-improvements-list" /></article></div>
          <article className="interview-recommendations"><h4><Sparkles size={16} /> Gợi ý luyện tập tiếp</h4><ul id="page-report-recommendations-list" /></article>
          <form id="page-interview-csat-form" className="interview-feedback-form"><select id="page-interview-csat" required><option value="">Đánh giá phiên này</option><option value="5">5 — Rất hữu ích</option><option value="4">4 — Hữu ích</option><option value="3">3 — Bình thường</option><option value="2">2 — Chưa tốt</option><option value="1">1 — Không hữu ích</option></select><input id="page-interview-csat-comment" placeholder="Góp ý thêm (tuỳ chọn)" /><button type="submit">Gửi đánh giá</button></form>
        </section>
      </div>
    </section>
  );
}
