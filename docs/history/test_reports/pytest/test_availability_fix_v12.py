"""
Test suite for availability API fix - CHECKED_IN enum removal
Issue: CHECKED_IN enum doesn't exist in database, causing bookings query to fail silently
Fix: Removed CHECKED_IN from all queries, now using PENDING, CONFIRMED, PAID for blocking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

# Test listing and expected blocked dates from the issue
TEST_LISTING_ID = "lst-test-final-1772285152"
BLOCKED_MARCH_DATES = ["2026-03-20", "2026-03-21", "2026-03-22"]


class TestAvailabilityAPIFix:
    """Tests for the availability API fix - verifying CHECKED_IN enum removal worked"""
    
    def test_api_returns_blocked_dates_list(self):
        """API should return all blocked dates when no date range provided"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"API success should be True, got {data}"
        assert 'data' in data, "Response should contain data field"
        assert 'blockedDates' in data['data'], "Data should contain blockedDates"
        
        blocked_dates = data['data']['blockedDates']
        assert isinstance(blocked_dates, list), "blockedDates should be a list"
        assert len(blocked_dates) == 34, f"Expected 34 blocked dates, got {len(blocked_dates)}"
    
    def test_march_20_22_are_blocked(self):
        """March 20-22 should be in the blocked dates list (from test booking)"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        assert response.status_code == 200
        data = response.json()
        blocked_dates = data['data']['blockedDates']
        
        for date in BLOCKED_MARCH_DATES:
            assert date in blocked_dates, f"Date {date} should be blocked but not found"
    
    def test_availability_check_blocks_conflicting_dates(self):
        """API should return available=false when date range overlaps with blocked dates"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-19", "endDate": "2026-03-23"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['success'] == True
        assert data['available'] == False, "Should not be available - dates conflict with booking"
        assert data['reason'] is not None, "Should provide a reason for unavailability"
        assert 'conflictingDates' in data, "Should list conflicting dates"
        
        # All March 20-22 should be in conflicting dates
        for date in BLOCKED_MARCH_DATES:
            assert date in data['conflictingDates'], f"{date} should be in conflicting dates"
    
    def test_availability_check_allows_non_conflicting_dates(self):
        """API should return available=true when no date conflicts"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-25", "endDate": "2026-03-27"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['success'] == True
        assert data['available'] == True, "Should be available - no date conflicts"
        assert len(data.get('blockedDates', [])) == 0, "No blocked dates in this range"
        assert len(data.get('conflictingDates', [])) == 0, "No conflicting dates"
    
    def test_partial_overlap_blocks_booking(self):
        """Even partial overlap with blocked dates should block the booking"""
        # Try to book 2026-03-21 to 2026-03-24 (overlaps with 2026-03-21, 2026-03-22)
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-21", "endDate": "2026-03-24"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['available'] == False, "Partial overlap should block booking"
        assert "2026-03-21" in data['conflictingDates']
        assert "2026-03-22" in data['conflictingDates']
    
    def test_exact_blocked_range_is_blocked(self):
        """Exact match with blocked date range should be blocked"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-20", "endDate": "2026-03-22"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['available'] == False, "Exact blocked range should not be available"
    
    def test_booking_details_shows_source(self):
        """Response should indicate bookings as the source of blocking"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-19", "endDate": "2026-03-23"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'details' in data
        assert data['details']['bookings'] == 1, "Should show 1 booking causing the block"


class TestAvailabilityEdgeCases:
    """Edge case tests for availability API"""
    
    def test_invalid_listing_id_returns_404(self):
        """Non-existent listing should return 404"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/invalid-listing-id/availability")
        
        assert response.status_code == 404
    
    def test_invalid_date_format_returns_400(self):
        """Invalid date format should return 400"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "invalid", "endDate": "2026-03-20"}
        )
        
        assert response.status_code == 400
    
    def test_end_before_start_returns_400(self):
        """End date before start date should return 400"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-25", "endDate": "2026-03-20"}
        )
        
        assert response.status_code == 400


class TestICalAndReviewsEnumFix:
    """Test that iCal and reviews routes also have the enum fix"""
    
    def test_reviews_api_works(self):
        """Reviews API should work without CHECKED_IN enum error"""
        response = requests.get(
            f"{BASE_URL}/api/v2/reviews",
            params={"listing_id": TEST_LISTING_ID}
        )
        
        # Should not fail with enum error
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True or 'tableExists' in data.get('data', {})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
