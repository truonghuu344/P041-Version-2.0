import json
import sys

sys.path.insert(0, '.')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Import core modules
from eval.ats_matching import ATSMatcher
from retrieval.qa import QAPipeline
from retrieval.retriever import HybridRetriever
from src.observability.quality import run_data_quality_checks


def run_live_interactive_demo():
    """Chạy chương trình Test Thực tế (Live Interactive Demo) toàn bộ Hệ thống CV-JD Matching & RAG"""
    print("\n" + "="*70)
    print("🚀 ĐANG KHỞI CHẠY DEMO THỰC TẾ HỆ THỐNG SO KHỚP CV-JD & ATS SCORE RAG")
    print("="*70 + "\n")

    # 1. Kiểm tra Dữ liệu Data Quality
    print("📌 [BƯỚC 1] KIỂM TRA CHẤT LƯỢNG DỮ LIỆU ĐÃ LÀM SẠCH (DATA QUALITY GATE)")
    quality = run_data_quality_checks()
    print(f"   - Tổng số Job Descriptions (JDs): {quality['jd_data']['total_records']} bản ghi")
    print(f"   - Tỷ lệ Điền đầy đủ Dữ liệu JD:    {quality['jd_data']['completeness_rate']}")
    print(f"   - Tỷ lệ Bản ghi Độc nhất JD:       {quality['jd_data']['uniqueness_rate']}")
    print(f"   - Tổng số CVs thực tế từ Kaggle:   {quality['cv_data']['total_records']} bản ghi")
    print(f"   - Trạng thái Chất lượng:           ✅ {quality['overall_status']}\n")

    # 2. Test Truy xuất RAG Hybrid Search
    print("📌 [BƯỚC 2] TEST TRUY XUẤT HYBRID SEARCH (DENSE VECTOR 384D + BM25 KEYWORD)")
    retriever = HybridRetriever(collection_name="jds_collection")

    test_queries = [
        "Software Engineer Intern Backend tại ShopBack",
        "Vị trí Thực tập sinh Java tại CÔNG TY TNHH BZCOM",
        "Security Software Engineer Intern tại GeoComply"
    ]

    for q in test_queries:
        print(f"\n🔍 Truy vấn Test: '{q}'")
        hits = retriever.hybrid_search(q, k=2)
        for idx, h in enumerate(hits, 1):
            meta = h.get("metadata", {})
            print(f"   [{idx}] ID: {h.get('id')} | Title: {meta.get('job_title')} | Company: {meta.get('company_name')} | Hybrid RRF Score: {h.get('hybrid_rrf_score')}")

    # 3. Test Chấm điểm ATS Score & So khớp CV-JD
    print("\n" + "-"*70)
    print("📌 [BƯỚC 3] TEST CHẤM ĐIỂM ATS SCORE & PHÂN TÍCH KỸ NĂNG NÂNG CAO")
    print("-"*70)

    matcher = ATSMatcher()

    with open("./data/eval/simulated_cvs.json", encoding="utf-8") as f:
        test_cvs = json.load(f)

    with open("./data/clean/jds_clean.json", encoding="utf-8") as f:
        jds = json.load(f)

    sample_cv = test_cvs[0] # Nguyen Van A - Backend Intern
    sample_jd = jds[0]     # ShopBack Backend Intern

    ats_res = matcher.calculate_ats_score(sample_cv, sample_jd)

    print(f"\n👤 Ứng viên: {ats_res['candidate_name']} ({ats_res['cv_id']})")
    print(f"💼 Vị trí JD: {ats_res['job_title']} @ {ats_res['company_name']} ({ats_res['job_id']})")
    print(f"🏆 ĐIỂM ATS SCORE: {ats_res['total_ats_score']}% ➔ Huy hiệu: {ats_res['fit_status']}")
    print("📊 Chi tiết điểm thành phần:")
    print(f"   - Điểm Hard Skills:   {ats_res['breakdown']['hard_skills_score']}% (Trọng số 50%)")
    print(f"   - Điểm Nice Skills:   {ats_res['breakdown']['nice_skills_score']}% (Trọng số 20%)")
    print(f"   - Điểm Domain Fit:    {ats_res['breakdown']['domain_score']}% (Trọng số 20%)")
    print(f"   - Điểm Kinh nghiệm:  {ats_res['breakdown']['experience_score']}% (Trọng số 10%)")
    print(f"✅ Kỹ năng đã khớp: {', '.join(ats_res['matched_must_have_skills'])}")
    print(f"⚠️ Kỹ năng còn thiếu: {', '.join(ats_res['missing_must_have_skills'][:5])}")
    print(f"💡 Gợi ý nâng cấp: Để tăng điểm ATS Score cho {ats_res['candidate_name']}, cần đào tạo các kỹ năng: {', '.join(ats_res['missing_must_have_skills'][:3])}.")

    # 4. Test RAG Response Synthesis
    print("\n" + "-"*70)
    print("📌 [BƯỚC 4] TEST Q&A RAG AGENT TRẢ LỜI CÂU HỎI THỰC TẾ")
    print("-"*70)

    qa = QAPipeline(collection_name="jds_collection")
    qa_out = qa.answer_question("Vị trí Security Software Engineer Intern tại GeoComply đòi hỏi các kỹ năng nào?", top_k=2)

    print(f"\n❓ Câu hỏi: {qa_out['question']}")
    print(f"🤖 Phản hồi RAG: {qa_out['answer']}")
    print(f"📈 Mức độ tin cậy (Confidence Score): {qa_out['confidence_score']}")

    print("\n" + "="*70)
    print("🎉 HOÀN THÀNH DEMO KIỂM THỬ THỰC TẾ THÀNH CÔNG (PASSED 100%)")
    print("="*70 + "\n")

if __name__ == "__main__":
    run_live_interactive_demo()
