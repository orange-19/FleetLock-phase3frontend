#!/usr/bin/env python3
"""
FleetLock Backend API Testing Suite
Tests all major API endpoints for functionality and integration
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class FleetLockAPITester:
    def __init__(self, base_url: str = "https://disruption-guardian.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.admin_token = None
        self.worker_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test credentials from /app/memory/test_credentials.md
        self.admin_creds = {"email": "admin@fleetlock.in", "password": "FleetLock@2026"}
        self.worker_creds = {"email": "worker1@demo.com", "password": "demo123"}

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    token: Optional[str] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.api_base}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text, "status_code": response.status_code}
            
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, data = self.make_request('GET', '/')
        if success and data.get('message') == 'FleetLock API v1.0':
            self.log_test("Root API endpoint", True)
        else:
            self.log_test("Root API endpoint", False, f"Unexpected response: {data}")

    def test_admin_login(self):
        """Test admin login"""
        success, data = self.make_request('POST', '/auth/login', self.admin_creds)
        if success and data.get('role') == 'admin':
            self.admin_token = data.get('id')  # Store user ID for token-based requests
            self.log_test("Admin login", True)
            return True
        else:
            self.log_test("Admin login", False, f"Login failed: {data}")
            return False

    def test_worker_login(self):
        """Test worker login"""
        success, data = self.make_request('POST', '/auth/login', self.worker_creds)
        if success and data.get('role') == 'worker':
            self.worker_token = data.get('id')  # Store user ID for token-based requests
            self.log_test("Worker login", True)
            return True
        else:
            self.log_test("Worker login", False, f"Login failed: {data}")
            return False

    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint (requires login cookies)"""
        # Note: This test may fail due to cookie-based auth in browser vs requests
        success, data = self.make_request('GET', '/auth/me')
        if success:
            self.log_test("Auth /me endpoint", True)
        else:
            self.log_test("Auth /me endpoint", False, "Cookie-based auth expected to fail in requests", data)

    def test_plans_endpoint(self):
        """Test insurance plans endpoint"""
        success, data = self.make_request('GET', '/plans')
        if success and 'plans' in data and len(data['plans']) == 3:
            plans = data['plans']
            expected_plans = ['sahara', 'kavach', 'suraksha']
            plan_ids = [p.get('id') for p in plans]
            if all(plan_id in plan_ids for plan_id in expected_plans):
                self.log_test("Plans endpoint", True)
            else:
                self.log_test("Plans endpoint", False, f"Missing expected plans. Got: {plan_ids}")
        else:
            self.log_test("Plans endpoint", False, f"Invalid response: {data}")

    def test_payout_calculator(self):
        """Test payout calculator endpoint"""
        params = {
            'daily_income': 700,
            'plan': 'kavach',
            'severity': 'medium',
            'tenure_days': 90
        }
        
        # Convert params to query string manually
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        endpoint = f"/payout-calculator?{query_string}"
        
        success, data = self.make_request('GET', endpoint)
        if success and 'deterministic_payout' in data:
            payout = data.get('deterministic_payout', 0)
            if payout > 0:
                self.log_test("Payout calculator", True)
            else:
                self.log_test("Payout calculator", False, f"Zero payout calculated: {data}")
        else:
            self.log_test("Payout calculator", False, f"Invalid response: {data}")

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint (requires admin auth)"""
        # Note: This will likely fail due to cookie-based auth
        success, data = self.make_request('GET', '/admin/dashboard')
        if success and 'stats' in data:
            stats = data['stats']
            required_fields = ['total_workers', 'active_subscriptions', 'total_claims']
            if all(field in stats for field in required_fields):
                self.log_test("Admin dashboard", True)
            else:
                self.log_test("Admin dashboard", False, f"Missing required stats fields: {stats}")
        else:
            self.log_test("Admin dashboard", False, "Auth required - expected to fail without cookies", data)

    def test_worker_dashboard(self):
        """Test worker dashboard endpoint (requires worker auth)"""
        # Note: This will likely fail due to cookie-based auth
        success, data = self.make_request('GET', '/worker/dashboard')
        if success and 'worker' in data:
            self.log_test("Worker dashboard", True)
        else:
            self.log_test("Worker dashboard", False, "Auth required - expected to fail without cookies", data)

    def test_register_new_worker(self):
        """Test worker registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        new_worker = {
            "email": f"testworker{timestamp}@demo.com",
            "password": "TestPass123!",
            "name": f"Test Worker {timestamp}",
            "role": "worker",
            "phone": "+91 9876543210",
            "city": "Mumbai",
            "platform": "Zomato"
        }
        
        success, data = self.make_request('POST', '/auth/register', new_worker)
        if success and data.get('role') == 'worker':
            self.log_test("Worker registration", True)
        else:
            self.log_test("Worker registration", False, f"Registration failed: {data}")

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        invalid_creds = {"email": "invalid@test.com", "password": "wrongpass"}
        success, data = self.make_request('POST', '/auth/login', invalid_creds, expected_status=401)
        if success:  # success means we got expected 401 status
            self.log_test("Invalid login rejection", True)
        else:
            self.log_test("Invalid login rejection", False, f"Should have returned 401: {data}")

    def test_ml_insights(self):
        """Test ML insights endpoint (admin only)"""
        success, data = self.make_request('GET', '/admin/ml-insights')
        if success and 'models' in data:
            models = data['models']
            expected_models = ['fraud_model', 'payout_model', 'disruption_model']
            if all(model in models for model in expected_models):
                self.log_test("ML insights endpoint", True)
            else:
                self.log_test("ML insights endpoint", False, f"Missing expected models: {models}")
        else:
            self.log_test("ML insights endpoint", False, "Auth required - expected to fail without cookies", data)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting FleetLock API Tests...")
        print(f"Testing against: {self.base_url}")
        print("-" * 50)

        # Basic API tests
        self.test_root_endpoint()
        self.test_plans_endpoint()
        self.test_payout_calculator()
        
        # Auth tests
        self.test_admin_login()
        self.test_worker_login()
        self.test_auth_me_endpoint()
        self.test_register_new_worker()
        self.test_invalid_login()
        
        # Protected endpoint tests (will likely fail due to cookie auth)
        self.test_admin_dashboard()
        self.test_worker_dashboard()
        self.test_ml_insights()

        # Print summary
        print("-" * 50)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed - see details above")
            return 1

    def get_test_summary(self):
        """Get test summary for reporting"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": round((self.tests_passed / self.tests_run) * 100, 1) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    """Main test runner"""
    tester = FleetLockAPITester()
    exit_code = tester.run_all_tests()
    
    # Save detailed results
    summary = tester.get_test_summary()
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())