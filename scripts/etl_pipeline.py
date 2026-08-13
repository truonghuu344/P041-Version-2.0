import pandas as pd
import os
import re
import unicodedata
from pathlib import Path
from sqlalchemy import create_engine

# Thiết lập đường dẫn
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
RAW_DIR = DATA_DIR / 'raw'
CLEAN_DIR = DATA_DIR / 'clean'
PDF_DIR = RAW_DIR / 'pdfs'

# Đảm bảo các thư mục cần thiết tồn tại
CLEAN_DIR.mkdir(parents=True, exist_ok=True)
PDF_DIR.mkdir(parents=True, exist_ok=True)

# Database config (PostgreSQL) - thay đổi theo môi trường thực tế
DB_USER = os.getenv('DB_USER', 'user')
DB_PASS = os.getenv('DB_PASS', 'password')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'ats_db')
DB_URI = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def normalize_text(text):
    if pd.isna(text):
        return ""
    # Chuyển về string
    text = str(text)
    # Loại bỏ HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Loại bỏ ký tự thừa, nhiều dấu cách liên tiếp
    text = re.sub(r'\s+', ' ', text).strip()
    # Chuẩn hóa Unicode (NFC)
    text = unicodedata.normalize('NFC', text)
    return text

def process_jds():
    print("Đang xử lý Job Descriptions...")
    jd_file = RAW_DIR / 'vietnam_it_job_posts.csv'
    if not jd_file.exists():
        print(f"File {jd_file} không tồn tại.")
        return None
    
    df = pd.read_csv(jd_file)
    
    # Chỉ lấy các dòng có đủ thông tin quan trọng
    # Giả định cột: title, company, location, requirements, skills
    required_cols = ['title', 'company', 'requirements', 'skills']
    
    # Check if these columns exist
    existing_cols = [col for col in required_cols if col in df.columns]
    
    # Dropna cho các cột cần thiết
    df = df.dropna(subset=existing_cols)
    
    # Lấy 100 mẫu
    df_sample = df.head(100).copy()
    
    # Normalize text columns
    for col in existing_cols:
        df_sample[col] = df_sample[col].apply(normalize_text)
        
    out_path = CLEAN_DIR / 'jd_100_clean.csv'
    df_sample.to_csv(out_path, index=False)
    print(f"Đã lưu 100 JD sạch vào {out_path}")
    return df_sample

def process_cvs_from_csv():
    print("Đang xử lý CVs từ file CSV...")
    cv_file = RAW_DIR / 'resume_dataset_1200.csv'
    if not cv_file.exists():
        print(f"File {cv_file} không tồn tại.")
        return None
        
    df = pd.read_csv(cv_file)
    
    # Chọn 100 mẫu
    df_sample = df.head(100).copy()
    
    # Chuẩn hóa các cột văn bản
    text_cols = ['Skills', 'Target_Job_Description', 'Previous_Job_Titles', 'Field_of_Study']
    for col in text_cols:
        if col in df_sample.columns:
            df_sample[col] = df_sample[col].apply(normalize_text)
            
    out_path = CLEAN_DIR / 'cv_100_clean.csv'
    df_sample.to_csv(out_path, index=False)
    print(f"Đã lưu 100 CV sạch vào {out_path}")
    return df_sample

def parse_pdf_cvs():
    """
    Hàm mẫu (stub) để trích xuất văn bản từ CV định dạng PDF,
    hỗ trợ Unstructured / PyPDF và OCR cho hình ảnh.
    """
    print("Đang quét thư mục PDF CVs...")
    pdf_files = list(PDF_DIR.rglob('*.pdf'))
    if not pdf_files:
        print("Không tìm thấy file PDF nào.")
        return
        
    # Giới hạn xử lý 40 file PDF (10 file mỗi thư mục) để tránh script chạy quá lâu
    # Bạn có thể tăng/giảm con số này tùy ý
    import random
    if len(pdf_files) > 40:
        random.shuffle(pdf_files)
        pdf_files = pdf_files[:40]
        print(f"Đã lấy ngẫu nhiên 40 file PDF từ các ngành nghề để xử lý...")
        
    try:
        from unstructured.partition.pdf import partition_pdf
        # Note: Unstructured tự động nhận diện nếu PDF là dạng ảnh (cần Tesseract OCR)
        # và phân tách layout, bảng biểu.
        
        parsed_cvs = []
        for pdf_path in pdf_files:
            print(f"Đang phân tích: {pdf_path.name}")
            elements = partition_pdf(filename=str(pdf_path), strategy="hi_res")
            text = "\n".join([str(el) for el in elements])
            parsed_cvs.append({
                "filename": pdf_path.name,
                "content": normalize_text(text)
            })
            
        if parsed_cvs:
            df_pdfs = pd.DataFrame(parsed_cvs)
            out_path = CLEAN_DIR / 'cv_pdfs_clean.csv'
            df_pdfs.to_csv(out_path, index=False)
            print(f"Đã lưu kết quả parse PDF vào {out_path}")
            
    except ImportError:
        print("Chưa cài đặt thư viện 'unstructured'. Vui lòng chạy: pip install unstructured")
        print("Nếu muốn OCR, cần cài đặt thêm Tesseract và poppler trên hệ thống.")

def load_to_postgres(df_jds, df_cvs):
    if df_jds is None and df_cvs is None:
        print("Không có dữ liệu để load vào DB.")
        return
        
    try:
        engine = create_engine(DB_URI)
        print("Kết nối database thành công.")
        
        if df_jds is not None:
            df_jds.to_sql('raw_jds', engine, if_exists='replace', index=False)
            print("Đã tải Job Descriptions vào bảng raw_jds.")
            
        if df_cvs is not None:
            df_cvs.to_sql('raw_cvs', engine, if_exists='replace', index=False)
            print("Đã tải CVs vào bảng raw_cvs.")
            
    except Exception as e:
        print(f"Không thể kết nối đến PostgreSQL: {e}")
        print("Bỏ qua bước Load to DB. Vui lòng đảm bảo Database đang chạy.")

def main():
    print("--- Bắt đầu ETL Pipeline ---")
    df_jds = process_jds()
    df_cvs = process_cvs_from_csv()
    parse_pdf_cvs()
    
    print("\n--- Bắt đầu Load vào PostgreSQL ---")
    load_to_postgres(df_jds, df_cvs)
    print("--- Hoàn thành ETL Pipeline ---")

if __name__ == "__main__":
    main()
