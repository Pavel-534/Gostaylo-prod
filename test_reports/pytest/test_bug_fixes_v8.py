"""
Bug Fixes Test Suite - v8
Tests for critical bug fixes:
1. GET /api/v2/listings/{id}/availability returns blocked dates without requiring query params
2. POST /api/v2/bookings creates booking with commission_rate and partner_earnings_thb saved
3. GET /api/v2/bookings/{id} returns booking data for checkout page (not 'Booking not found')
"""

import pytest
import requests
import os

BASE_URL = "http://localhost:3000"
TEST_LISTING_ID = "lst-test-final-1772285152"
CREATED_BOOKING_ID = None


class TestAvailabilityAPI:
    """Tests for GET /api/v2/listings/{id}/availability"""
    
    def test_availability_without_date_params(self):
        """BUG FIX #1: API should return blocked dates without requiring query params"""
        response = requests.get(f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability")
        
        # Should NOT return 400 - bug was returning 400 without date params
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data['success'] == True
        assert 'data' in data
        assert 'blockedDates' in data['data'], "Should return blockedDates array"
        assert 'listingActive' in data['data']
        
        # blockedDates should be a list
        assert isinstance(data['data']['blockedDates'], list)
        print(f"Blocked dates count: {len(data['data']['blockedDates'])}")
        print(f"Listing active: {data['data']['listingActive']}")
    
    def test_availability_with_date_params(self):
        """Availability API with date params should return availability info"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "2026-03-13", "endDate": "2026-03-16"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] == True
        assert 'available' in data
        assert 'blockedDates' in data
        
        # March 13-16 should be available (ghost PENDING bookings deleted)
        print(f"March 13-16 available: {data['available']}")
        print(f"Blocked dates: {data['blockedDates']}")
        print(f"Conflicting dates: {data.get('conflictingDates', [])}")


class TestBookingCreation:
    """Tests for POST /api/v2/bookings - commission fields"""
    
    def test_create_booking_with_commission_fields(self):
        """BUG FIX #2: Booking should be saved with commission_rate and partner_earnings_thb"""
        global CREATED_BOOKING_ID
        
        payload = {
            "listingId": TEST_LISTING_ID,
            "checkIn": "2026-07-15",
            "checkOut": "2026-07-18",
            "guestName": "Commission Test User",
            "guestEmail": "commission_test@test.com",
            "guestPhone": "+66123456789"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data['success'] == True
        assert 'booking' in data
        booking = data['booking']
        
        # Verify commission fields are saved (BUG FIX #2)
        assert 'commission_rate' in booking, "commission_rate should be in response"
        assert 'partner_earnings_thb' in booking, "partner_earnings_thb should be in response"
        
        # commission_rate should be 5% (custom rate for partner-1)
        assert booking['commission_rate'] == 5, f"Expected commission_rate=5, got {booking['commission_rate']}"
        
        # partner_earnings_thb should be 95% of price_thb
        price_thb = float(booking['price_thb'])
        partner_earnings = float(booking['partner_earnings_thb'])
        expected_earnings = price_thb * 0.95
        
        assert abs(partner_earnings - expected_earnings) < 1, \
            f"Partner earnings should be ~{expected_earnings}, got {partner_earnings}"
        
        print(f"Booking created: {booking['id']}")
        print(f"Price THB: {price_thb}")
        print(f"Commission rate: {booking['commission_rate']}%")
        print(f"Commission THB: {booking['commission_thb']}")
        print(f"Partner earnings: {partner_earnings}")
        
        CREATED_BOOKING_ID = booking['id']
    
    def test_booking_has_commission_breakdown(self):
        """Booking response should include commission breakdown"""
        global CREATED_BOOKING_ID
        
        if not CREATED_BOOKING_ID:
            pytest.skip("No booking created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/v2/bookings/{CREATED_BOOKING_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] == True
        
        booking = data['data']
        
        # All commission fields should be present
        assert booking['commission_rate'] == 5
        assert booking['commission_thb'] is not None
        assert booking['partner_earnings_thb'] is not None
        
        print(f"Commission rate persisted: {booking['commission_rate']}%")


class TestCheckoutAPI:
    """Tests for GET /api/v2/bookings/{id} - checkout page"""
    
    def test_get_booking_by_id(self):
        """BUG FIX #3: GET /api/v2/bookings/{id} should return booking data"""
        # Use the booking created earlier
        response = requests.get(f"{BASE_URL}/api/v2/bookings/b-63a682f9")
        
        # Should NOT return 'Booking not found' error
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data['success'] == True
        assert 'data' in data
        
        booking = data['data']
        
        # Verify all required checkout fields
        required_fields = [
            'id', 'listing_id', 'status', 'check_in', 'check_out',
            'price_thb', 'guest_name', 'guest_email',
            'commission_rate', 'partner_earnings_thb'
        ]
        
        for field in required_fields:
            assert field in booking, f"Missing field: {field}"
        
        # Verify listing data is included (for checkout display)
        assert 'listings' in booking, "Should include listing data"
        assert booking['listings']['title'] is not None
        
        print(f"Booking ID: {booking['id']}")
        print(f"Status: {booking['status']}")
        print(f"Guest: {booking['guest_name']}")
        print(f"Listing: {booking['listings']['title']}")
    
    def test_get_nonexistent_booking(self):
        """API should return 404 for non-existent booking"""
        response = requests.get(f"{BASE_URL}/api/v2/bookings/nonexistent-id-12345")
        
        assert response.status_code == 404
        data = response.json()
        assert data['success'] == False
        assert 'error' in data


class TestCommissionAPI:
    """Tests for /api/v2/commission endpoint"""
    
    def test_commission_returns_correct_rate(self):
        """Commission API should return 5% rate for partner-1"""
        response = requests.get(f"{BASE_URL}/api/v2/commission?partnerId=partner-1")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['success'] == True
        assert data['data']['effectiveRate'] == 5
        assert data['data']['partnerEarningsPercent'] == 95
        
        print(f"Commission rate: {data['data']['effectiveRate']}%")
        print(f"Partner earnings: {data['data']['partnerEarningsPercent']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
