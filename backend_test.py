#!/usr/bin/env python3
"""
FleetLock Backend API Testing Suite
Tests all API endpoints with Bearer token authentication
"""
import requests
import sys
import json
from datetime import datetime

class FleetLockAPITester:
    def __init__(self, base_url="https://disruption-guardian.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.worker_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test with Bearer token auth"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params or {})
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login and get Bearer token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@fleetlock.in", "password": "FleetLock@2026"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_worker_login(self):
        """Test worker login and get Bearer token"""
        success, response = self.run_test(
            "Worker Login",
            "POST",
            "auth/login",
            200,
            data={"email": "worker1@demo.com", "password": "demo123"}
        )
        if success and 'access_token' in response:
            self.worker_token = response['access_token']
            print(f"   Worker token obtained: {self.worker_token[:20]}...")
            return True
        return False

    def test_auth_me(self, token, role):
        """Test /auth/me endpoint"""
        success, response = self.run_test(
            f"Auth Me ({role})",
            "GET",
            "auth/me",
            200,
            token=token
        )
        if success and response.get('role') == role:
            print(f"   User role verified: {response.get('role')}")
            return True
        return False

    def test_plans_endpoint(self):
        """Test public plans endpoint"""
        success, response = self.run_test(
            "Get Plans",
            "GET",
            "plans",
            200
        )
        if success and 'plans' in response:
            plans = response['plans']
            print(f"   Found {len(plans)} plans")
            # Check for Level-1/Level-2/Level-3 naming
            plan_names = [p.get('name', '') for p in plans]
            expected_names = ['Level 1', 'Level 2', 'Level 3']
            if all(name in plan_names for name in expected_names):
                print(f"   ✅ Plan names updated to Level format: {plan_names}")
                return True
            else:
                print(f"   ❌ Plan names not updated: {plan_names}")
                return False
        return False

    def test_payout_calculator(self):
        """Test payout calculator endpoint"""
        success, response = self.run_test(
            "Payout Calculator",
            "GET",
            "payout-calculator",
            200,
            params={"daily_income": 700, "plan": "level-2", "severity": "medium"}
        )
        if success and 'final_payout' in response:
            print(f"   Calculated payout: Rs. {response.get('final_payout', 0)}")
            return True
        return False

    def test_weather_zones(self):
        """Test weather zones endpoint"""
        success, response = self.run_test(
            "Weather Zones",
            "GET",
            "weather/zones",
            200
        )
        if success and 'zones' in response:
            zones = response['zones']
            print(f"   Found {len(zones)} weather zones")
            if len(zones) >= 10:  # Should have 13 zones
                print(f"   ✅ Expected number of zones found")
                return True
            else:
                print(f"   ❌ Expected 13+ zones, got {len(zones)}")
                return False
        return False

    def test_weather_zone_data(self):
        """Test specific zone weather data"""
        success, response = self.run_test(
            "Weather Zone Data (Mumbai_Central)",
            "GET",
            "weather/zone/Mumbai_Central",
            200
        )
        if success and 'zone_id' in response:
            print(f"   Zone: {response.get('zone_id')}")
            print(f"   Source: {response.get('source', 'unknown')}")
            print(f"   Temperature: {response.get('temperature_celsius')}°C")
            print(f"   Rainfall: {response.get('rainfall_mm')}mm")
            return True
        return False

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        success, response = self.run_test(
            "Admin Dashboard",
            "GET",
            "admin/dashboard",
            200,
            token=self.admin_token
        )
        if success and 'stats' in response:
            stats = response['stats']
            print(f"   Total workers: {stats.get('total_workers', 0)}")
            print(f"   Total claims: {stats.get('total_claims', 0)}")
            print(f"   Active subscriptions: {stats.get('active_subscriptions', 0)}")
            return True
        return False

    def test_admin_weather_all(self):
        """Test admin weather all zones endpoint"""
        success, response = self.run_test(
            "Admin Weather All",
            "GET",
            "weather/all",
            200,
            token=self.admin_token
        )
        if success and 'zones' in response:
            zones = response['zones']
            print(f"   Cached weather data for {len(zones)} zones")
            print(f"   Weather API active: {response.get('weather_api_active', False)}")
            return True
        return False

    def test_admin_ml_insights(self):
        """Test admin ML insights endpoint"""
        success, response = self.run_test(
            "Admin ML Insights",
            "GET",
            "admin/ml-insights",
            200,
            token=self.admin_token
        )
        if success and 'models' in response:
            models = response['models']
            print(f"   Found {len(models)} ML models")
            for name, model in models.items():
                print(f"   - {model.get('name')}: {model.get('version')}")
            return True
        return False

    def test_admin_simulate_disruption(self):
        """Test admin disruption simulation"""
        sim_data = {
            "zone": "Mumbai_Central",
            "disruption_type": "weather",
            "rainfall_mm": 100,
            "temperature_celsius": 35,
            "aqi_index": 200,
            "wind_speed_kmh": 50,
            "flood_alert": False,
            "platform_outage": False
        }
        success, response = self.run_test(
            "Admin Simulate Disruption",
            "POST",
            "admin/simulate-disruption",
            200,
            data=sim_data,
            token=self.admin_token
        )
        if success and 'disruption' in response:
            disruption = response['disruption']
            claims_summary = response.get('claims_summary', {})
            print(f"   Simulated {disruption.get('type')} in {disruption.get('zone')}")
            print(f"   Severity: {disruption.get('severity')}")
            print(f"   Affected workers: {response.get('affected_workers', 0)}")
            print(f"   Claims created: {response.get('auto_claims_created', 0)}")
            print(f"   Total payout: Rs. {claims_summary.get('total_payout', 0)}")
            return True
        return False

    def test_worker_dashboard(self):
        """Test worker dashboard endpoint"""
        success, response = self.run_test(
            "Worker Dashboard",
            "GET",
            "worker/dashboard",
            200,
            token=self.worker_token
        )
        if success and 'worker' in response:
            worker = response['worker']
            loyalty = response.get('loyalty', {})
            print(f"   Worker zone: {worker.get('zone')}")
            print(f"   Active plan: {worker.get('active_plan')}")
            print(f"   Daily income avg: Rs. {worker.get('daily_income_avg', 0)}")
            print(f"   Loyalty score: {loyalty.get('loyalty_score', 0):.2f}")
            return True
        return False

    def test_worker_subscribe(self):
        """Test worker subscription to a plan"""
        success, response = self.run_test(
            "Worker Subscribe",
            "POST",
            "worker/subscribe",
            200,
            data={"plan": "level-2"},
            token=self.worker_token
        )
        if success and 'plan' in response:
            print(f"   Subscribed to: {response.get('plan')}")
            print(f"   Premium: Rs. {response.get('premium_daily', 0)}/day")
            return True
        return False

    def test_worker_create_claim(self):
        """Test worker claim creation"""
        success, response = self.run_test(
            "Worker Create Claim",
            "POST",
            "worker/claim",
            200,
            data={"disruption_type": "weather", "description": "Heavy rainfall disruption"},
            token=self.worker_token
        )
        if success and 'claim_id' in response:
            print(f"   Claim created: {response.get('claim_id')}")
            print(f"   Status: {response.get('status')}")
            print(f"   Fraud score: {response.get('fraud_score', 0):.3f}")
            print(f"   Payout: Rs. {response.get('payout_amount', 0)}")
            return True
        return False

    def test_telematics_features(self):
        """Test telematics features endpoint"""
        success, response = self.run_test(
            "Telematics Features",
            "GET",
            "telematics/features/Mumbai_Central",
            200,
            params={"fraud_type": "genuine", "severity": "low"}
        )
        if success and 'gps_drift_meters' in response:
            print(f"   GPS drift: {response.get('gps_drift_meters')}m")
            print(f"   Speed jump: {response.get('speed_jump_kmh')} km/h")
            print(f"   Device swaps: {response.get('device_swap_count')}")
            return True
        return False

