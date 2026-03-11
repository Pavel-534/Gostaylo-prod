"""
Phase 2: Renter Booking Flow Tests
Tests for booking creation with commission, availability check, and price breakdown

Features tested:
1. GET /api/v2/listings/{id}/availability - blocked dates check
2. POST /api/v2/bookings - create booking with dates, guestName, guestEmail, specialRequests
3. Verify booking status is PENDING
4. Verify commission_thb is calculated correctly
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

# Base URL for testing (Next.js app on port 3000)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000').rstrip('/')

# Supabase credentials for direct DB verification
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://vtzzcdsjwudkaloxhvnw.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I')

# Test listing ID
TEST_LISTING_ID = 'lst-696041b6'


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def supabase_client():
    """Direct Supabase client for DB verification"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
    })
    return session


class TestAvailabilityAPI:
    """Test GET /api/v2/listings/{id}/availability"""
    
    def test_availability_returns_blocked_dates(self, api_client):
        """Test that availability endpoint returns blocked dates correctly"""
        # Use future dates to avoid conflicts
        start_date = (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=95)).strftime('%Y-%m-%d')
        
        response = api_client.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": start_date, "endDate": end_date}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned error: {data}"
        assert "blockedDates" in data, "Response should include blockedDates array"
        assert "available" in data, "Response should include available boolean"
        
        print(f"✓ Availability check passed: available={data.get('available')}, blocked={len(data.get('blockedDates', []))} dates")
    
    def test_availability_requires_dates(self, api_client):
        """Test that availability endpoint requires start and end dates"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability"
        )
        
        assert response.status_code == 400, f"Expected 400 for missing dates, got {response.status_code}"
        data = response.json()
        assert data.get("success") == False
        print("✓ Availability endpoint correctly requires dates")
    
    def test_availability_invalid_date_format(self, api_client):
        """Test that availability endpoint rejects invalid dates"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/availability",
            params={"startDate": "invalid", "endDate": "2026-05-05"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid date, got {response.status_code}"
        print("✓ Availability endpoint correctly rejects invalid dates")


class TestBookingCreationAPI:
    """Test POST /api/v2/bookings - booking creation with commission"""
    
    def test_create_booking_success(self, api_client, supabase_client):
        """Test successful booking creation with all fields"""
        # Generate unique dates to avoid conflicts - use random offset
        import random
        unique_suffix = uuid.uuid4().hex[:6]
        random_offset = random.randint(200, 300)
        check_in = (datetime.now() + timedelta(days=random_offset)).strftime('%Y-%m-%d')
        check_out = (datetime.now() + timedelta(days=random_offset + 5)).strftime('%Y-%m-%d')
        
        booking_data = {
            "listingId": TEST_LISTING_ID,
            "checkIn": check_in,
            "checkOut": check_out,
            "guestName": f"TEST_User_{unique_suffix}",
            "guestEmail": "test@gostaylo.com",
            "guestPhone": "+7999123456",
            "specialRequests": "Late check-in please",
            "currency": "THB"
        }
        
        response = api_client.post(f"{BASE_URL}/api/v2/bookings", json=booking_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Booking creation failed: {data}"
        assert "booking" in data, "Response should include booking object"
        
        booking = data["booking"]
        booking_id = booking.get("id")
        
        # Verify booking fields
        assert booking.get("status") == "PENDING", f"Expected PENDING status, got {booking.get('status')}"
        assert booking.get("guest_name") == booking_data["guestName"], "Guest name mismatch"
        assert booking.get("guest_email") == booking_data["guestEmail"], "Guest email mismatch"
        assert booking.get("special_requests") == booking_data["specialRequests"], "Special requests mismatch"
        assert booking.get("check_in") == check_in, "Check-in date mismatch"
        assert booking.get("check_out") == check_out, "Check-out date mismatch"
        
        # Verify commission is calculated
        assert booking.get("commission_thb") is not None, "commission_thb should be set"
        assert float(booking.get("commission_thb", 0)) > 0, "commission_thb should be > 0"
        
        print(f"✓ Booking created: {booking_id}")
        print(f"  - Status: {booking.get('status')}")
        print(f"  - Price: ฿{booking.get('price_thb')}")
        print(f"  - Commission: ฿{booking.get('commission_thb')}")
        
        # Verify booking persisted in DB
        db_response = supabase_client.get(
            f"{SUPABASE_URL}/rest/v1/bookings",
            params={"id": f"eq.{booking_id}", "select": "id,status,price_thb,commission_thb,guest_name"}
        )
        
        assert db_response.status_code == 200, f"DB query failed: {db_response.text}"
        db_data = db_response.json()
        assert len(db_data) == 1, f"Booking not found in DB: {booking_id}"
        
        db_booking = db_data[0]
        assert db_booking["status"] == "PENDING", "DB status should be PENDING"
        assert float(db_booking["commission_thb"]) > 0, "DB commission_thb should be > 0"
        
        print(f"✓ Booking verified in database: status={db_booking['status']}, commission=฿{db_booking['commission_thb']}")
    
    def test_create_booking_missing_required_fields(self, api_client):
        """Test booking creation fails without required fields"""
        # Missing listingId
        response = api_client.post(f"{BASE_URL}/api/v2/bookings", json={
            "checkIn": "2026-07-01",
            "checkOut": "2026-07-05",
            "guestName": "Test User"
        })
        
        assert response.status_code == 400, f"Expected 400 for missing listingId, got {response.status_code}"
        data = response.json()
        assert data.get("success") == False
        print("✓ Booking creation correctly fails without required fields")
    
    def test_create_booking_invalid_dates(self, api_client):
        """Test booking creation fails with invalid date range"""
        # End date before start date
        response = api_client.post(f"{BASE_URL}/api/v2/bookings", json={
            "listingId": TEST_LISTING_ID,
            "checkIn": "2026-07-10",
            "checkOut": "2026-07-05",  # Before check-in
            "guestName": "Test User",
            "guestEmail": "test@gostaylo.com"
        })
        
        # Should fail with error
        data = response.json()
        # Either 400 status or success=false
        if response.status_code == 200:
            assert data.get("success") == False, "Should fail for invalid date range"
        else:
            assert response.status_code == 400
        print("✓ Booking creation correctly validates date range")


class TestBookingPriceCalculation:
    """Test price breakdown and commission calculation"""
    
    def test_price_breakdown_included(self, api_client):
        """Test that booking response includes price breakdown"""
        import random
        random_offset = random.randint(350, 450)
        check_in = (datetime.now() + timedelta(days=random_offset)).strftime('%Y-%m-%d')
        check_out = (datetime.now() + timedelta(days=random_offset + 4)).strftime('%Y-%m-%d')  # 4 nights
        
        response = api_client.post(f"{BASE_URL}/api/v2/bookings", json={
            "listingId": TEST_LISTING_ID,
            "checkIn": check_in,
            "checkOut": check_out,
            "guestName": "TEST_PriceBreakdown_User",
            "guestEmail": "test@gostaylo.com",
            "guestPhone": "+7999000000",
            "currency": "THB"
        })
        
        assert response.status_code == 200, f"Booking failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        booking = data.get("booking", {})
        
        # Verify price breakdown is included
        price_breakdown = booking.get("priceBreakdown")
        assert price_breakdown is not None, "Price breakdown should be included"
        assert len(price_breakdown) == 4, f"Expected 4 nights in breakdown, got {len(price_breakdown)}"
        
        # Verify commission data
        commission = booking.get("commission")
        assert commission is not None, "Commission data should be included"
        assert "commissionRate" in commission, "Commission rate should be specified"
        assert "commissionThb" in commission, "Commission THB should be specified"
        assert "partnerEarnings" in commission, "Partner earnings should be specified"
        
        total_price = float(booking.get("price_thb", 0))
        commission_thb = float(commission.get("commissionThb", 0))
        partner_earnings = float(commission.get("partnerEarnings", 0))
        
        # Verify commission math: total = commission + partner_earnings
        assert abs((commission_thb + partner_earnings) - total_price) < 1, \
            f"Commission math incorrect: {commission_thb} + {partner_earnings} != {total_price}"
        
        print(f"✓ Price breakdown verified:")
        print(f"  - Total: ฿{total_price}")
        print(f"  - Commission rate: {commission.get('commissionRate')}%")
        print(f"  - Commission: ฿{commission_thb}")
        print(f"  - Partner earnings: ฿{partner_earnings}")


class TestGetBookingsAPI:
    """Test GET /api/v2/bookings - list bookings"""
    
    def test_get_bookings_by_listing(self, api_client):
        """Test fetching bookings filtered by listing ID"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/bookings",
            params={"listingId": TEST_LISTING_ID, "limit": 5}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned error: {data}"
        assert "data" in data, "Response should include data array"
        
        bookings = data.get("data", [])
        print(f"✓ Found {len(bookings)} bookings for listing {TEST_LISTING_ID}")
        
        # All returned bookings should be for the test listing
        for b in bookings:
            assert b.get("listing_id") == TEST_LISTING_ID, f"Booking {b.get('id')} has wrong listing_id"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
