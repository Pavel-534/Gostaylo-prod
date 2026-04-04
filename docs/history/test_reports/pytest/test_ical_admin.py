"""
iCal Admin API Tests - /api/v2/admin/ical
Test GET (logs) and POST (sync_all, sync, get_sync_enabled) endpoints
Note: Uses explicit Cookie header due to Secure flag on session cookie
"""
import pytest
import requests
import re

# Use localhost for testing
BASE_URL = "http://localhost:3000"

# Admin credentials
ADMIN_EMAIL = "pavel_534@mail.ru"
ADMIN_PASSWORD = "ChangeMe2025!"


def get_auth_headers():
    """Login and return headers with session cookie"""
    # Login
    response = requests.post(f"{BASE_URL}/api/v2/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if response.status_code != 200:
        raise Exception(f"Login failed: {response.text}")
    
    # Extract cookie from Set-Cookie header
    set_cookie = response.headers.get('Set-Cookie', '')
    match = re.search(r'gostaylo_session=([^;]+)', set_cookie)
    if not match:
        raise Exception("Session cookie not found in response")
    
    cookie_value = match.group(1)
    
    return {
        "Cookie": f"gostaylo_session={cookie_value}",
        "Content-Type": "application/json"
    }


class TestICalAdminAPI:
    """iCal Admin API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get headers before each test"""
        self.headers = get_auth_headers()
        
    # --- GET Endpoint Tests ---
    
    def test_get_ical_logs_success(self):
        """GET /api/v2/admin/ical - returns logs and stats"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") is True, f"Response not successful: {data}"
        assert "logs" in data, "Missing 'logs' in response"
        assert "stats" in data, "Missing 'stats' in response"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_24h" in stats, "Missing 'total_24h' in stats"
        assert "success_24h" in stats, "Missing 'success_24h' in stats"
        assert "errors_24h" in stats, "Missing 'errors_24h' in stats"
        
        # Verify stats are numbers
        assert isinstance(stats["total_24h"], int), "total_24h should be int"
        assert isinstance(stats["success_24h"], int), "success_24h should be int"
        assert isinstance(stats["errors_24h"], int), "errors_24h should be int"
        
        print(f"Stats: total={stats['total_24h']}, success={stats['success_24h']}, errors={stats['errors_24h']}")
        
    def test_get_ical_logs_with_listing_title(self):
        """GET /api/v2/admin/ical - logs contain listing_title field"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # If there are logs, verify they have listing_title
        logs = data.get("logs", [])
        if len(logs) > 0:
            for log in logs[:3]:  # Check first 3 logs
                assert "listing_title" in log, f"Log missing listing_title: {log}"
                print(f"Log: {log.get('listing_title')} - {log.get('status')}")
        else:
            print("No logs found - skipping listing_title verification")
    
    def test_get_ical_logs_errors_only_filter(self):
        """GET /api/v2/admin/ical?errors_only=true - filters to error logs"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical?errors_only=true", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") is True
        
        logs = data.get("logs", [])
        for log in logs:
            assert log.get("status") == "error", f"Expected error status, got: {log.get('status')}"
        
        print(f"Found {len(logs)} error logs")
    
    def test_get_ical_logs_with_limit(self):
        """GET /api/v2/admin/ical?limit=10 - respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical?limit=10", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        logs = data.get("logs", [])
        assert len(logs) <= 10, f"Expected max 10 logs, got {len(logs)}"
        
        print(f"Got {len(logs)} logs with limit=10")
    
    # --- POST Endpoint Tests ---
    
    def test_post_get_sync_enabled(self):
        """POST /api/v2/admin/ical action=get_sync_enabled - returns listings with sync configured"""
        response = requests.post(f"{BASE_URL}/api/v2/admin/ical", 
            json={"action": "get_sync_enabled"},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Response not successful: {data}"
        assert "listings" in data, "Missing 'listings' in response"
        assert "count" in data, "Missing 'count' in response"
        
        listings = data.get("listings", [])
        assert isinstance(listings, list), "listings should be a list"
        
        # Verify listing structure if any exist
        if len(listings) > 0:
            listing = listings[0]
            assert "id" in listing, "Listing missing 'id'"
            assert "title" in listing, "Listing missing 'title'"
            assert "sync_settings" in listing, "Listing missing 'sync_settings'"
            print(f"Found {len(listings)} listings with sync enabled")
        else:
            print("No listings with sync enabled")
    
    def test_post_sync_all(self):
        """POST /api/v2/admin/ical action=sync_all - triggers sync for all listings"""
        response = requests.post(f"{BASE_URL}/api/v2/admin/ical",
            json={"action": "sync_all"},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Response not successful: {data}"
        
        # Verify response structure
        assert "total" in data, "Missing 'total' in response"
        assert "synced" in data, "Missing 'synced' in response"
        assert "errors" in data, "Missing 'errors' in response"
        assert "duration" in data, "Missing 'duration' in response"
        
        print(f"Sync All result: total={data.get('total')}, synced={data.get('synced')}, errors={data.get('errors')}, duration={data.get('duration')}ms")
    
    def test_post_invalid_action(self):
        """POST /api/v2/admin/ical with invalid action - returns error"""
        response = requests.post(f"{BASE_URL}/api/v2/admin/ical",
            json={"action": "invalid_action"},
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        data = response.json()
        assert data.get("success") is False
        assert "error" in data
        print(f"Invalid action error: {data.get('error')}")
    
    def test_post_sync_with_invalid_listing(self):
        """POST /api/v2/admin/ical action=sync with non-existent listingId"""
        response = requests.post(f"{BASE_URL}/api/v2/admin/ical",
            json={"action": "sync", "listingId": "non-existent-id-12345"},
            headers=self.headers
        )
        
        # Should fail because listing doesn't exist or has no sync sources
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is False
        print(f"Sync with invalid listing: {data.get('error')}")
    
    # --- Auth Tests ---
    
    def test_get_ical_logs_requires_admin(self):
        """GET /api/v2/admin/ical - requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical")
        
        assert response.status_code == 403, f"Expected 403 for unauthenticated, got {response.status_code}"
        data = response.json()
        assert data.get("success") is False
        print(f"Unauthenticated access denied: {data.get('error')}")
    
    def test_post_ical_requires_admin(self):
        """POST /api/v2/admin/ical - requires admin authentication"""
        response = requests.post(
            f"{BASE_URL}/api/v2/admin/ical",
            json={"action": "sync_all"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Expected 403 for unauthenticated, got {response.status_code}"
        data = response.json()
        assert data.get("success") is False
        print(f"Unauthenticated POST denied: {data.get('error')}")


class TestICalStatsAccuracy:
    """Test that stats reflect actual data correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.headers = get_auth_headers()
        
    def test_stats_total_matches_log_count(self):
        """Stats total_24h should match sum of success_24h + errors_24h"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        stats = data.get("stats", {})
        
        total = stats.get("total_24h", 0)
        success = stats.get("success_24h", 0)
        errors = stats.get("errors_24h", 0)
        
        # Total should equal success + errors
        assert total == success + errors, f"Stats mismatch: total={total}, success+errors={success+errors}"
        print(f"Stats check passed: {total} = {success} + {errors}")
    
    def test_stats_reflect_actual_data(self):
        """Stats should reflect test data: total=3, success=2, errors=1"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/ical", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        stats = data.get("stats", {})
        
        # Based on agent context: 2 success, 1 error
        print(f"Current stats: total={stats.get('total_24h')}, success={stats.get('success_24h')}, errors={stats.get('errors_24h')}")
        
        # We expect at least the test data to be present
        assert stats.get("total_24h", 0) >= 3, f"Expected at least 3 total, got {stats.get('total_24h')}"
        assert stats.get("success_24h", 0) >= 2, f"Expected at least 2 success, got {stats.get('success_24h')}"
        assert stats.get("errors_24h", 0) >= 1, f"Expected at least 1 error, got {stats.get('errors_24h')}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
