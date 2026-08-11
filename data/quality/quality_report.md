# 📊 Data Quality & Observability Report

> **Thời gian tạo báo cáo:** `2026-08-07T03:29:49Z`  
> **Tổng số bản ghi kiểm định:** `91`

---

## 🛡️ 1. Kiểm định Schema Compliance (Pydantic Validator)

| Chỉ số (Metric) | Số lượng bản ghi | Tỷ lệ (%) | Trạng thái |
| :--- | :---: | :---: | :---: |
| **Bản ghi hợp lệ (Schema Valid)** | `91` | `100.0%` | ✅ ĐẠT |
| **Bản ghi vi phạm Schema** | `0` | `0.0%` | - |

---

## 📈 2. Chỉ số Chất lượng Chi tiết (Data Quality Metrics)

| Chỉ số Đánh giá | Bản ghi vi phạm / Thiếu | Tỷ lệ (%) | Mục tiêu tiêu chuẩn | Đánh giá |
| :--- | :---: | :---: | :---: | :---: |
| **Thiếu Tên công ty (`company_name`)** | `0` | `0.0%` | `< 5%` | ✅ XUẤT SẮC |
| **Trống Địa điểm (`location: []`)** | `0` | `0.0%` | `< 5%` | ✅ XUẤT SẮC |
| **Rác/Phình Địa điểm (>3 thành phố)** | `0` | `0.0%` | `0%` | ✅ HOÀN HẢO |
| **Mức lương Thỏa thuận / Default** | `36` | `39.56%` | `< 80%` | ✅ CHẤP NHẬN |
| **Trống Kỹ năng (`skills: []`)** | `3` | `3.3%` | `< 2%` | ❌ NGUY CƠ |

---

## 🌐 3. Phân bố Dữ liệu Theo Nguồn (Source Distribution)

| Nguồn Thu thập (Source) | Số lượng JD | Tỷ lệ (%) |
| :--- | :---: | :---: |
| **LinkedIn** | `36` | `39.6%` |
| **Joboko** | `54` | `59.3%` |
| **ITviec** | `1` | `1.1%` |

---

## 🏷️ 4. Phân bố Dữ liệu Theo Nhóm Ngành (Domain Category)

| Nhóm Ngành (Domain) | Số lượng JD | Tỷ lệ (%) |
| :--- | :---: | :---: |
| **Backend** | `19` | `20.9%` |
| **Frontend** | `27` | `29.7%` |
| **AI/Data** | `19` | `20.9%` |
| **Mobile** | `1` | `1.1%` |
| **QA/QC** | `15` | `16.5%` |
| **DevOps** | `10` | `11.0%` |
