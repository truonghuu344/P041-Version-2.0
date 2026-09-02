/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase,
  Check,
  CloudUpload,
  FileText,
  Mic,
  Moon,
  PencilLine,
  Search,
  Sun,
  Target,
  Terminal,
  Upload,
  X,
  Navigation,
} from 'lucide-react';


export default function JobsView(props: any) {
  return (
    <>
      <section className="app-view buddy-landing" id="view-jobs">
        <div
          className="buddy-hero-shell"
          style={{ display: 'block', padding: '40px 0', minHeight: 'auto' }}
        >
          <div className="buddy-section-heading" style={{ marginBottom: 32 }}>
            <div>
              <span className="buddy-kicker" style={{ marginBottom: 8 }}>
                <Navigation size={15} /> Bước 1 · Công việc mục tiêu
              </span>
              <h2 id="buddy-journey-title">
                Thêm JD <span>để xác định tiêu chí đối chiếu.</span>
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#607184', fontWeight: 600 }}>
                Chọn JD mẫu hoặc dán JD bạn muốn ứng tuyển
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            <button
              id="page-btn-tab-sys"
              className="buddy-primary-button"
              style={{ padding: '0 24px', height: '44px' }}
            >
              JD Mẫu Hệ Thống
            </button>
            <button
              id="page-btn-tab-cust"
              className="buddy-text-button"
              style={{
                padding: '0 24px',
                height: '44px',
                background: '#fff',
                border: '1px solid #dcece5',
              }}
            >
              Dán JD Tùy Chỉnh
            </button>
          </div>

          <div
            id="page-section-sys-jds"
            className="buddy-template-card"
            style={{ padding: '32px', background: '#fff', borderRadius: '24px' }}
          >
            <div
              id="page-jd-list-container"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '20px',
              }}
            >
              <p style={{ color: '#a0aab2', fontSize: '15px' }}>
                Đang tải danh sách Job Description...
              </p>
            </div>
          </div>

          <div
            id="page-section-cust-jd"
            style={{
              display: 'none',
              gap: '24px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            }}
          >
            {/* Cột 1: File JD */}
            <div
              className="buddy-template-card"
              style={{
                padding: '32px',
                background: '#fff',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    color: 'var(--buddy-navy)',
                    margin: '0 0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Upload color="var(--buddy-emerald)" size={20} /> Tải file JD theo mẫu
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#607184' }}>
                  Hỗ trợ PDF, DOCX hoặc TXT, tối đa 5 MB.
                </p>
              </div>

              <button
                type="button"
                id="page-download-jd-template"
                className="buddy-text-button"
                style={{
                  justifyContent: 'center',
                  background: '#f8faf9',
                  border: '1px solid #dcece5',
                }}
              >
                ⬇ Tải mẫu JD (.txt)
              </button>

              <form
                id="page-upload-jd-form"
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--buddy-navy)',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    Tên vị trí{' '}
                    <span style={{ fontWeight: 400, color: '#7d8a90' }}>(có thể để trống)</span>
                  </label>
                  <input
                    type="text"
                    id="page-upload-jd-title"
                    placeholder="Tự lấy theo tên file"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #dcece5',
                      background: '#f8faf9',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--buddy-navy)',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      Công ty
                    </label>
                    <input
                      type="text"
                      id="page-upload-jd-company"
                      placeholder="Tên doanh nghiệp"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid #dcece5',
                        background: '#f8faf9',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--buddy-navy)',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      Địa điểm
                    </label>
                    <input
                      type="text"
                      id="page-upload-jd-location"
                      placeholder="Hà Nội / Remote"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid #dcece5',
                        background: '#f8faf9',
                      }}
                    />
                  </div>
                </div>

                <label
                  htmlFor="page-upload-jd-file"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '32px 20px',
                    border: '2px dashed #c4d7cd',
                    borderRadius: '16px',
                    background: '#fbfcfc',
                    cursor: 'pointer',
                  }}
                >
                  <CloudUpload color="var(--buddy-emerald)" size={40} />
                  <strong style={{ fontSize: '15px', color: 'var(--buddy-navy)' }}>
                    Chọn file JD đã điền
                  </strong>
                  <span
                    id="page-upload-jd-file-name"
                    style={{ fontSize: '13px', color: '#7d8a90' }}
                  >
                    PDF, DOCX hoặc TXT
                  </span>
                </label>
                <input
                  type="file"
                  id="page-upload-jd-file"
                  accept=".pdf,.docx,.txt"
                  required
                  style={{ display: 'none' }}
                />

                <button
                  type="submit"
                  className="buddy-primary-button"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Tải lên &amp; lưu JD
                </button>
              </form>
            </div>

            {/* Cột 2: Text JD */}
            <div
              className="buddy-template-card"
              style={{
                padding: '32px',
                background: '#fff',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    color: 'var(--buddy-navy)',
                    margin: '0 0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <PencilLine color="var(--buddy-emerald)" size={20} /> Tự điền nội dung JD
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#607184' }}>
                  Nhập hoặc dán mô tả công việc trực tiếp.
                </p>
              </div>

              <form
                id="page-custom-jd-form"
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--buddy-navy)',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    Tên vị trí công việc *
                  </label>
                  <input
                    type="text"
                    id="page-custom-jd-title"
                    placeholder="Ví dụ: Senior Fullstack Developer"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #dcece5',
                      background: '#f8faf9',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--buddy-navy)',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      Tên công ty
                    </label>
                    <input
                      type="text"
                      id="page-custom-jd-company"
                      placeholder="Tech Global Corp"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid #dcece5',
                        background: '#f8faf9',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--buddy-navy)',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      Địa điểm
                    </label>
                    <input
                      type="text"
                      id="page-custom-jd-location"
                      placeholder="TP. Hồ Chí Minh / Hà Nội"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid #dcece5',
                        background: '#f8faf9',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--buddy-navy)',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    Nội dung yêu cầu công việc *
                  </label>
                  <textarea
                    id="page-custom-jd-requirements"
                    placeholder="Dán nội dung chi tiết mô tả công việc, yêu cầu kỹ năng vào đây..."
                    required
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #dcece5',
                      background: '#f8faf9',
                      minHeight: '160px',
                      resize: 'vertical',
                    }}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="buddy-primary-button"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Lưu JD từ nội dung
                </button>
              </form>
            </div>
          </div>
          <nav className="student-job-tabs" role="tablist" aria-label="Việc làm của tôi">
            <button type="button" id="student-jobs-tab-discover" role="tab" aria-selected="true">Khám phá</button>
            <button type="button" id="student-jobs-tab-saved" role="tab" aria-selected="false">Đã lưu</button>
            <button type="button" id="student-jobs-tab-applied" role="tab" aria-selected="false">Đã ứng tuyển</button>
          </nav>
          <section id="student-application-updates" className="application-updates-panel" hidden>
            <div className="application-updates-heading">
              <div>
                <span className="application-updates-kicker">CẬP NHẬT MỚI</span>
                <h3>Tiến trình ứng tuyển</h3>
                <p>Nhà tuyển dụng đã phản hồi về hồ sơ của bạn.</p>
              </div>
              <span className="application-updates-bell" aria-hidden="true">🔔</span>
            </div>
            <div id="student-application-updates-list" className="application-updates-list" />
          </section>
          <section
            id="student-applications-panel"
            className="buddy-template-card"
            style={{ marginTop: '28px', padding: '28px', background: '#fff', borderRadius: '24px' }}
          >
            <h3 style={{ marginTop: 0 }}>Đơn ứng tuyển của bạn</h3>
            <p style={{ color: '#607184' }}>
              Khi nhà tuyển dụng kết thúc quy trình, bạn có thể đánh giá bằng sao và gửi phản hồi.
            </p>
            <div id="student-applications-list" />
          </section>
        </div>
      </section>
    </>
  );
}
