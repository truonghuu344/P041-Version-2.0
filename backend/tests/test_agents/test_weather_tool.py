from types import SimpleNamespace

import httpx
import pytest

from src.agents.career_assistant_agent import _extract_weather_request, _plan_assistant_action
from src.agents.tools.weather_tool import get_weather


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("Thời tiết ở Hà Nội hôm nay thế nào?", ("Hà Nội", 1)),
        ("Dự báo tại Đà Nẵng ngày mai", ("Đà Nẵng", 2)),
        ("Cho tôi thời tiết ở Huế 3 ngày", ("Huế", 3)),
        ("Hôm nay trời có mưa không?", ("", 1)),
    ],
)
def test_extract_weather_request(message, expected):
    assert _extract_weather_request(message) == expected


def test_weather_intent_does_not_offer_unrelated_navigation():
    result = _plan_assistant_action({"message": "Thời tiết tại Hà Nội hôm nay"})
    assert result == {"intent": "weather", "suggested_actions": []}


@pytest.mark.asyncio
async def test_weather_tool_requests_location_before_calling_provider(monkeypatch):
    monkeypatch.setattr(
        "src.agents.tools.weather_tool.get_settings",
        lambda: SimpleNamespace(weather_api_key="configured-key"),
    )
    result = await get_weather.ainvoke({"location": " ", "forecast_days": 1})
    assert result["status"] == "needs_location"


@pytest.mark.asyncio
async def test_weather_tool_reports_missing_configuration(monkeypatch):
    monkeypatch.setattr(
        "src.agents.tools.weather_tool.get_settings",
        lambda: SimpleNamespace(weather_api_key=""),
    )
    result = await get_weather.ainvoke({"location": "Hà Nội", "forecast_days": 1})
    assert result == {
        "status": "not_configured",
        "message": "WEATHER_API_KEY chưa được cấu hình.",
    }


@pytest.mark.asyncio
async def test_openweather_key_routes_to_openweather_and_clamps_days(monkeypatch):
    calls = []

    async def fake_openweather(location, forecast_days, api_key):
        calls.append((location, forecast_days, api_key))
        return {"status": "ok", "source": "OpenWeather"}

    monkeypatch.setattr(
        "src.agents.tools.weather_tool.get_settings",
        lambda: SimpleNamespace(weather_api_key="a" * 32),
    )
    monkeypatch.setattr("src.agents.tools.weather_tool._get_openweather", fake_openweather)

    result = await get_weather.ainvoke({"location": "Hà Nội", "forecast_days": 99})
    assert result["source"] == "OpenWeather"
    assert calls == [("Hà Nội", 3, "a" * 32)]


@pytest.mark.asyncio
async def test_weatherapi_response_is_reduced_and_does_not_expose_key(monkeypatch):
    secret = "weatherapi-secret-key"
    payload = {
        "location": {
            "name": "Hanoi",
            "region": "Ha Noi",
            "country": "Vietnam",
            "localtime": "2026-08-08 10:00",
        },
        "current": {
            "last_updated": "2026-08-08 09:45",
            "condition": {"text": "Partly cloudy", "icon": "ignored"},
            "temp_c": 30.0,
            "feelslike_c": 34.0,
            "humidity": 70,
            "wind_kph": 12.0,
            "wind_dir": "SE",
            "precip_mm": 0.0,
            "vis_km": 10.0,
            "uv": 7.0,
        },
        "forecast": {
            "forecastday": [
                {
                    "date": "2026-08-08",
                    "day": {
                        "condition": {"text": "Rain"},
                        "mintemp_c": 26.0,
                        "maxtemp_c": 33.0,
                        "daily_chance_of_rain": 65,
                        "maxwind_kph": 20.0,
                        "uv": 8.0,
                    },
                }
            ]
        },
        "api_key": secret,
    }

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url, *, params):
            assert params["key"] == secret
            assert params["days"] == 1
            return FakeResponse()

    monkeypatch.setattr(
        "src.agents.tools.weather_tool.get_settings",
        lambda: SimpleNamespace(weather_api_key=secret),
    )
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

    result = await get_weather.ainvoke({"location": "Hanoi", "forecast_days": 1})
    assert result["status"] == "ok"
    assert result["source"] == "WeatherAPI.com"
    assert result["current"]["temp_c"] == 30.0
    assert result["forecast"][0]["chance_of_rain_percent"] == 65
    assert secret not in str(result)


@pytest.mark.asyncio
async def test_weatherapi_network_failure_returns_safe_error(monkeypatch):
    class FailingClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            raise httpx.ConnectError("network down")

    monkeypatch.setattr(
        "src.agents.tools.weather_tool.get_settings",
        lambda: SimpleNamespace(weather_api_key="weatherapi-key"),
    )
    monkeypatch.setattr(httpx, "AsyncClient", FailingClient)

    result = await get_weather.ainvoke({"location": "Hanoi", "forecast_days": 1})
    assert result == {"status": "error", "message": "Không thể kết nối WeatherAPI lúc này."}
