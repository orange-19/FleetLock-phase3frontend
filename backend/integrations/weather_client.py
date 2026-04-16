"""
FleetLock Weather Client — OpenWeatherMap Integration
Fetches live weather + AQI data per zone for the DisruptionSeverityModel.
"""
import httpx
import os
import logging
from typing import Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

ZONE_COORDINATES = {
    "Mumbai_Central": (19.0760, 72.8777),
    "Mumbai_South": (18.9388, 72.8354),
    "Mumbai_West": (19.1197, 72.8468),
    "Chennai_North": (13.0827, 80.2707),
    "Chennai_South": (13.0500, 80.2500),
    "Bengaluru_East": (12.9716, 77.5946),
    "Bengaluru_West": (12.9081, 77.6476),
    "Hyderabad_Central": (17.3850, 78.4867),
    "Delhi_North": (28.7041, 77.1025),
    "Delhi_South": (28.5245, 77.1855),
    "Pune_Central": (18.5204, 73.8567),
    "Kolkata_Central": (22.5726, 88.3639),
    "Ahmedabad_Central": (23.0225, 72.5714),
}


class WeatherClient:
    """Async OpenWeatherMap client for zone-level weather data."""
    BASE_URL = "https://api.openweathermap.org/data/2.5"

    def __init__(self):
        self.api_key = os.environ.get("OPENWEATHER_API_KEY", "")
        self.available = bool(self.api_key)
        if not self.available:
            logger.warning("OPENWEATHER_API_KEY not set — weather client will use fallback data")

    async def get_weather_for_zone(self, zone_id: str) -> Dict:
        """Fetch live weather data for a zone, returns DisruptionModel-ready dict."""
        coords = ZONE_COORDINATES.get(zone_id)
        if not coords:
            for k, v in ZONE_COORDINATES.items():
                if zone_id.split("_")[0] in k:
                    coords = v
                    break
        if not coords:
            coords = (19.0760, 72.8777)  # default Mumbai

        if not self.available:
            return self._fallback_data(zone_id)

        try:
            lat, lon = coords
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {"lat": lat, "lon": lon, "appid": self.api_key, "units": "metric"}
                weather_resp = await client.get(f"{self.BASE_URL}/weather", params=params)
                weather_resp.raise_for_status()
                w = weather_resp.json()

                aqi_value = 75
                try:
                    pollution_resp = await client.get(f"{self.BASE_URL}/air_pollution", params=params)
                    pollution_resp.raise_for_status()
                    p = pollution_resp.json()
                    aqi_value = p["list"][0]["main"]["aqi"] * 50
                except Exception:
                    pass

                return {
                    "zone_id": zone_id,
                    "rainfall_mm": w.get("rain", {}).get("1h") or w.get("rain", {}).get("3h") or 0.0,
                    "temperature_celsius": round(w["main"]["temp"], 1),
                    "wind_speed_kmh": round(w.get("wind", {}).get("speed", 0) * 3.6, 1),
                    "aqi_index": aqi_value,
                    "flood_alert_flag": 1 if any("flood" in item.get("description", "").lower() for item in w.get("weather", [])) else 0,
                    "humidity": w["main"].get("humidity", 0),
                    "weather_condition": w.get("weather", [{}])[0].get("main", "Clear"),
                    "weather_description": w.get("weather", [{}])[0].get("description", ""),
                    "source": "openweathermap_live",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Weather API error for {zone_id}: {e}")
            return self._fallback_data(zone_id)

    def _fallback_data(self, zone_id: str) -> Dict:
        """Generate simulated weather data when API is unavailable."""
        import random
        return {
            "zone_id": zone_id,
            "rainfall_mm": round(random.uniform(0, 80), 1),
            "temperature_celsius": round(random.uniform(25, 42), 1),
            "wind_speed_kmh": round(random.uniform(5, 60), 1),
            "aqi_index": random.randint(30, 250),
            "flood_alert_flag": 0,
            "humidity": random.randint(40, 95),
            "weather_condition": random.choice(["Clear", "Rain", "Clouds", "Thunderstorm", "Haze"]),
            "weather_description": "simulated data",
            "source": "fallback_simulated",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def get_all_zones():
        return list(ZONE_COORDINATES.keys())
