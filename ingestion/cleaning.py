import html
import json
import os
import re
import sys
from datetime import datetime
from typing import Any

import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CURRENT_YEAR = datetime.utcnow().year

def strip_html_xml_tags(text: str) -> str:
    """Loại bỏ hoàn toàn các thẻ HTML/XML (như <jats:p>, <b>, <i>, <jats:title>, v.v.) và unescape HTML entities"""
    if not text or not isinstance(text, str):
        return ""
    # Unescape HTML entities (ví dụ: &amp; -> &, &lt; -> <)
    text = html.unescape(text)
    # Match and remove XML/HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_authors(authors_raw: Any) -> str:
    """Gộp list tác giả bị lồng nested trong dict/list thành chuỗi tác giả cách nhau bởi dấu phẩy"""
    if not authors_raw:
        return "Unknown Authors"

    names = []
    if isinstance(authors_raw, str):
        return strip_html_xml_tags(authors_raw)
    elif isinstance(authors_raw, list):
        for author in authors_raw:
            if isinstance(author, dict):
                given = author.get("given", "").strip()
                family = author.get("family", "").strip()
                name = author.get("name", "").strip()

                if given and family:
                    names.append(f"{given} {family}")
                elif family:
                    names.append(family)
                elif given:
                    names.append(given)
                elif name:
                    names.append(name)
            elif isinstance(author, str):
                cleaned_str = strip_html_xml_tags(author)
                if cleaned_str:
                    names.append(cleaned_str)

    return ", ".join(names) if names else "Unknown Authors"

def parse_subjects_keywords(subjects_raw: Any) -> str:
    """Gộp list chủ đề/từ khóa thành chuỗi cách nhau bởi dấu phẩy"""
    if not subjects_raw:
        return "General"

    if isinstance(subjects_raw, str):
        return strip_html_xml_tags(subjects_raw)
    elif isinstance(subjects_raw, list):
        cleaned_list = [strip_html_xml_tags(str(s)) for s in subjects_raw if s]
        return ", ".join([s for s in cleaned_list if s])
    return "General"

def extract_published_year(item: dict[str, Any]) -> int:
    """Trích xuất năm xuất bản từ thông tin date/created/published của Crossref API"""
    # 1. Check published-print or published-online
    for date_key in ["published-print", "published-online", "published", "created", "issued"]:
        date_dict = item.get(date_key)
        if isinstance(date_dict, dict):
            date_parts = date_dict.get("date-parts", [])
            if date_parts and isinstance(date_parts[0], list) and date_parts[0]:
                try:
                    year = int(date_parts[0][0])
                    if 1900 <= year <= CURRENT_YEAR + 1:
                        return year
                except (ValueError, TypeError):
                    pass
        elif isinstance(date_dict, str):
            year_match = re.search(r'\b(19\d{2}|20\d{2})\b', date_dict)
            if year_match:
                return int(year_match.group(1))

    # 2. Check year attribute directly
    if "year" in item:
        try:
            return int(item["year"])
        except (ValueError, TypeError):
            pass

    return CURRENT_YEAR

def calculate_freshness(published_year: int) -> float:
    """Tính toán độ tươi mới (Freshness score từ 0.0 đến 1.0 dựa trên số tuổi của bài báo)"""
    age_years = max(0, CURRENT_YEAR - published_year)
    # Điểm tươi mới: Giảm dần theo thời gian (ví dụ bài báo 0 tuổi = 1.0, 10 tuổi = 0.0)
    score = max(0.0, 1.0 - (age_years / 10.0))
    return round(score, 4)

