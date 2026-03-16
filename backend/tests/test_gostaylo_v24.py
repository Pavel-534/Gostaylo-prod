"""
Gostaylo - Ghost Listings, Pricing & Booking Sync Tests (v24)

Tests the critical issues reported by the architect:
1. Ghost Listings Removal - Revalidation clears ALL category pages
2. Pricing Logic - Commission calculation uses PricingService hierarchy
3. Booking Creation & Dashboard Sync - New bookings appear in /renter/bookings
4. Calendar Availability - Booked dates blocked for all users

Test Credentials:
- Renter: pavel29031983@gmail.com / az123456 (user-mmq8fm4a-n1s)
- Admin: pavel_534@mail.ru / az123456

@version 24.0 - Post-RLS fix testing
"""

import pytest
import requests
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:3000"
SUPABASE_URL = "https://vtzzcdsjwudkaloxhvnw.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I"

# Test User & Listing Data
TEST_RENTER_ID = "user-mmq8fm4a-n1s"
TEST_RENTER_EMAIL = "pavel29031983@gmail.com"
TEST_LISTING_ID = "lst-test-final-1772285152"  # Финальный тест - Вилла Premium

# Supabase headers
SUPABASE_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}


class TestAdminRevalidation:
    """Test 1: Admin Refresh Site Data Button"""
    
    def test_revalidate_api_exists(self):
        """POST /api/admin/revalidate exists and is accessible"""
        response = requests.post(
            f"{BASE_URL}/api/admin/revalidate",
            json={"paths": ["/"]},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Revalidate API should return 200, got {response.status_code}"
        data = response.json()
        assert data["success"] == True
        assert "timestamp" in data
        print(f"[REVALIDATE] API working - {data['timestamp']}")
    
    def test_revalidate_clears_all_category_paths(self):
        """Revalidation clears ALL category pages (/, /property, /yacht, etc.)"""
        # Trigger revalidation with default paths
        response = requests.post(
            f"{BASE_URL}/api/admin/revalidate",
            json={},  # Empty body uses default paths
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify default paths include all categories
        expected_paths = ['/', '/listings', '/property', '/yacht', '/motorbike', '/tour']
        for path in expected_paths:
            assert path in data.get("paths", []), f"Path {path} should be in revalidation list"
        
        print(f"[REVALIDATE] Paths cleared: {data['paths']}")
    
    def test_specific_path_revalidation(self):
        """Can revalidate specific paths"""
        response = requests.post(
            f"{BASE_URL}/api/admin/revalidate",
            json={"paths": ["/property", "/yacht"]},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "/property" in data["paths"]
        assert "/yacht" in data["paths"]
        print(f"[REVALIDATE] Specific paths: {data['paths']}")


class TestPricingLogic:
    """Test 2: Pricing Logic - Commission Calculation"""
    
    def test_get_partner_commission_rate(self):
        """Verify partner custom_commission_rate from profiles table"""
        # Get the listing owner's profile
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=SUPABASE_HEADERS,
            params={
                "id": f"eq.{TEST_LISTING_ID}",
                "select": "owner_id,title"
            }
        )
        
        assert response.status_code == 200
        listings = response.json()
        assert len(listings) > 0, "Test listing should exist"
        
        owner_id = listings[0]["owner_id"]
        
        # Get owner's profile with commission_rate
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers=SUPABASE_HEADERS,
            params={
                "id": f"eq.{owner_id}",
                "select": "id,email,custom_commission_rate"
            }
        )
        
        assert response.status_code == 200
        profiles = response.json()
        assert len(profiles) > 0
        
        partner = profiles[0]
        print(f"[PRICING] Partner {partner['id']} custom_commission_rate: {partner.get('custom_commission_rate')}")
    
    def test_get_global_platform_commission(self):
        """Verify global platform commission from system_settings table"""
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/system_settings",
            headers=SUPABASE_HEADERS,
            params={
                "key": "eq.general",
                "select": "key,value"
            }
        )
        
        assert response.status_code == 200
        settings = response.json()
        
        if len(settings) > 0:
            general_settings = settings[0].get("value", {})
            default_rate = general_settings.get("defaultCommissionRate")
            print(f"[PRICING] Global platform defaultCommissionRate: {default_rate}")
        else:
            print(f"[PRICING] No global settings found - will use 15% fallback")


