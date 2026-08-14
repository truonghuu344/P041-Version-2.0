from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import httpx
from langchain_core.tools import tool

from src.config import get_settings

WEATHER_API_URL = "https://api.weatherapi.com/v1/forecast.json"
OPENWEATHER_GEOCODING_URL = "https://api.openweathermap.org/geo/1.0/direct"
OPENWEATHER_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
OPENWEATHER_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


def _safe_number(value: Any) -> float | int | None:
    return value if isinstance(value, (int, float)) else None


def _openweather_local_time(timestamp: Any, timezone_offset: int) -> str | None:
    if not isinstance(timestamp, (int, float)):
        return None
    local_timezone = timezone(timedelta(seconds=timezone_offset))
    return datetime.fromtimestamp(timestamp, tz=UTC).astimezone(local_timezone).strftime("%Y-%m-%d %H:%M")


async def _get_openweather(
    location: str,
    forecast_days: int,
    api_key: str,
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            geocoding_response = await client.get(
                OPENWEATHER_GEOCODING_URL,
                params={"q": location, "limit": 1, "appid": api_key},
            )
            geocoding_response.raise_for_status()
            locations = geocoding_response.json()
            if not locations:
                return {"status": "error", "message": "Không tìm thấy địa điểm cần tra cứu."}
            resolved = locations[0]
            coordinates = {"lat": resolved["lat"], "lon": resolved["lon"]}

            current_response = await client.get(
                OPENWEATHER_CURRENT_URL,
                params={**coordinates, "appid": api_key, "units": "metric", "lang": "vi"},
            )
            current_response.raise_for_status()
            current_payload = current_response.json()

            forecast_payload: dict[str, Any] = {}
            if forecast_days > 1:
                forecast_response = await client.get(
                    OPENWEATHER_FORECAST_URL,
                    params={**coordinates, "appid": api_key, "units": "metric", "lang": "vi"},
                )
                forecast_response.raise_for_status()
                forecast_payload = forecast_response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (401, 403):
            return {
                "status": "auth_error",
                "message": "OpenWeather API key không hợp lệ hoặc chưa được kích hoạt.",
            }
        return {"status": "error", "message": "OpenWeather từ chối yêu cầu thời tiết."}
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return {"status": "error", "message": "Không thể kết nối OpenWeather lúc này."}

    timezone_offset = int(current_payload.get("timezone") or 0)
    condition = (current_payload.get("weather") or [{}])[0]
    main = current_payload.get("main", {})
    wind = current_payload.get("wind", {})
    precipitation = (current_payload.get("rain", {}).get("1h") or 0) + (
        current_payload.get("snow", {}).get("1h") or 0
    )

    forecast_by_date: dict[str, dict[str, Any]] = {}
    for item in forecast_payload.get("list", []):
        local_dt_value = datetime.fromtimestamp(item.get("dt", 0), tz=UTC) + timedelta(
            seconds=timezone_offset
        )
        date_key = local_dt_value.date().isoformat()
        if date_key not in forecast_by_date:
            forecast_by_date[date_key] = {
                "date": date_key,
                "condition": (item.get("weather") or [{}])[0].get("description"),
                "min_temp_c": item.get("main", {}).get("temp_min"),
                "max_temp_c": item.get("main", {}).get("temp_max"),
                "chance_of_rain_percent": round(float(item.get("pop") or 0) * 100),
                "max_wind_kph": round(float(item.get("wind", {}).get("speed") or 0) * 3.6, 1),
                "uv_index": None,
            }
            continue
        day = forecast_by_date[date_key]
        day["min_temp_c"] = min(day["min_temp_c"], item.get("main", {}).get("temp_min"))
        day["max_temp_c"] = max(day["max_temp_c"], item.get("main", {}).get("temp_max"))
        day["chance_of_rain_percent"] = max(
            day["chance_of_rain_percent"], round(float(item.get("pop") or 0) * 100)
        )
        day["max_wind_kph"] = max(
            day["max_wind_kph"], round(float(item.get("wind", {}).get("speed") or 0) * 3.6, 1)
        )

    local_names = resolved.get("local_names", {})
    return {
        "status": "ok",
        "source": "OpenWeather",
        "location": {
            "name": local_names.get("vi") or resolved.get("name"),
            "region": resolved.get("state"),
            "country": resolved.get("country"),
            "local_time": _openweather_local_time(current_payload.get("dt"), timezone_offset),
        },
        "current": {
            "last_updated": _openweather_local_time(current_payload.get("dt"), timezone_offset),
            "condition": condition.get("description"),
            "temp_c": _safe_number(main.get("temp")),
            "feels_like_c": _safe_number(main.get("feels_like")),
            "humidity_percent": _safe_number(main.get("humidity")),
            "wind_kph": round(float(wind.get("speed") or 0) * 3.6, 1),
            "wind_direction_degrees": _safe_number(wind.get("deg")),
            "precipitation_mm": _safe_number(precipitation),
            "visibility_km": round(float(current_payload.get("visibility") or 0) / 1000, 1),
            "uv_index": None,
        },
        "forecast": list(forecast_by_date.values())[:forecast_days],
    }


@tool
async def get_weather(location: str, forecast_days: int = 1) -> dict[str, Any]:
    """Lấy thời tiết hiện tại và dự báo ngắn hạn từ WeatherAPI.com.

    Args:
        location: Thành phố, tỉnh, quốc gia hoặc tọa độ cần tra cứu.
        forecast_days: Số ngày dự báo, từ 1 đến 3 ngày.

    Returns:
        Dữ liệu thời tiết đã rút gọn, không chứa API key.
    """
    normalized_location = location.strip()
    if not normalized_location:
        return {"status": "needs_location", "message": "Người dùng chưa cung cấp địa điểm."}

    settings = get_settings()
    if not settings.weather_api_key:
        return {"status": "not_configured", "message": "WEATHER_API_KEY chưa được cấu hình."}

    days = min(max(int(forecast_days), 1), 3)
    if re.fullmatch(r"[0-9a-fA-F]{32}", settings.weather_api_key):
        return await _get_openweather(normalized_location, days, settings.weather_api_key)

    params = {
        "key": settings.weather_api_key,
        "q": normalized_location,
        "days": days,
        "aqi": "no",
        "alerts": "no",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(WEATHER_API_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        error_message = "Không tìm thấy địa điểm hoặc WeatherAPI từ chối yêu cầu."
        try:
            error_message = exc.response.json().get("error", {}).get("message") or error_message
        except (TypeError, ValueError):
            pass
        return {"status": "error", "message": error_message}
    except (httpx.HTTPError, ValueError):
        return {"status": "error", "message": "Không thể kết nối WeatherAPI lúc này."}

    location_data = payload.get("location", {})
    current = payload.get("current", {})
    forecast_items = []
    for item in payload.get("forecast", {}).get("forecastday", [])[:days]:
        day = item.get("day", {})
        forecast_items.append(
            {
                "date": item.get("date"),
                "condition": day.get("condition", {}).get("text"),
                "min_temp_c": _safe_number(day.get("mintemp_c")),
                "max_temp_c": _safe_number(day.get("maxtemp_c")),
                "chance_of_rain_percent": _safe_number(day.get("daily_chance_of_rain")),
                "max_wind_kph": _safe_number(day.get("maxwind_kph")),
                "uv_index": _safe_number(day.get("uv")),
            }
        )

    return {
        "status": "ok",
        "source": "WeatherAPI.com",
        "location": {
            "name": location_data.get("name"),
            "region": location_data.get("region"),
            "country": location_data.get("country"),
            "local_time": location_data.get("localtime"),
        },
        "current": {
            "last_updated": current.get("last_updated"),
            "condition": current.get("condition", {}).get("text"),
            "temp_c": _safe_number(current.get("temp_c")),
            "feels_like_c": _safe_number(current.get("feelslike_c")),
            "humidity_percent": _safe_number(current.get("humidity")),
            "wind_kph": _safe_number(current.get("wind_kph")),
            "wind_direction": current.get("wind_dir"),
            "precipitation_mm": _safe_number(current.get("precip_mm")),
            "visibility_km": _safe_number(current.get("vis_km")),
            "uv_index": _safe_number(current.get("uv")),
        },
        "forecast": forecast_items,
    }
