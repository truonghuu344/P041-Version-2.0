"""Báo cáo phỏng vấn không được nhờ LLM tính lại điểm đã có.

`generate_report_node` ghi đè `total_score` và `star_scores` bằng giá trị tính
tất định từ điểm từng câu. Nhưng prompt cũ vẫn bảo LLM *"Trả về JSON gồm
total_score, star_scores, ..."* và gửi kèm điểm từng câu — tức là trả tiền và
trả thời gian cho những con số bị vứt đi ngay sau đó.

Đo trên cùng bộ dữ liệu (3 cặp hỏi đáp, `gemini-3.1-flash-lite`):

    xin cả điểm      2514 ms, ~425 token đầu ra
    chỉ xin nhận xét 1642 ms, ~185 token đầu ra

Nhanh hơn 35%. Test ở đây khoá lại điều đó để prompt không lặng lẽ trôi ngược.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from src.agents.nodes import interview_nodes


class _GhiLaiLoiGoi:
    """LLM giả, ghi lại prompt và payload thay vì gọi mạng."""

    da_goi: dict[str, str] = {}

    def __init__(self, **_kwargs):
        pass

    async def ainvoke(self, messages):
        _GhiLaiLoiGoi.da_goi = {
            "system": messages[0].content,
            "human": messages[1].content,
        }
        return SimpleNamespace(
            content=json.dumps(
                {
                    "strengths": ["Trình bày kết quả có số liệu."],
                    "improvements": ["Làm rõ bối cảnh hơn."],
                    "recommendations": ["Kể theo thứ tự S-T-A-R."],
                }
            )
        )


QA_HISTORY = [
    {
        "question": "Kể về một lần xử lý sự cố.",
        "answer": "Tôi tìm ra race condition và vá bằng idempotency key, lỗi giảm còn 0,02%.",
        "follow_up": None,
        "follow_up_answer": None,
        "score": {"situation": 82, "task": 78, "action": 88, "result": 91},
    },
    {
        "question": "Điểm yếu lớn nhất?",
        "answer": "Chưa có kinh nghiệm thực chiến NodeJS.",
        "follow_up": None,
        "follow_up_answer": None,
        "score": {"situation": 55, "task": 52, "action": 60, "result": 45},
    },
]


@pytest.fixture
def _llm_gia(monkeypatch):
    _GhiLaiLoiGoi.da_goi = {}
    monkeypatch.setattr(interview_nodes, "ChatGoogleGenerativeAI", _GhiLaiLoiGoi)
    monkeypatch.setattr(
        interview_nodes,
        "get_settings",
        lambda: SimpleNamespace(
            google_genai_api_key="test-key",
            model_name="gemini-3.5-flash",
            llm_timeout_seconds=20,
            llm_max_retries=0,
        ),
    )
    return _GhiLaiLoiGoi


@pytest.mark.asyncio
async def test_prompt_khong_xin_llm_tra_ve_diem(_llm_gia):
    await interview_nodes.generate_report_node({"qa_history": QA_HISTORY})

    system = _llm_gia.da_goi["system"]
    assert "total_score" not in system
    assert "star_scores" not in system
    # Phải nói rõ ba trường cần trả, nếu không model sẽ tự đoán.
    for truong in ("strengths", "improvements", "recommendations"):
        assert truong in system


@pytest.mark.asyncio
async def test_khong_gui_diem_tung_cau_vao_payload(_llm_gia):
    await interview_nodes.generate_report_node({"qa_history": QA_HISTORY})

    human = json.loads(_llm_gia.da_goi["human"])
    for muc in human["hoi_dap"]:
        assert "score" not in muc
    # Nội dung hỏi đáp thì vẫn phải còn, nếu không thì không viết nhận xét được.
    assert human["hoi_dap"][0]["answer"].startswith("Tôi tìm ra race condition")


@pytest.mark.asyncio
async def test_van_gui_diem_tong_hop_de_nhan_xet_khong_mau_thuan(_llm_gia):
    await interview_nodes.generate_report_node({"qa_history": QA_HISTORY})

    human = json.loads(_llm_gia.da_goi["human"])
    assert "diem_da_tinh" in human
    assert set(human["diem_da_tinh"]["theo_thanh_phan"]) == {"situation", "task", "action", "result"}


@pytest.mark.asyncio
async def test_diem_tra_ve_luon_la_diem_tinh_tat_dinh(_llm_gia):
    ket_qua = await interview_nodes.generate_report_node({"qa_history": QA_HISTORY})
    bao_cao = ket_qua["final_report"]
    mong_doi = interview_nodes._fallback_report(QA_HISTORY)

    assert bao_cao["total_score"] == mong_doi["total_score"]
    assert bao_cao["star_scores"] == mong_doi["star_scores"]
    # Phần nhận xét thì lấy từ LLM.
    assert bao_cao["strengths"] == ["Trình bày kết quả có số liệu."]
