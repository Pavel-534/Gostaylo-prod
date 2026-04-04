"""
Gostaylo - Blocked Dates / Calendar Availability Tests (Iteration 9)
Tests: Availability API returns blocked dates including PENDING bookings
Test listing: lst-test-final-1772285152
"""

import pytest
import requests
import os

# Use local URL for testing (preview environment has 502 errors)
BASE_URL = "http://localhost:3000"
TEST_LISTING_ID = "lst-test-final-1772285152"


class TestAvailabilityAPI:
    """Availability API endpoint tests - verifies PENDING status is included"""
    
    def test_availability_returns_blocked_dates_without_params(self):
        """GET /api/v2/listings/{id}/availability returns blockedDates array without requiring date params"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        assert response.status_code == 200
        data = response.json()
        
        # API should return success structure
        assert data["success"] == True
        assert "data" in data
        assert "blockedDates" in data["data"]
        assert "listingActive" in data["data"]
        
        # Verify blockedDates is a list
        blocked_dates = data["data"]["blockedDates"]
        assert isinstance(blocked_dates, list)
        
        print(f"API returned {len(blocked_dates)} blocked dates")
    
    def test_availability_includes_pending_booking_dates(self):
        """Verify that PENDING booking dates (April 1-5) are included in blockedDates"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        assert response.status_code == 200
        data = response.json()
        blocked_dates = data["data"]["blockedDates"]
        
        # April 1-5 should be blocked (PENDING booking b-d2179ba7)
        expected_april_blocked = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"]
        
        for date in expected_april_blocked:
            assert date in blocked_dates, f"Expected {date} to be in blockedDates (PENDING booking)"
        
        print(f"April 1-5 correctly included in blocked dates")
    
    def test_availability_returns_28_blocked_dates(self):
        """Verify API returns expected 28 blocked dates total"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        assert response.status_code == 200
        data = response.json()
        blocked_dates = data["data"]["blockedDates"]
        
        # Per test requirements, expect 28 blocked dates
        assert len(blocked_dates) == 28, f"Expected 28 blocked dates, got {len(blocked_dates)}"
        
        print(f"Verified: {len(blocked_dates)} blocked dates returned")
    
    def test_availability_check_specific_blocked_range(self):
        """Check that April 1-5 shows as unavailable when checking specific range"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-04-01", "endDate": "2026-04-05"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should show as unavailable
        assert data["success"] == True
        assert data["available"] == False
        assert data["reason"] is not None
        
        # Should have booking conflict (not calendar block)
        assert data["details"]["bookings"] >= 1
        
        # conflictingDates should include April 1-5
        conflicting = data.get("conflictingDates", [])
        assert "2026-04-01" in conflicting
        
        print(f"April 1-5: available={data['available']}, reason={data['reason']}")
    
    def test_availability_check_available_dates(self):
        """Check that April 15-17 shows as available"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-04-15", "endDate": "2026-04-17"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should show as available
        assert data["success"] == True
        assert data["available"] == True
        assert data["reason"] is None
        assert data["conflictingDates"] == []
        
        print(f"April 15-17: available={data['available']}")
    
    def test_april_20_25_also_blocked(self):
        """Verify April 20-25 are also blocked (second PENDING booking)"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        assert response.status_code == 200
        data = response.json()
        blocked_dates = data["data"]["blockedDates"]
        
        # April 20-25 should be blocked
        expected_blocked = ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24", "2026-04-25"]
        
        for date in expected_blocked:
            assert date in blocked_dates, f"Expected {date} to be in blockedDates"
        
        print(f"April 20-25 correctly blocked")


class TestBookingCreation:
    """Test that booking creation works for available dates"""
    
    def test_booking_on_available_dates_succeeds(self):
        """Create booking for April 15-17 (available dates) should succeed"""
        booking_payload = {
            "listingId": TEST_LISTING_ID,
            "checkIn": "2026-04-15",
            "checkOut": "2026-04-17",
            "guestName": "TEST_BlockedDates_Tester",
            "guestEmail": "test_blocked_dates@example.com",
            "guestPhone": "+66800000000",
            "specialRequests": "Testing blocked dates feature",
            "currency": "THB"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=booking_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should create booking successfully
        assert data["success"] == True
        assert "booking" in data
        assert data["booking"]["id"] is not None
        
        booking_id = data["booking"]["id"]
        print(f"Created booking: {booking_id} for April 15-17")
        
        # Store booking ID for cleanup
        return booking_id


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
