#!/usr/bin/env python3
"""
FunnyRent 2.1 - Stage 15.3 Backend API Testing
Testing v2 Supabase-connected APIs
"""

import requests
import sys
import json
from datetime import datetime

class FunnyRentAPITester:
    def __init__(self, base_url=None):
        if base_url is None:
            # Read from environment or use default from .env
            self.base_url = "https://redirect-loop-debug.preview.emergentagent.com"
        else:
            self.base_url = base_url
        
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"    {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text[:500]}

            if success:
                self.tests_passed += 1
                print(f"    ✅ Passed - Status: {response.status_code}")
                if response_data.get('data'):
                    data_info = response_data['data']
                    if isinstance(data_info, list):
                        print(f"    📊 Returned {len(data_info)} items")
                    elif isinstance(data_info, dict):
                        print(f"    📊 Returned object with {len(data_info)} fields")
                    
                    # Log key information
                    self.log_response_summary(name, data_info)
            else:
                self.failed_tests.append({
                    'name': name,
                    'endpoint': endpoint,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'error': response_data.get('error', 'Unknown error')
                })
                print(f"    ❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"    📝 Error: {response_data.get('error', 'Unknown')}")

            self.test_results[name] = {
                'passed': success,
                'status_code': response.status_code,
                'response': response_data,
                'endpoint': endpoint
            }

            return success, response_data

        except Exception as e:
            self.failed_tests.append({
                'name': name,
                'endpoint': endpoint,
                'error': str(e)
            })
            print(f"    ❌ Failed - Exception: {str(e)}")
            self.test_results[name] = {
                'passed': False,
                'error': str(e),
                'endpoint': endpoint
            }
            return False, {}

    def log_response_summary(self, test_name, data):
        """Log useful summary information from responses"""
        if test_name == "Categories API" and isinstance(data, list):
            print(f"    📋 Categories: {[cat.get('name', 'N/A') for cat in data]}")
        elif test_name == "Districts API" and isinstance(data, list):
            print(f"    🗺️ Districts: {', '.join(data[:5])}{'...' if len(data) > 5 else ''}")
        elif test_name == "Exchange Rates API" and isinstance(data, list):
            currencies = [r.get('code', 'N/A') for r in data]
            print(f"    💱 Currencies: {currencies}")
        elif test_name == "Listings API" and isinstance(data, list):
            if data:
                first_listing = data[0]
                print(f"    🏠 First listing: {first_listing.get('title', 'N/A')} - {first_listing.get('district', 'N/A')}")
        elif test_name == "Admin Login" and isinstance(data, dict):
            user = data.get('user', {})
            print(f"    👤 Logged in as: {user.get('name', 'N/A')} ({user.get('role', 'N/A')})")

    def test_categories(self):
        """Test GET /api/v2/categories - Should return 4 categories from Supabase"""
        success, data = self.run_test("Categories API", "GET", "/api/v2/categories")
        
        if success and data.get('data'):
            categories = data['data']
            if len(categories) == 4:
                print(f"    ✨ Expected 4 categories, got {len(categories)} ✓")
            else:
                print(f"    ⚠️ Expected 4 categories, got {len(categories)}")
        
        return success

    def test_listings(self):
        """Test GET /api/v2/listings - Should return listings from Supabase"""
        return self.run_test("Listings API", "GET", "/api/v2/listings")[0]

    def test_districts(self):
        """Test GET /api/v2/districts - Should return Phuket districts"""
        success, data = self.run_test("Districts API", "GET", "/api/v2/districts")
        
        if success and data.get('data'):
            districts = data['data']
            expected_districts = ['Rawai', 'Chalong', 'Kata', 'Karon', 'Patong']
            found_expected = [d for d in expected_districts if d in districts]
            print(f"    🏝️ Found {len(found_expected)} expected Phuket districts")
        
        return success

    def test_exchange_rates(self):
        """Test GET /api/v2/exchange-rates - Should return 4 currency rates"""
        success, data = self.run_test("Exchange Rates API", "GET", "/api/v2/exchange-rates")
        
        if success and data.get('data'):
            rates = data['data']
            if len(rates) == 4:
                print(f"    ✨ Expected 4 currencies, got {len(rates)} ✓")
            else:
                print(f"    ⚠️ Expected 4 currencies, got {len(rates)}")
        
        return success

    def test_admin_login(self):
        """Test POST /api/v2/auth/login with email admin@funnyrent.com"""
        login_data = {
            "email": "admin@funnyrent.com",
            "password": "admin123"  # Mock password
        }
        
        success, data = self.run_test(
            "Admin Login",
            "POST",
            "/api/v2/auth/login",
            expected_status=200,
            data=login_data
        )
        
        if success and data.get('user'):
            user = data['user']
            if user.get('email') == 'admin@funnyrent.com':
                print(f"    ✨ Admin login successful ✓")
                return success, user
            else:
                print(f"    ⚠️ Expected admin@funnyrent.com, got {user.get('email')}")
        
        return success, {}

    def test_admin_stats(self):
        """Test GET /api/v2/admin/stats - Should return dashboard statistics"""
        success, data = self.run_test("Admin Stats API", "GET", "/api/v2/admin/stats")
        
        if success and data.get('data'):
            stats = data['data']
            categories = ['users', 'listings', 'bookings', 'revenue']
            found = [cat for cat in categories if cat in stats]
            print(f"    📊 Found {len(found)}/{len(categories)} expected stat categories")
        
        return success

    def test_partner_stats(self):
        """Test GET /api/v2/partner/stats?partnerId=partner-1"""
        return self.run_test(
            "Partner Stats API",
            "GET",
            "/api/v2/partner/stats?partnerId=partner-1"
        )[0]

    def test_promo_code_validation(self):
        """Test POST /api/v2/promo-codes/validate with code SAVE100"""
        promo_data = {
            "code": "SAVE100",
            "amount": 1000
        }
        
        return self.run_test(
            "Promo Code Validation",
            "POST",
            "/api/v2/promo-codes/validate",
            data=promo_data
        )[0]

    def test_profile(self):
        """Test GET /api/v2/profile?userId=admin-777"""
        return self.run_test(
            "Profile API",
            "GET",
            "/api/v2/profile?userId=admin-777"
        )[0]

    def run_all_tests(self):
        """Run all v2 API tests"""
        print("🚀 Starting FunnyRent 2.1 v2 API Tests (Supabase Connected)")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 70)

        # Core API tests
        test_methods = [
            ("Categories", self.test_categories),
            ("Listings", self.test_listings),
            ("Districts", self.test_districts),
            ("Exchange Rates", self.test_exchange_rates),
            ("Admin Login", self.test_admin_login),
            ("Admin Stats", self.test_admin_stats),
            ("Partner Stats", self.test_partner_stats),
            ("Promo Code", self.test_promo_code_validation),
            ("Profile", self.test_profile),
        ]

        for test_name, test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ {test_name} test failed with exception: {e}")
                self.failed_tests.append({
                    'name': test_name,
                    'error': str(e)
                })

        # Print summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.failed_tests)}")

        if self.failed_tests:
            print("\n🚨 FAILED TESTS:")
            for fail in self.failed_tests:
                print(f"  - {fail['name']}: {fail.get('error', 'Status code mismatch')}")

        # Success percentage
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")

        return success_rate >= 70  # Consider 70%+ as passing


def main():
    tester = FunnyRentAPITester()
    
    success = tester.run_all_tests()
    
    # Save results for test report
    results_file = "/tmp/backend_test_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'tests_run': tester.tests_run,
            'tests_passed': tester.tests_passed,
            'failed_tests': tester.failed_tests,
            'success_rate': (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    print(f"\n📁 Results saved to: {results_file}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())