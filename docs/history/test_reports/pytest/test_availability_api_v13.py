"""
Test Suite: Server-First Availability API (v2/listings/[id]/availability)
Tests the single source of truth for availability data.

Features tested:
- Availability API returns sorted ISO date array
- API includes PENDING, CONFIRMED, PAID bookings and calendar_blocks
- API returns 24 blocked dates for test listing
- Range availability check with conflicts
- Meta info with sources (calendarBlocks, bookings counts)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

# Use localhost for local testing (per main agent's note)
BASE_URL = "http://localhost:3000"
TEST_LISTING = "lst-test-final-1772285152"
EXPECTED_BLOCKED_COUNT = 24


class TestAvailabilityAPIBasics:
    """Basic availability API endpoint tests"""
    
    def test_availability_endpoint_returns_success(self):
        """Test that availability endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        print(f"SUCCESS: Availability endpoint returns success")
    
    def test_availability_returns_blocked_dates_array(self):
        """Test that blockedDates is an array"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        blocked_dates = data["data"]["blockedDates"]
        
        assert isinstance(blocked_dates, list)
        print(f"SUCCESS: blockedDates is array with {len(blocked_dates)} items")
    
    def test_availability_returns_24_blocked_dates(self):
        """Test that API returns exactly 24 blocked dates"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        blocked_count = len(data["data"]["blockedDates"])
        
        assert blocked_count == EXPECTED_BLOCKED_COUNT, f"Expected {EXPECTED_BLOCKED_COUNT} blocked dates, got {blocked_count}"
        print(f"SUCCESS: API returns exactly {blocked_count} blocked dates")
    
    def test_blocked_dates_are_sorted_iso_format(self):
        """Test that blocked dates are sorted in ISO format (YYYY-MM-DD)"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        blocked_dates = data["data"]["blockedDates"]
        
        # Check ISO format
        for date in blocked_dates:
            assert len(date) == 10, f"Date {date} is not in YYYY-MM-DD format"
            assert date[4] == "-" and date[7] == "-", f"Date {date} is not in YYYY-MM-DD format"
            # Verify it's parseable
            datetime.strptime(date, "%Y-%m-%d")
        
        # Check sorted
        assert blocked_dates == sorted(blocked_dates), "Dates are not sorted"
        print(f"SUCCESS: All {len(blocked_dates)} dates are sorted ISO format")


class TestAvailabilityAPIMetadata:
    """Tests for API meta information"""
    
    def test_api_returns_meta_info(self):
        """Test that API returns meta information"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        meta = data["data"]["meta"]
        
        assert "rangeStart" in meta
        assert "rangeEnd" in meta
        assert "totalBlocked" in meta
        assert "sources" in meta
        print(f"SUCCESS: Meta info present - rangeStart: {meta['rangeStart']}, rangeEnd: {meta['rangeEnd']}")
    
    def test_meta_sources_contains_calendar_blocks_and_bookings(self):
        """Test that meta.sources includes calendarBlocks and bookings counts"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        sources = data["data"]["meta"]["sources"]
        
        assert "calendarBlocks" in sources, "meta.sources should include calendarBlocks"
        assert "bookings" in sources, "meta.sources should include bookings"
        
        # Verify they're integers
        assert isinstance(sources["calendarBlocks"], int)
        assert isinstance(sources["bookings"], int)
        
        print(f"SUCCESS: Sources - calendarBlocks: {sources['calendarBlocks']}, bookings: {sources['bookings']}")
    
    def test_total_blocked_matches_array_length(self):
        """Test that meta.totalBlocked matches actual array length"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        total_blocked = data["data"]["meta"]["totalBlocked"]
        actual_length = len(data["data"]["blockedDates"])
        
        assert total_blocked == actual_length, f"totalBlocked ({total_blocked}) != array length ({actual_length})"
        print(f"SUCCESS: totalBlocked {total_blocked} matches array length")
    
    def test_listing_active_status(self):
        """Test that listingActive is returned"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        assert response.status_code == 200
        
        data = response.json()
        assert "listingActive" in data["data"]
        assert isinstance(data["data"]["listingActive"], bool)
        print(f"SUCCESS: listingActive = {data['data']['listingActive']}")


class TestAvailabilityRangeCheck:
    """Tests for date range availability checking"""
    
    def test_range_check_for_blocked_dates(self):
        """Test range check returns unavailable for blocked dates (April 1-5)"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-01", "endDate": "2026-04-05"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["available"] is False, "April 1-5 should be unavailable"
        assert "conflicts" in data
        assert len(data["conflicts"]) > 0, "Should have conflict dates"
        print(f"SUCCESS: Range check shows unavailable with {len(data['conflicts'])} conflicts: {data['conflicts']}")
    
    def test_range_check_includes_conflict_dates(self):
        """Test that conflicts array contains the blocked dates in range"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "2026-04-01", "endDate": "2026-04-05"}
        )
        data = response.json()
        
        # April 1-4 should be blocked (April 5 is checkout day, available for new checkin)
        expected_conflicts = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04"]
        for conflict in expected_conflicts:
            assert conflict in data["conflicts"], f"{conflict} should be in conflicts"
        print(f"SUCCESS: Conflicts contain expected dates: {expected_conflicts}")
    
    def test_range_check_for_available_dates(self):
        """Test range check returns available for non-blocked dates"""
        # Find a date far in the future that's likely not blocked
        future_start = "2026-12-15"
        future_end = "2026-12-20"
        
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": future_start, "endDate": future_end}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["available"] is True, f"Dates {future_start} to {future_end} should be available"
        assert len(data["conflicts"]) == 0, "Should have no conflicts"
        print(f"SUCCESS: Future dates {future_start} to {future_end} are available")
    
    def test_invalid_date_format_returns_400(self):
        """Test that invalid date format returns 400 error"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability",
            params={"startDate": "invalid", "endDate": "also-invalid"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "Invalid date format" in data.get("error", "")
        print(f"SUCCESS: Invalid date format correctly returns 400")


class TestSpecificBlockedDates:
    """Tests for specific blocked date ranges"""
    
    def test_april_1_5_blocked(self):
        """Test that April 1-4 (not 5, it's checkout) are in blocked dates"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        blocked = data["data"]["blockedDates"]
        
        # April 1-4 should be blocked (April 5 is checkout day)
        expected_blocked = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04"]
        for date in expected_blocked:
            assert date in blocked, f"{date} should be blocked"
        
        # April 5 should NOT be blocked (checkout day available for new checkin)
        assert "2026-04-05" not in blocked, "April 5 (checkout day) should NOT be blocked"
        print(f"SUCCESS: April 1-4 blocked, April 5 (checkout) available")
    
    def test_april_15_16_blocked(self):
        """Test that April 15-16 are blocked"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        blocked = data["data"]["blockedDates"]
        
        assert "2026-04-15" in blocked, "April 15 should be blocked"
        assert "2026-04-16" in blocked, "April 16 should be blocked"
        print(f"SUCCESS: April 15-16 are blocked")
    
    def test_april_20_25_blocked(self):
        """Test that April 20-24 are blocked"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING}/availability")
        data = response.json()
        blocked = data["data"]["blockedDates"]
        
        expected = ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"]
        for date in expected:
            assert date in blocked, f"{date} should be blocked"
        print(f"SUCCESS: April 20-24 blocked")


class TestErrorHandling:
    """Tests for error handling"""
    
    def test_nonexistent_listing_returns_404(self):
        """Test that non-existent listing returns 404"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/non-existent-listing-id/availability")
        
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert "not found" in data.get("error", "").lower()
        print(f"SUCCESS: Non-existent listing returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