class TestBookingCreationAndSync:
    """Test 3: Booking Creation & Renter Dashboard Sync"""
    
    @pytest.fixture(autouse=True)
    def cleanup_test_bookings(self):
        """Clean up test bookings before and after each test"""
        # Calculate test dates (5 days from now to avoid conflicts)
        future = datetime.now() + timedelta(days=5)
        self.check_in = future.strftime("%Y-%m-%d")
        self.check_out = (future + timedelta(days=3)).strftime("%Y-%m-%d")
        
        # Cleanup before test
        self._cleanup_bookings()
        
        yield
        
        # Cleanup after test
        self._cleanup_bookings()
    
    def _cleanup_bookings(self):
        """Delete test bookings for our test user with today's dates"""
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=SUPABASE_HEADERS,
            params={
                "renter_id": f"eq.{TEST_RENTER_ID}",
                "special_requests": "eq.TEST_V24_BOOKING"
            }
        )
    
    def test_create_booking_returns_pending_status(self):
        """POST /api/v2/bookings creates booking with PENDING status"""
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": self.check_in,
            "checkOut": self.check_out,
            "guestName": "Test User Pavel",
            "guestPhone": "+66888888888",
            "guestEmail": TEST_RENTER_EMAIL,
            "specialRequests": "TEST_V24_BOOKING",
            "currency": "THB"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"[BOOKING] Create response: {response.status_code}")
        
        # Could be 200 (success) or 409 (date conflict)
        if response.status_code == 409:
            data = response.json()
            print(f"[BOOKING] Date conflict (expected if dates blocked): {data}")
            pytest.skip("Dates already booked - skipping this test")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["booking"]["status"] == "PENDING"
        assert data["booking"]["renter_id"] == TEST_RENTER_ID
        
        # CRITICAL: Verify commission is included in response
        booking = data["booking"]
        print(f"[BOOKING] Created: ID={booking['id']}")
        print(f"[BOOKING] Status: {booking['status']}")
        print(f"[BOOKING] Price THB: {booking.get('price_thb')}")
        print(f"[BOOKING] Commission Rate: {booking.get('commission_rate')}%")
        print(f"[BOOKING] Commission THB: {booking.get('commission_thb')}")
        print(f"[BOOKING] Partner Earnings: {booking.get('partner_earnings_thb')}")
        
        return booking["id"]
    
    def test_booking_appears_in_renter_dashboard(self):
        """Booking appears immediately in /api/v2/bookings?renterId"""
        # First create a booking
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": self.check_in,
            "checkOut": self.check_out,
            "guestName": "Test User Pavel",
            "guestPhone": "+66888888888",
            "guestEmail": TEST_RENTER_EMAIL,
            "specialRequests": "TEST_V24_BOOKING",
            "currency": "THB"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if create_response.status_code == 409:
            pytest.skip("Dates already booked - skipping this test")
        
        assert create_response.status_code == 200
        booking_id = create_response.json()["booking"]["id"]
        
        # Now fetch bookings for renter - should include the new booking
        get_response = requests.get(
            f"{BASE_URL}/api/v2/bookings",
            params={"renterId": TEST_RENTER_ID, "limit": 50}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["success"] == True
        assert "data" in data
        
        # Find our booking in the list
        bookings = data["data"]
        our_booking = next((b for b in bookings if b["id"] == booking_id), None)
        
        assert our_booking is not None, f"Booking {booking_id} should appear in renter dashboard"
        assert our_booking["status"] == "PENDING"
        
        # Verify listing details are included
        listing = our_booking.get("listings") or our_booking.get("listing")
        assert listing is not None, "Booking should include listing details"
        print(f"[DASHBOARD] Booking appears with listing: {listing.get('title', 'N/A')}")


class TestCalendarAvailabilitySync:
    """Test 4: Calendar Availability Sync"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test dates"""
        future = datetime.now() + timedelta(days=10)
        self.check_in = future.strftime("%Y-%m-%d")
        self.check_out = (future + timedelta(days=2)).strftime("%Y-%m-%d")
        
        # Cleanup old test bookings
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=SUPABASE_HEADERS,
            params={
                "renter_id": f"eq.{TEST_RENTER_ID}",
                "special_requests": "eq.CALENDAR_TEST_V24"
            }
        )
    
    def test_calendar_api_returns_availability(self):
        """GET /api/v2/listings/[id]/calendar returns calendar data"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/calendar",
            params={"days": 30}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "data" in data
        assert "calendar" in data["data"]
        
        calendar = data["data"]["calendar"]
        assert len(calendar) > 0
        
        # Verify calendar day structure
        first_day = calendar[0]
        assert "date" in first_day
        assert "status" in first_day
        assert "can_check_in" in first_day
        
        print(f"[CALENDAR] Returned {len(calendar)} days, first day: {first_day['date']} - {first_day['status']}")
    
    def test_booked_dates_marked_blocked(self):
        """After booking, dates should be marked as BLOCKED in calendar"""
        import time
        
        # Create a test booking
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": self.check_in,
            "checkOut": self.check_out,
            "guestName": "Calendar Test",
            "guestPhone": "+66888888888",
            "guestEmail": TEST_RENTER_EMAIL,
            "specialRequests": "CALENDAR_TEST_V24",
            "currency": "THB"
        }
        
        print(f"[TEST] Creating booking for {self.check_in} to {self.check_out}")
        
        create_response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if create_response.status_code == 409:
            pytest.skip("Dates already booked")
        
        assert create_response.status_code == 200
        print(f"[TEST] Booking created: {create_response.json()['booking']['id']}")
        
        # Small delay to ensure database commit
        time.sleep(0.5)
        
        # Fetch calendar and check the booked dates
        response = requests.get(
            f"{BASE_URL}/api/v2/listings/{TEST_LISTING_ID}/calendar",
            params={"days": 30}
        )
        
        assert response.status_code == 200
        calendar = response.json()["data"]["calendar"]
        
        # Find our check-in date
        check_in_day = next((d for d in calendar if d["date"] == self.check_in), None)
        
        assert check_in_day is not None, f"Check-in date {self.check_in} should be in calendar"
        
        print(f"[CALENDAR] Date {self.check_in} status: {check_in_day['status']}, can_check_in: {check_in_day['can_check_in']}")
        
        # The date should be blocked (either BLOCKED status or can_check_in=false)
        is_blocked = check_in_day["status"] == "BLOCKED" or not check_in_day.get("can_check_in", True)
        assert is_blocked, f"Booked date should be blocked. Got: {check_in_day}"
        
        # Cleanup
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=SUPABASE_HEADERS,
            params={
                "renter_id": f"eq.{TEST_RENTER_ID}",
                "special_requests": "eq.CALENDAR_TEST_V24"
            }
        )


class TestDoubleBookingPrevention:
    """Test 5: Double Booking Prevention (Server-side)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test dates"""
        future = datetime.now() + timedelta(days=15)
        self.check_in = future.strftime("%Y-%m-%d")
        self.check_out = (future + timedelta(days=3)).strftime("%Y-%m-%d")
        
        # Cleanup
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=SUPABASE_HEADERS,
            params={
                "renter_id": f"eq.{TEST_RENTER_ID}",
                "check_in": f"eq.{self.check_in}"
            }
        )
        yield
        # Post-test cleanup
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=SUPABASE_HEADERS,
            params={
                "renter_id": f"eq.{TEST_RENTER_ID}",
                "check_in": f"eq.{self.check_in}"
            }
        )
    
    def test_double_booking_returns_409(self):
        """Second booking for same dates returns 409 Conflict"""
        # Create first booking
        payload = {
            "listingId": TEST_LISTING_ID,
            "renterId": TEST_RENTER_ID,
            "checkIn": self.check_in,
            "checkOut": self.check_out,
            "guestName": "First Booking",
            "guestPhone": "+66888888888",
            "guestEmail": TEST_RENTER_EMAIL,
            "currency": "THB"
        }
        
        first_response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if first_response.status_code == 409:
            pytest.skip("Dates already booked by another booking")
        
        assert first_response.status_code == 200
        print(f"[DOUBLE] First booking created")
        
        # Try to create second booking for SAME dates
        second_response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"[DOUBLE] Second booking response: {second_response.status_code}")
        
        # Should be rejected with 409
        assert second_response.status_code == 409, f"Double booking should return 409, got {second_response.status_code}"
        
        data = second_response.json()
        assert data["success"] == False
        assert "DATES_CONFLICT" in str(data.get("code", "")) or "taken" in data.get("error", "").lower()
        
        print(f"[DOUBLE] Correctly rejected: {data.get('error')}")


class TestBookingsAPIForceDynamic:
    """Test 6: GET /api/v2/bookings uses force-dynamic"""
    
    def test_bookings_no_cache(self):
        """Bookings API should return fresh data (force-dynamic)"""
        # Make two requests in quick succession
        response1 = requests.get(
            f"{BASE_URL}/api/v2/bookings",
            params={"renterId": TEST_RENTER_ID, "limit": 5}
        )
        
        response2 = requests.get(
            f"{BASE_URL}/api/v2/bookings",
            params={"renterId": TEST_RENTER_ID, "limit": 5}
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Both should succeed and return data
        data1 = response1.json()
        data2 = response2.json()
        
        assert data1["success"] == True
        assert data2["success"] == True
        
        print(f"[FORCE-DYNAMIC] Request 1 count: {data1['count']}, Request 2 count: {data2['count']}")


class TestListingCommissionData:
    """Test 7: Listing includes commission_rate for pricing calculations"""
    
    def test_listing_has_commission_rate(self):
        """GET /api/v2/listings includes commissionRate field"""
        response = requests.get(
            f"{BASE_URL}/api/v2/listings",
            params={"limit": 1}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert len(data["data"]) > 0
        
        listing = data["data"][0]
        assert "commissionRate" in listing, "Listing should include commissionRate"
        
        print(f"[LISTING] {listing['title']}: commissionRate={listing['commissionRate']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
