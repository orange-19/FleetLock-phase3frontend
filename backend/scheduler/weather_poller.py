"""
FleetLock Weather Poller — Background polling with in-memory cache.
Adapted for async FastAPI integration (no Celery needed for MVP).
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# In-memory cache: zone_id -> (timestamp, weather_data)
_weather_cache: Dict[str, tuple] = {}
CACHE_TTL_SECONDS = 300  # 5 min cache


def get_cached_weather(zone_id: str) -> Optional[Dict]:
    """Get weather from cache if fresh enough."""
    if zone_id in _weather_cache:
        ts, data = _weather_cache[zone_id]
        age = (datetime.now(timezone.utc) - ts).total_seconds()
        if age < CACHE_TTL_SECONDS:
            return data
    return None


def update_cache(zone_id: str, data: Dict):
    """Store weather data in cache."""
    _weather_cache[zone_id] = (datetime.now(timezone.utc), data)


def get_all_cached() -> Dict:
    """Return all cached weather data with age info."""
    result = {}
    now = datetime.now(timezone.utc)
    for zone_id, (ts, data) in _weather_cache.items():
        age = (now - ts).total_seconds()
        result[zone_id] = {**data, "cache_age_seconds": round(age, 0), "is_fresh": age < CACHE_TTL_SECONDS}
    return result


async def poll_all_zones(weather_client):
    """Fetch weather for all zones and update cache."""
    zones = weather_client.get_all_zones()
    results = {}
    for zone_id in zones:
        try:
            data = await weather_client.get_weather_for_zone(zone_id)
            update_cache(zone_id, data)
            results[zone_id] = data
        except Exception as e:
            logger.error(f"Failed to poll weather for {zone_id}: {e}")
    logger.info(f"Weather poll complete: {len(results)}/{len(zones)} zones updated")
    return results
