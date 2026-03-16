"""
Gostaylo - Booking Flow E2E Test (Post-RLS Fix)
Tests the complete booking lifecycle after RLS policies were fixed.

Test Coverage:
1. Calendar API - Returns correct availability data
2. Bookings POST - Creates booking successfully
3. Bookings GET - Renter can view their own bookings
4. Calendar API - Booked dates show as blocked
5. Availability conflict detection

Test User: pavel29031983@gmail.com / az123456 (user-mmq8fm4a-n1s)
Test Listing: lst-mmih84ji-6jolf (Вилла у моря - ACTIVE Villa)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

# Test Configuration
BASE_URL = "http://localhost:3000"
SUPABASE_URL = "https://vtzzcdsjwudkaloxhvnw.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I"

# Test Data
TEST_RENTER_ID = "user-mmq8fm4a-n1s"
TEST_RENTER_EMAIL = "pavel29031983@gmail.com"
TEST_LISTING_ID = "lst-mmih84ji-6jolf"  # Вилла у моря

# Calculate test dates (tomorrow + 3 days)
tomorrow = datetime.now() + timedelta(days=1)
CHECK_IN = tomorrow.strftime("%Y-%m-%d")
CHECK_OUT = (tomorrow + timedelta(days=3)).strftime("%Y-%m-%d")


class TestCalendarAPI:
    """Calendar API Tests - Availability Data"""
    
    def test_calendar_api_returns_data(self):
        """GET /api/v2/listings/{id}/calendar returns valid calendar data"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/calendar?days=10"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "data" in data
        assert "calendar" in data["data"]
        assert "listingActive" in data["data"]
        assert data["data"]["listingActive"] == True
        
        print(f"Calendar API returned {len(data['data']['calendar'])} days")
    
    def test_calendar_availability_check(self):
        """GET /api/v2/listings/{id}/calendar with checkIn/checkOut params"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/calendar",
            params={"checkIn": CHECK_IN, "checkOut": CHECK_OUT}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "available" in data
        
        print(f"Availability check: {CHECK_IN} to {CHECK_OUT} = {data['available']}")


class TestBookingsAPI:
    """Bookings API Tests - CRUD Operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Clean up any existing test bookings before each test"""
        # Clean bookings via Supabase directly
        headers = {
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        # Delete test bookings created today for our test user
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=headers,
            params={"renter_id": f"eq.{TEST_RENTER_ID}", "check_in": f"eq.{CHECK_IN}"}
        )
    
    def test_create_booking_success(self):
        """POST /api/v2/bookings - Create new booking"""
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": CHECK_IN,
            "checkOut": CHECK_OUT,
            "guestName": "Test Renter Pavel",
            "guestPhone": "+66888888888",
            "guestEmail": TEST_RENTER_EMAIL,
            "specialRequests": "E2E Test Booking",
            "currency": "THB"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Create booking response: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "booking" in data
        assert data["booking"]["status"] == "PENDING"
        assert data["booking"]["renter_id"] == TEST_RENTER_ID
        assert data["booking"]["listing_id"] == TEST_LISTING_ID
        
        return data["booking"]["id"]
    
    def test_get_renter_bookings(self):
        """GET /api/v2/bookings - Renter can view their own bookings"""
        # First create a booking
        self.test_create_booking_success()
        
        # Then fetch bookings
        response = requests.get(
            f"{BASE_URL}/api/v2/bookings",
            params={"renterId": TEST_RENTER_ID, "limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"GET bookings response: {data}")
        
        assert data["success"] == True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # Should have at least 1 booking
        assert len(data["data"]) >= 1, "Renter should see their booking after creation"
        
        # Verify the booking includes listing info
        latest_booking = data["data"][0]
        assert "listings" in latest_booking or "listing" in latest_booking, "Booking should include listing details"
        
        print(f"Renter has {len(data['data'])} bookings visible")
    
    def test_calendar_shows_blocked_dates_after_booking(self):
        """Calendar should show booked dates as BLOCKED"""
        # Create a booking
        self.test_create_booking_success()
        
        # Check calendar - should show those dates as blocked
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/calendar?days=10"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        calendar = data["data"]["calendar"]
        
        # Find the check-in date
        check_in_day = next((d for d in calendar if d["date"] == CHECK_IN), None)
        
        assert check_in_day is not None, f"Check-in date {CHECK_IN} should be in calendar"
        
        print(f"Check-in date {CHECK_IN} status: {check_in_day['status']}")
        print(f"Check-in date can_check_in: {check_in_day['can_check_in']}")
        
        # The date should be blocked (either BLOCKED status or can_check_in=false)
        assert check_in_day["status"] == "BLOCKED" or not check_in_day["can_check_in"], \
            f"Booked date should be blocked. Got status={check_in_day['status']}, can_check_in={check_in_day['can_check_in']}"


class TestDoubleBookingPrevention:
    """Tests for double-booking conflict detection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create initial booking"""
        # Clean up first
        headers = {
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=headers,
            params={"renter_id": f"eq.{TEST_RENTER_ID}", "check_in": f"eq.{CHECK_IN}"}
        )
        
        # Create initial booking
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": CHECK_IN,
            "checkOut": CHECK_OUT,
            "guestName": "First Booking",
            "guestPhone": "+66888888888",
            "guestEmail": TEST_RENTER_EMAIL,
            "currency": "THB"
        }
        requests.post(f"{BASE_URL}/api/v2/bookings", json=payload)
    
    def test_double_booking_rejected(self):
        """Attempting to book same dates should return 409 Conflict"""
        # Try to book same dates
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": CHECK_IN,
            "checkOut": CHECK_OUT,
            "guestName": "Second Booking Attempt",
            "guestPhone": "+66777777777",
            "guestEmail": "another@test.com",
            "currency": "THB"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Double booking response: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Should be rejected with 409 Conflict
        assert response.status_code == 409, f"Double booking should be rejected with 409, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == False
        assert "DATES_CONFLICT" in str(data.get("code", "")) or "taken" in str(data.get("error", "")).lower()


class TestCleanup:
    """Cleanup after tests"""
    
    def test_cleanup_test_bookings(self):
        """Clean up all test bookings"""
        headers = {
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json"
        }
        
        # Delete test bookings
        response = requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=headers,
            params={
                "renter_id": f"eq.{TEST_RENTER_ID}",
                "check_in": f"eq.{CHECK_IN}"
            }
        )
        
        print(f"Cleanup response: {response.status_code}")
        assert response.status_code in [200, 204]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