def clean_crossref_paper_record(item: dict[str, Any]) -> dict[str, Any] | None:
    """Xử lý và làm sạch 1 bản ghi bài báo từ Crossref API"""
    # 1. Trích xuất Tiêu đề
    raw_title = item.get("title")
    if isinstance(raw_title, list) and raw_title:
        raw_title = raw_title[0]
    title = strip_html_xml_tags(str(raw_title)) if raw_title else ""

    # Quy tắc 1: Drop bản ghi không có tiêu đề
    if not title:
        return None

    # 2. Trích xuất Tóm tắt (Abstract)
    raw_abstract = item.get("abstract") or item.get("summary") or ""
    if isinstance(raw_abstract, list) and raw_abstract:
        raw_abstract = raw_abstract[0]
    abstract = strip_html_xml_tags(str(raw_abstract))

    # Quy tắc 1: Drop bản ghi có phần tóm tắt quá ngắn (dưới 100 ký tự)
    if len(abstract) < 100:
        return None

    # 3. Xử lý Tác giả và Chủ đề
    author_names = parse_authors(item.get("author") or item.get("authors"))
    subjects_text = parse_subjects_keywords(item.get("subject") or item.get("keywords") or item.get("subjects"))

    # 4. Tính toán năm xuất bản & Độ tươi mới (Freshness)
    published_year = extract_published_year(item)
    age_years = max(0, CURRENT_YEAR - published_year)
    freshness_score = calculate_freshness(published_year)

    # 5. Tạo cột biểu diễn ngữ nghĩa (embedding_text cho Retrieval / Vector Search)
    doi = item.get("DOI") or item.get("doi") or item.get("id") or ""
    publisher = strip_html_xml_tags(item.get("publisher", ""))

    embedding_text = (
        f"Title: {title} | "
        f"Authors: {author_names} | "
        f"Year: {published_year} | "
        f"Subjects: {subjects_text} | "
        f"Abstract: {abstract}"
    )

    cleaned_record = {
        "paper_id": doi or f"paper_{hash(title) & 0xffffffff:08x}",
        "doi": doi,
        "title": title,
        "author_names": author_names,
        "subjects": subjects_text,
        "published_year": published_year,
        "age_years": age_years,
        "freshness_score": freshness_score,
        "abstract": abstract,
        "abstract_length": len(abstract),
        "publisher": publisher,
        "embedding_text": embedding_text,
        "metadata": {
            "cleaned_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    }

    return cleaned_record

def run_paper_cleaning_pipeline(
    input_file: str = "./data/raw/papers/raw_papers.json",
    output_csv: str = "./data/clean/papers_clean.csv",
    output_json: str = "./data/clean/papers_clean.json"
):
    """Pipeline làm sạch dữ liệu bài báo từ Crossref API và xuất lưu dạng CSV và JSON"""
    raw_records = []

    if os.path.exists(input_file):
        print(f"📖 Đang đọc dữ liệu bài báo thô từ: {input_file}")
        with open(input_file, encoding="utf-8") as f:
            raw_data = json.load(f)
            if isinstance(raw_data, list):
                raw_records = raw_data
            elif isinstance(raw_data, dict) and "message" in raw_data and "items" in raw_data["message"]:
                raw_records = raw_data["message"]["items"]
            elif isinstance(raw_data, dict) and "items" in raw_data:
                raw_records = raw_data["items"]
    else:
        print(f"⚠️ Không tìm thấy file {input_file}. Tiến hành khởi tạo mẫu dữ liệu thử nghiệm...")
        # Sample raw records from Crossref API for validation & demonstration
        raw_records = [
            {
                "DOI": "10.1038/s41586-023-00001-x",
                "title": ["<jats:p><b>Deep Learning Advances in Medical Imaging</b></jats:p>"],
                "author": [{"given": "Yann", "family": "LeCun"}, {"given": "Yoshua", "family": "Bengio"}],
                "abstract": "<jats:p>This comprehensive paper reviews recent breakthroughs in artificial intelligence and deep learning applied to healthcare, medical image segmentation, and diagnostic accuracy across clinical trials worldwide. Our evaluation demonstrates state-of-the-art performance.</jats:p>",
                "subject": ["Artificial Intelligence", "Computer Vision", "Radiology"],
                "published-print": {"date-parts": [[2024, 3, 15]]},
                "publisher": "Nature Publishing Group"
            },
            {
                "DOI": "10.1145/3318464.3389700",
                "title": ["<b>Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks</b>"],
                "author": [{"given": "Patrick", "family": "Lewis"}, {"name": "Ethan Perez"}],
                "abstract": "<p>Large language models possess an astonishing ability to store factual knowledge in their parameters, but their ability to access and precisely manipulate knowledge is still limited. We build a hybrid RAG framework combining dense vector retrieval with generative decoders.</p>",
                "subject": ["Natural Language Processing", "Information Retrieval"],
                "published-online": {"date-parts": [[2023, 8, 20]]},
                "publisher": "ACM"
            },
            {
                "title": [""],
                "abstract": "Short text",
                "author": []
            }
        ]

    cleaned_records = []
    for item in raw_records:
        cleaned = clean_crossref_paper_record(item)
        if cleaned:
            cleaned_records.append(cleaned)

    print(f"🎉 Đã làm sạch thành công {len(cleaned_records)}/{len(raw_records)} bài báo (Loại bỏ {len(raw_records) - len(cleaned_records)} bản ghi rác)!")

    # 6. Lưu trữ vào CSV và JSON
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    os.makedirs(os.path.dirname(output_json), exist_ok=True)

    # Export to JSON
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(cleaned_records, f, ensure_ascii=False, indent=2)

    # Export to CSV (flattening metadata for pandas compatibility)
    df_rows = []
    for rec in cleaned_records:
        row = rec.copy()
        row["cleaned_at"] = row["metadata"]["cleaned_at"]
        del row["metadata"]
        df_rows.append(row)

    df = pd.DataFrame(df_rows)
    df.to_csv(output_csv, index=False, encoding="utf-8-sig")

    print("📁 Dữ liệu bài báo sạch đã được lưu trữ:")
    print(f"   - JSON: {output_json}")
    print(f"   - CSV:  {output_csv}")

if __name__ == "__main__":
    run_paper_cleaning_pipeline()
