"""
FleetLock Telematics Client — GPS & Device Feature Generator
Generates fraud-detection-ready telematics features per claim.
"""
import random
from datetime import datetime, timezone
from typing import Dict, List, Tuple


class TelematicsClient:
    """Generates GPS and device telemetry features for the FraudRiskModel."""

    ZONE_MULTIPLIERS = {
        "Mumbai_Central": 1.15,
        "Mumbai_South": 1.10,
        "Mumbai_West": 1.05,
        "Chennai_North": 1.0,
        "Chennai_South": 0.95,
        "Bengaluru_East": 0.9,
        "Bengaluru_West": 0.92,
        "Hyderabad_Central": 0.95,
        "Delhi_North": 1.1,
        "Delhi_South": 1.05,
    }

    def generate_fraud_features(
        self, zone_id: str, weather_severity: str = "low", fraud_type: str = "genuine"
    ) -> Dict:
        """
        Generate fraud-model-ready telematics features.

        fraud_type: genuine | location_mismatch | route_fraud | device_fraud
        """
        zm = self.ZONE_MULTIPLIERS.get(zone_id, 1.0)

        if fraud_type == "genuine":
            gps_drift = random.uniform(8, 25)
            speed_jump = random.uniform(10, 22)
            route_deviation = random.uniform(4, 15)
            zone_entry_lag = random.randint(5, 20)
            device_swap = random.randint(0, 1)
            dup_trip = 0
        elif fraud_type == "location_mismatch":
            gps_drift = random.uniform(80, 200)
            speed_jump = random.uniform(40, 90)
            route_deviation = random.uniform(35, 70)
            zone_entry_lag = random.randint(60, 120)
            device_swap = random.randint(1, 3)
            dup_trip = 1
        elif fraud_type == "route_fraud":
            gps_drift = random.uniform(50, 100)
            speed_jump = random.uniform(35, 70)
            route_deviation = random.uniform(40, 85)
            zone_entry_lag = random.randint(30, 90)
            device_swap = random.randint(0, 2)
            dup_trip = 1
        elif fraud_type == "device_fraud":
            gps_drift = random.uniform(20, 60)
            speed_jump = random.uniform(20, 40)
            route_deviation = random.uniform(15, 35)
            zone_entry_lag = random.randint(20, 60)
            device_swap = random.randint(2, 5)
            dup_trip = 1
        else:
            gps_drift = random.uniform(5, 20)
            speed_jump = random.uniform(5, 20)
            route_deviation = random.uniform(3, 12)
            zone_entry_lag = random.randint(3, 15)
            device_swap = 0
            dup_trip = 0

        if weather_severity == "medium":
            gps_drift += 5
            speed_jump += 3
        elif weather_severity == "high":
            gps_drift += 12
            speed_jump += 8
            route_deviation += 5

        return {
            "gps_drift_meters": round(gps_drift * zm, 2),
            "speed_jump_kmh": round(speed_jump, 2),
            "route_deviation_pct": round(route_deviation / 100, 3),
            "zone_entry_lag_mins": zone_entry_lag,
            "device_swap_count": device_swap,
            "duplicate_trip_flag": dup_trip,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def generate_gps_trace(self, zone_id: str = "Mumbai_Central", num_points: int = 15, stationary: bool = False) -> List[Tuple[float, float]]:
        """Generate GPS trace points for visualization / validation."""
        base_coords = {
            "Mumbai_Central": (19.0760, 72.8777),
            "Chennai_North": (13.0827, 80.2707),
            "Bengaluru_East": (12.9716, 77.5946),
        }
        base = base_coords.get(zone_id, (19.0760, 72.8777))
        trace = []
        for _ in range(num_points):
            jitter = 0.0001 if stationary else 0.01
            trace.append((
                round(base[0] + random.uniform(-jitter, jitter), 6),
                round(base[1] + random.uniform(-jitter, jitter), 6)
            ))
        return trace
