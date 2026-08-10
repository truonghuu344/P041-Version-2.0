# 🗄️ Sơ đồ Cơ sở Dữ liệu (Database ERD Diagram)
> **Career Assistant X System - Relational Database Schema Specifications**

## 1. Sơ đồ ERD (Entity Relationship Diagram)

Sơ đồ ERD thể hiện mối quan hệ giữa 11 bảng cơ sở dữ liệu chính trong hệ thống PostgreSQL 16.

```mermaid
erDiagram
    users ||--o| students : "1 : 1 (ma_nguoi_dung)"
    users ||--o| counselors : "1 : 1 (ma_nguoi_dung)"
    users ||--o| enterprises : "1 : 1 (ma_nguoi_dung)"

    counselors ||--o{ counselor_feedbacks : "1 : N (ma_co_van)"
    students ||--o{ counselor_feedbacks : "1 : N (ma_sinh_vien)"

    students ||--o{ resumes : "1 : N (ma_sinh_vien)"
    enterprises ||--o{ job_descriptions : "1 : N (ma_doanh_nghiep)"

    resumes ||--o{ cv_jd_matches : "1 : N (ma_cv)"
    job_descriptions ||--o{ cv_jd_matches : "1 : N (ma_jd)"

    students ||--o{ interview_sessions : "1 : N (ma_sinh_vien)"
    interview_sessions ||--o{ interview_qa_logs : "1 : N (ma_phien_pv)"
    interview_sessions ||--o| evaluation_reports : "1 : 1 (ma_phien_pv)"

    users {
        uuid ma_nguoi_dung PK
        varchar email UK
        varchar mat_khau_hash
        varchar ho_ten
        varchar vai_tro
        timestamp ngay_tao
    }

    students {
        uuid ma_sinh_vien PK
        uuid ma_nguoi_dung FK
        varchar truong_dai_hoc
        varchar chuyen_nganh
        int nam_tot_nghiep
        varchar so_dien_thoai
    }

    counselors {
        uuid ma_co_van PK
        uuid ma_nguoi_dung FK
        varchar phong_ban
        varchar chuc_danh
    }

    enterprises {
        uuid ma_doanh_nghiep PK
        uuid ma_nguoi_dung FK
        varchar ten_cong_ty
        varchar linh_vuc
        varchar website_url
    }

    resumes {
        uuid ma_cv PK
        uuid ma_sinh_vien FK
        varchar tieu_de_cv
        varchar template_id
        varchar duong_dan_file_goc
        jsonb du_lieu_trich_xuat_json
        jsonb accepted_suggestions_json
        jsonb missing_info_json
        boolean is_verified_real
    }

    counselor_feedbacks {
        uuid ma_feedback PK
        uuid ma_co_van FK
        uuid ma_sinh_vien FK
        uuid ma_phien_pv FK
        uuid ma_bao_cao FK
        text feedback_text
        text assigned_task
        timestamp created_at
    }

    job_descriptions {
        uuid ma_jd PK
        uuid ma_doanh_nghiep FK
        varchar vi_tri_tuyen_dung
        text mo_ta_cong_viec
        varchar source_type
        varchar vector_id
    }

    cv_jd_matches {
        uuid ma_so_khop PK
        uuid ma_cv FK
        uuid ma_jd FK
        float diem_match_score
        float ats_score
        jsonb missing_skills_json
        jsonb guardrail_flags_json
    }

    interview_sessions {
        uuid ma_phien_pv PK
        uuid ma_sinh_vien FK
        uuid ma_cv FK
        uuid ma_jd FK
        int tong_so_cau_hoi
        int current_step
        varchar trang_thai
        float diem_tong_ket
        int csat_score
        text csat_feedback
    }

    interview_qa_logs {
        uuid ma_nhat_ky PK
        uuid ma_phien_pv FK
        int so_thu_tu_cau_hoi
        text question_text
        text student_answer
        text situation_text
        text task_text
        text action_text
        text result_text
        boolean is_followup_required
    }

    evaluation_reports {
        uuid ma_bao_cao PK
        uuid ma_phien_pv FK
        float diem_tong_ket
        jsonb star_scores_json
        jsonb detailed_feedbacks_json
        text counselor_notes
        text disclaimer_text
    }
```

---

## 2. Chi tiết Danh mục Bảng Cơ sở Dữ liệu

| STT | Tên Bảng (`table_name`) | Mô tả Chức năng | Các Trường Khóa |
|---|---|---|---|
| 1 | `nguoi_dung` (`users`) | Tài khoản người dùng chung trong hệ thống | `ma_nguoi_dung` (PK), `email` (UK) |
| 2 | `sinh_vien` (`students`) | Thông tin hồ sơ sinh viên | `ma_sinh_vien` (PK), `ma_nguoi_dung` (FK) |
| 3 | `co_van` (`counselors`) | Thông tin hồ sơ cố vấn hướng nghiệp | `ma_co_van` (PK), `ma_nguoi_dung` (FK) |
| 4 | `doanh_nghiep` (`enterprises`) | Thông tin hồ sơ nhà tuyển dụng | `ma_doanh_nghiep` (PK), `ma_nguoi_dung` (FK) |
| 5 | `ho_so_cv` (`resumes`) | Danh sách CV, mẫu template ATS & dữ liệu trích xuất | `ma_cv` (PK), `ma_sinh_vien` (FK) |
| 6 | `counselor_feedbacks` | Phản hồi & bài tập cá nhân hóa do cố vấn gửi | `ma_feedback` (PK), `ma_co_van` (FK), `ma_sinh_vien` (FK) |
| 7 | `bai_tuyen_dung` (`job_descriptions`) | Danh sách công việc tuyển dụng và vector ID | `ma_jd` (PK), `ma_doanh_nghiep` (FK) |
| 8 | `ket_qua_so_khop` (`cv_jd_matches`) | Kết quả so khớp giữa CV và JD (Match %, ATS %, Gap) | `ma_so_khop` (PK), `ma_cv` (FK), `ma_jd` (FK) |
| 9 | `phien_phong_van` (`interview_sessions`) | Phiên phỏng vấn thử AI & khảo sát CSAT (1-5★) | `ma_phien_pv` (PK), `ma_sinh_vien` (FK) |
| 10 | `nhat_ky_hoi_dap` (`interview_qa_logs`) | Nhật ký từng câu hỏi, phản hồi STAR & cờ follow-up | `ma_nhat_ky` (PK), `ma_phien_pv` (FK) |
| 11 | `bao_cao_danh_gia` (`evaluation_reports`) | Báo cáo kết quả phỏng vấn tổng hợp & ý kiến cố vấn | `ma_bao_cao` (PK), `ma_phien_pv` (FK) |
