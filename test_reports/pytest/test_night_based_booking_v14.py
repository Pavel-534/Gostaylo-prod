"""
Test Suite: Night-Based Booking Logic (Booking.com style)

CORE CONCEPT: We book NIGHTS, not days.
- A booking from April 1 to April 5 means 4 NIGHTS (1st, 2nd, 3rd, 4th)
- The check_out day (5th) is AVAILABLE for the next guest to check IN
- This enables back-to-back bookings without dead zones

Features tested:
1. API returns logic='night-based' in meta
2. API returns blockedNights array (dates where you cannot START a stay)
3. Check-out day is NOT in blockedNights (available for new check-in)
4. Back-to-back booking: if booking ends April 5, can book starting April 5
5. Nights within existing booking are blocked (April 1-4 blocked, April 5 available)
6. Price calculation is nights-based (check_out - check_in)
"""

import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000"
TEST_LISTING = "lst-test-final-1772285152"


class TestNightBasedAPILogic:
    """Tests for night-based logic in API response"""
    
    def test_api_returns_night_based_logic_in_meta(self):
        """Feature: API returns logic='night-based' in meta"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "meta" in data["data"]
        assert data["data"]["meta"]["logic"] == "night-based", "API should return logic='night-based'"
        print(f"PASS: API returns logic='night-based' in meta")
    
    def test_api_returns_blocked_nights_array(self):
        """Feature: API returns blockedNights array (not blockedDates)"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        assert "blockedNights" in data["data"], "API should return blockedNights key"
        assert isinstance(data["data"]["blockedNights"], list)
        print(f"PASS: API returns blockedNights array with {len(data['data']['blockedNights'])} items")


class TestCheckOutDayAvailability:
    """Tests for check-out day being available for new check-in"""
    
    def test_checkout_day_not_in_blocked_nights(self):
        """Feature: Check-out day is NOT in blockedNights (available for new check-in)
        
        Given: Booking April 1-5 (4 nights: 1st, 2nd, 3rd, 4th)
        Expected: April 5 (checkout day) should NOT be blocked
        """
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        blocked_nights = data["data"]["blockedNights"]
        
        # April 5 is the checkout day - should NOT be blocked
        assert "2026-04-05" not in blocked_nights, "April 5 (checkout day) should NOT be in blockedNights"
        print(f"PASS: Check-out day (April 5) is NOT in blockedNights - available for new check-in")
    
    def test_nights_within_booking_are_blocked(self):
        """Feature: Nights within existing booking ARE blocked
        
        Given: Booking April 1-5 (4 nights)
        Expected: April 1, 2, 3, 4 should be blocked (the nights you're sleeping)
        """
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        blocked_nights = data["data"]["blockedNights"]
        
        # April 1-4 should be blocked (4 nights of the booking)
        for day in ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04"]:
            assert day in blocked_nights, f"{day} should be in blockedNights"
        
        print(f"PASS: Nights 1-4 are blocked, night 5 is available (checkout day)")


class TestBackToBackBooking:
    """Tests for back-to-back booking capability"""
    
    def test_can_book_starting_on_checkout_day(self):
        """Feature: Back-to-back booking - can book starting on previous booking's checkout day
        
        Given: Booking ends April 5 (checkout)
        When: New booking requested April 5-7
        Expected: Should be available (no conflict)
        """
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-05", "endDate": "2026-04-07"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["available"] is True, "April 5-7 should be available (checkout day can be new check-in)"
        assert len(data["conflicts"]) == 0, "Should have no conflicts"
        assert data["requestedNights"] == 2, "Should request 2 nights (5th and 6th)"
        
        print(f"PASS: Back-to-back booking April 5-7 is available (0 conflicts, 2 nights)")
    
    def test_cannot_book_overlapping_last_night(self):
        """Feature: Cannot book if check-in overlaps existing booking's last night
        
        Given: Booking April 1-5 (nights 1,2,3,4 blocked)
        When: New booking requested April 4-6
        Expected: Should NOT be available (conflicts with night 4)
        """
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-04", "endDate": "2026-04-06"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["available"] is False, "April 4-6 should NOT be available"
        assert "2026-04-04" in data["conflicts"], "April 4 should be in conflicts"
        
        print(f"PASS: April 4-6 is NOT available - conflicts with night 4: {data['conflicts']}")
    
    def test_cannot_book_overlapping_first_night(self):
        """Cannot book if stay includes existing booking's first night"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-03-31", "endDate": "2026-04-02"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["available"] is False, "March 31 - April 2 should NOT be available"
        assert "2026-04-01" in data["conflicts"], "April 1 should be in conflicts"
        
        print(f"PASS: March 31 - April 2 is NOT available - conflicts: {data['conflicts']}")


class TestNightsCalculation:
    """Tests for nights calculation in range check"""
    
    def test_requested_nights_equals_checkout_minus_checkin(self):
        """Feature: Price calculation is nights-based (check_out - check_in)
        
        Stay from April 5 to April 10 = 5 nights (5th, 6th, 7th, 8th, 9th)
        """
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-05", "endDate": "2026-04-10"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["requestedNights"] == 5, "April 5-10 should be 5 nights"
        print(f"PASS: April 5-10 = 5 requestedNights (checkout - checkin)")
    
    def test_one_night_stay(self):
        """One night stay: check-in day to next day"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-05", "endDate": "2026-04-06"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["requestedNights"] == 1, "April 5-6 should be 1 night"
        print(f"PASS: April 5-6 = 1 night")
    
    def test_two_night_stay(self):
        """Two nights stay verification"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-05", "endDate": "2026-04-07"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["requestedNights"] == 2, "April 5-7 should be 2 nights"
        print(f"PASS: April 5-7 = 2 nights")


class TestMultipleBlockedRanges:
    """Tests for multiple blocked date ranges"""
    
    def test_may_checkout_day_available(self):
        """May booking: May 1-5, checkout May 5 should be available"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        blocked_nights = data["data"]["blockedNights"]
        
        # May 1-4 blocked, May 5 should NOT be blocked
        assert "2026-05-01" in blocked_nights
        assert "2026-05-02" in blocked_nights
        assert "2026-05-03" in blocked_nights
        assert "2026-05-04" in blocked_nights
        assert "2026-05-05" not in blocked_nights, "May 5 checkout should be available"
        
        print(f"PASS: May 1-4 blocked, May 5 available for new check-in")
    
    def test_back_to_back_may_booking(self):
        """Can book starting May 5 (checkout day of May 1-5 booking)"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-05-05", "endDate": "2026-05-08"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["available"] is True, "May 5-8 should be available"
        assert data["requestedNights"] == 3
        
        print(f"PASS: Back-to-back May 5-8 booking is available (3 nights)")


class TestAPIResponseStructure:
    """Tests for API response structure compliance"""
    
    def test_availability_response_has_required_fields(self):
        """Base availability response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        
        assert "success" in data
        assert "data" in data
        assert "blockedNights" in data["data"]
        assert "listingActive" in data["data"]
        assert "meta" in data["data"]
        
        meta = data["data"]["meta"]
        assert "rangeStart" in meta
        assert "rangeEnd" in meta
        assert "totalBlocked" in meta
        assert "sources" in meta
        assert "logic" in meta
        
        print(f"PASS: API response has all required fields")
    
    def test_range_check_response_has_required_fields(self):
        """Range check response has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-05", "endDate": "2026-04-07"}
        )
        data = response.json()
        
        assert "success" in data
        assert "available" in data
        assert "conflicts" in data
        assert "requestedNights" in data
        assert "data" in data
        assert "blockedNights" in data["data"]
        
        print(f"PASS: Range check response has all required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