def main():
    print("🚀 FleetLock Backend API Testing Suite")
    print("=" * 50)
    
    tester = FleetLockAPITester()
    
    # Test sequence
    tests = [
        # Auth tests
        ("Admin Login", tester.test_admin_login),
        ("Worker Login", tester.test_worker_login),
        ("Admin Auth Me", lambda: tester.test_auth_me(tester.admin_token, "admin")),
        ("Worker Auth Me", lambda: tester.test_auth_me(tester.worker_token, "worker")),
        
        # Public endpoints
        ("Plans Endpoint", tester.test_plans_endpoint),
        ("Payout Calculator", tester.test_payout_calculator),
        
        # Weather endpoints
        ("Weather Zones", tester.test_weather_zones),
        ("Weather Zone Data", tester.test_weather_zone_data),
        
        # Admin endpoints
        ("Admin Dashboard", tester.test_admin_dashboard),
        ("Admin Weather All", tester.test_admin_weather_all),
        ("Admin ML Insights", tester.test_admin_ml_insights),
        ("Admin Simulate Disruption", tester.test_admin_simulate_disruption),
        
        # Worker endpoints
        ("Worker Dashboard", tester.test_worker_dashboard),
        ("Worker Subscribe", tester.test_worker_subscribe),
        ("Worker Create Claim", tester.test_worker_create_claim),
        
        # Integration endpoints
        ("Telematics Features", tester.test_telematics_features),
    ]
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            tester.failed_tests.append(f"{test_name}: Exception - {e}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())