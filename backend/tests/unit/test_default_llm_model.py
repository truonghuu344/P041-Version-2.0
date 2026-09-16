"""Mặc định `model_name` phải là một bản 'lite', không phải bản suy luận nặng.

`settings.model_name` là model dùng chung cho khoảng mười điểm gọi: chấm STAR,
sinh câu hỏi, bóc tách CV, biên tập lời văn phân tích khoảng cách, trợ lý chat,
bóc tách JD, tối ưu CV, OCR dự phòng bằng thị giác.

Mặc định cũ là `gemini-3.5-flash`. Đo ngày 16/09/2026, 3 lượt mỗi ô:

                        3.1-flash-lite  3.5-flash-lite  3.5-flash
    chấm STAR                  1806 ms         1171 ms   21646 ms
    sinh câu hỏi               2085 ms         1651 ms   17873 ms
    bóc tách CV (strict)       2387 ms         2107 ms    7124 ms
    biên tập gap (strict)      3962 ms         3394 ms   13810 ms
    đạt kiểm định                12/12           12/12      12/12

Chậm gấp 3-12 lần mà không đổi lấy được chất lượng đo được nào. Một lượt phỏng
vấn mất ~40 giây với bản cũ so với ~2,8 giây với bản lite — hỏng dùng cho hội
thoại tương tác.

Test này không khoá cứng một tên model cụ thể, vì tên model sẽ đổi theo thời
gian. Nó chỉ chặn việc mặc định lặng lẽ trôi về một bản nặng.
"""

from __future__ import annotations

from src.config import Settings


def test_mac_dinh_dung_ban_lite():
    mac_dinh = Settings.model_fields["model_name"].default

    assert mac_dinh.endswith("-lite"), (
        f"Mặc định model_name là {mac_dinh!r}. Biến này chi phối gần như mọi lời gọi LLM "
        "trong dự án, gồm cả vòng hội thoại phỏng vấn tương tác. Một bản không phải 'lite' "
        "đã từng làm mỗi lượt phỏng vấn mất khoảng 40 giây. Nếu cố ý đổi, hãy đo lại bốn "
        "tác vụ nêu trong docstring rồi cập nhật test này kèm số đo."
    )


def test_model_voice_cung_la_ban_lite_hoac_nhanh_tuong_duong():
    """Voice nhạy cảm với độ trễ hơn cả, nên không được nặng hơn model chung."""
    voice_fallback = Settings.model_fields["voice_llm_fallback_model"].default

    assert voice_fallback.endswith("-lite")
