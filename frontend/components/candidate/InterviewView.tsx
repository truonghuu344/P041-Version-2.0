import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  FileText,
  Languages,
  ListChecks,
  MessageSquareText,
  Mic,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Target,
  Upload,
} from 'lucide-react';


export default function InterviewView() {
  return (
    <section className="app-view buddy-landing interview-workspace" id="view-interview">
      <div className="interview-shell">
        <header className="interview-page-header">
          <h2>
            Phỏng vấn bằng <span>giọng nói</span>
          </h2>
          <p>
            Career Buddy sẽ hỏi, bạn trả lời bằng giọng nói. Phản hồi STAR chỉ dựa trên nội dung bạn
            thực sự nói.
          </p>
        </header>

        <div className="interview-layout">
          <aside className="interview-sidebar">
            <section className="interview-setup-card" id="page-interview-setup">
              <div className="interview-card-heading">
                <span className="interview-icon">
                  <Play size={18} />
                </span>
                <div>
                  <h3>Thiết lập phiên phỏng vấn</h3>
                  <p>Chọn CV và vị trí ứng tuyển để bắt đầu.</p>
                </div>
              </div>

              <div className="interview-form-grid">
                <label className="interview-field interview-field-wide">
                  <span>
                    <FileText size={15} /> CV của bạn
                  </span>
                  <div className="interview-cv-row">
                    <select id="page-interview-select-cv">
                      <option value="">Chọn CV đã lưu</option>
                    </select>
                    <button
                      type="button"
                      id="page-interview-upload-cv-btn"
                      className="interview-upload-cv-btn"
                      title="Tải lên CV mới"
                    >
                      <Upload size={15} />
                    </button>
                    <input
                      type="file"
                      id="page-interview-upload-cv-input"
                      accept=".pdf,.doc,.docx"
                      hidden
                    />
                  </div>
                </label>
                <label className="interview-field interview-field-wide">
                  <span>
                    <BriefcaseBusiness size={15} /> Vị trí ứng tuyển
                  </span>
                  <select id="page-interview-select-jd">
                    <option value="">Chọn JD đã lưu</option>
                  </select>
                </label>
                <label className="interview-field interview-field-wide">
                  <span>
                    <Languages size={15} /> Ngôn ngữ phỏng vấn
                  </span>
                  <select id="interview-language">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">Tiếng Anh</option>
                  </select>
                </label>
              </div>

              <div className="interview-setup-note">
                <Target size={15} />
                <span>
                  Voice được chuyển thành transcript. Bạn luôn có thể chỉnh sửa câu trả lời trước
                  khi gửi.
                </span>
              </div>

              <button id="page-btn-start-interview" className="interview-start-button">
                <Mic size={18} /> Bắt đầu phỏng vấn
              </button>
              <p className="interview-start-hint">
                Nhấn Enter để bắt đầu khi đã chọn CV và vị trí.
              </p>
            </section>

          <section
            className="interview-agenda-card"
            id="page-interview-agenda"
            aria-labelledby="interview-agenda-title"
            hidden
          >
            <header className="interview-agenda-header">
              <div className="interview-agenda-heading">
                <span className="interview-icon">
                  <ListChecks size={18} />
                </span>
                <div>
                  <h3 id="interview-agenda-title">Bộ câu hỏi cho vị trí này</h3>
                  <p id="page-interview-agenda-meta">—</p>
                </div>
              </div>
              <button
                type="button"
                id="page-interview-agenda-regenerate-btn"
                className="interview-agenda-regenerate-btn"
                hidden
              >
                <RefreshCw size={14} /> Sinh lại
              </button>
            </header>

            <div id="page-interview-agenda-create-row" className="interview-agenda-create-row" hidden>
              <p>Chưa có bộ câu hỏi cho cặp CV và JD này.</p>
              <button
                type="button"
                id="page-interview-agenda-create-btn"
                className="interview-agenda-create-btn"
              >
                <Sparkles size={15} /> Tạo bộ câu hỏi
              </button>
            </div>

            <div id="page-interview-agenda-loading" className="interview-agenda-loading" hidden>
              <span className="interview-agenda-spinner" aria-hidden="true" />
              <span>Đang sinh bộ câu hỏi, có thể mất vài giây...</span>
            </div>

            <div id="page-interview-agenda-filters" className="interview-agenda-filters" hidden></div>

            <ul id="page-interview-agenda-list" className="interview-agenda-list" hidden></ul>
          </section>
          </aside>


          <section className="interview-live-card" id="page-interview-chat">
            <header className="interview-live-header">
              <div className="interview-live-progress">
                <strong id="page-interview-progress-text">Câu hỏi 1 / 5</strong>
                <span className="interview-progress-track">
                  <i id="page-interview-progress-bar" />
                </span>
              </div>
              <span className="interview-live-status">
                <span id="page-interview-timer">00:00 / 10:00</span>
              </span>
            </header>
            <div id="page-interview-chat-history" className="interview-chat-history">
              <div className="interview-empty-chat">
                <MessageSquareText size={28} />
                <strong>Bắt đầu khi bạn sẵn sàng</strong>
                <span>Câu hỏi đầu tiên sẽ xuất hiện tại đây.</span>
              </div>
            </div>
            <div id="page-interview-stt-indicator" className="interview-stt-indicator">
              <i />
              <span id="stt-partial-text">Đang nghe...</span>
            </div>
            <div className="interview-voice-stage">
              <strong>Bạn đang trả lời...</strong>
              <div className="interview-voice-control">
                <span className="interview-wave-side" aria-hidden="true">
                  ······
                </span>
                <button
                  type="button"
                  id="page-interview-voice"
                  className="interview-mic-button"
                  aria-label="Bắt đầu trả lời bằng giọng nói"
                >
                  <Mic size={32} />
                </button>
                <span className="interview-wave-side" aria-hidden="true">
                  ······
                </span>
              </div>
              <span id="page-interview-voice-time">00:00</span>
              <p>AI sẽ lắng nghe câu trả lời của bạn.</p>
            </div>
            <form id="page-interview-answer-form" className="interview-answer-form">
              <input
                id="page-interview-answer-input"
                placeholder="Không có mic? Nhập câu trả lời tại đây…"
              />
              <button type="submit" className="interview-send-button">
                <Send size={17} />
                <span>Kết thúc trả lời</span>
              </button>
              <button
                className="interview-end-session"
                type="button"
                disabled
                title="Kết thúc phiên phỏng vấn"
              >
                Kết thúc
              </button>
            </form>
          </section>
        </div>
        <section className="interview-report-card" id="page-interview-report">
          <header>
            <span className="interview-icon">
              <BarChart3 size={19} />
            </span>
            <div>
              <h3>Báo cáo phiên luyện tập</h3>
              <p>Chỉ chấm các nội dung có trong câu trả lời của bạn.</p>
            </div>
            <strong id="page-report-total-score">—</strong>
          </header>

          <article className="interview-star-criteria">
            <h4>
              <Target size={16} /> Tiêu chí chấm điểm — Phương pháp STAR
            </h4>
            <p>
              Mỗi câu trả lời được chấm theo 4 thành phần STAR (0–100 điểm mỗi phần). AI chỉ chấm
              những gì bạn thực sự nói — không bịa thêm, không giả định.
            </p>
            <div className="interview-star-grid">
              <div className="interview-star-item" data-star="S">
                <strong>S — Situation</strong>
                <span>Bối cảnh: Bạn đã mô tả tình huống, dự án, thời điểm chưa?</span>
              </div>
              <div className="interview-star-item" data-star="T">
                <strong>T — Task</strong>
                <span>Nhiệm vụ: Vai trò và trách nhiệm cụ thể của bạn là gì?</span>
              </div>
              <div className="interview-star-item" data-star="A">
                <strong>A — Action</strong>
                <span>Hành động: Bạn đã trực tiếp làm gì để giải quyết vấn đề?</span>
              </div>
              <div className="interview-star-item" data-star="R">
                <strong>R — Result</strong>
                <span>Kết quả: Đạt được gì? Có số liệu cụ thể không (%, số lượng)?</span>
              </div>
            </div>
          </article>

          <div id="page-report-star-breakdown" className="interview-score-breakdown" />
          <div className="interview-report-columns">
            <article>
              <h4>
                <Check size={16} /> Điểm mạnh
              </h4>
              <ul id="page-report-strengths-list" />
            </article>
            <article>
              <h4>
                <Star size={16} /> Cần cải thiện
              </h4>
              <ul id="page-report-improvements-list" />
            </article>
          </div>
          <article className="interview-recommendations">
            <h4>
              <Target size={16} /> Gợi ý luyện tập tiếp
            </h4>
            <ul id="page-report-recommendations-list" />
          </article>

          <form id="page-interview-csat-form" className="interview-feedback-form">
            <select id="page-interview-csat" required>
              <option value="">Đánh giá phiên này</option>
              <option value="5">5 — Rất hữu ích</option>
              <option value="4">4 — Hữu ích</option>
              <option value="3">3 — Bình thường</option>
              <option value="2">2 — Chưa tốt</option>
              <option value="1">1 — Không hữu ích</option>
            </select>
            <input id="page-interview-csat-comment" placeholder="Góp ý thêm (tuỳ chọn)" />
            <button type="submit">Gửi đánh giá</button>
          </form>
        </section>
      </div>
    </section>
  );
}
