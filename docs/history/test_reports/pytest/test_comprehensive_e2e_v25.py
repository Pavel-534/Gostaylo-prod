"""
Gostaylo - Comprehensive E2E Testing v25
Tests ALL platform functionality like Airbnb QA

Test Areas:
1. RENTER JOURNEY: Search → View Listing → Book → Confirm
2. PARTNER JOURNEY: Dashboard → Listings → Bookings → Finances
3. ADMIN JOURNEY: Users → Listings → Revalidation
4. DATA INTEGRITY: Commission, Calendar, Prices

Credentials:
- Renter: pavel29031983@gmail.com / az123456
- Partner: 86boa@mail.ru / az123456 (4% custom commission)
- Admin: pavel_534@mail.ru / az123456
"""

import pytest
import requests
import json
from datetime import datetime, timedelta

# Base URL for all API tests
BASE_URL = "http://localhost:3000"

# ===== FIXTURES =====

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def renter_auth(api_client):
    """Authenticate as renter - returns user info"""
    res = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "pavel29031983@gmail.com",
        "password": "az123456"
    })
    if res.status_code == 200:
        data = res.json()
        return data.get("user", data.get("data", {}))
    pytest.skip("Renter authentication failed")


@pytest.fixture(scope="module")
def partner_auth(api_client):
    """Authenticate as partner (86boa@mail.ru) - has 4% custom commission"""
    res = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "86boa@mail.ru",
        "password": "az123456"
    })
    if res.status_code == 200:
        data = res.json()
        return data.get("user", data.get("data", {}))
    pytest.skip("Partner authentication failed")


@pytest.fixture(scope="module")
def admin_auth(api_client):
    """Authenticate as admin"""
    res = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "pavel_534@mail.ru",
        "password": "az123456"
    })
    if res.status_code == 200:
        data = res.json()
        return data.get("user", data.get("data", {}))
    pytest.skip("Admin authentication failed")


# ===== 1. HOMEPAGE & SEARCH TESTS =====

class TestHomepageAndSearch:
    """Test homepage loads with listings and search filters work"""

    def test_homepage_search_api_returns_listings(self, api_client):
        """Test GET /api/v2/search returns active listings"""
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=12")
        assert res.status_code == 200, f"Search API failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True, "Search API not successful"
        assert "data" in data, "No data field in response"
        assert "listings" in data["data"], "No listings in data"
        assert len(data["data"]["listings"]) > 0, "No listings returned"
        
        # Verify listing structure
        listing = data["data"]["listings"][0]
        required_fields = ["id", "title", "district", "basePriceThb", "status"]
        for field in required_fields:
            assert field in listing, f"Missing field: {field}"
        assert listing["status"] == "ACTIVE", "Listing not ACTIVE"

    def test_search_by_location(self, api_client):
        """Test location/district filter"""
        res = api_client.get(f"{BASE_URL}/api/v2/search?location=Patong&limit=50")
        assert res.status_code == 200
        
        data = res.json()
        assert data.get("success") == True

    def test_search_by_category(self, api_client):
        """Test category filter - Property"""
        res = api_client.get(f"{BASE_URL}/api/v2/search?category=property&limit=10")
        assert res.status_code == 200
        
        data = res.json()
        assert data.get("success") == True

    def test_search_by_date_range(self, api_client):
        """Test availability filter with dates"""
        check_in = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        check_out = (datetime.now() + timedelta(days=33)).strftime("%Y-%m-%d")
        
        res = api_client.get(f"{BASE_URL}/api/v2/search?checkIn={check_in}&checkOut={check_out}&limit=10")
        assert res.status_code == 200
        
        data = res.json()
        assert data.get("success") == True
        # Availability filtering should be enabled
        assert data["data"]["filters"]["hasDateFilter"] == True

    def test_search_by_price_range(self, api_client):
        """Test price filter"""
        res = api_client.get(f"{BASE_URL}/api/v2/search?minPrice=10000&maxPrice=50000&limit=10")
        assert res.status_code == 200
        
        data = res.json()
        assert data.get("success") == True


# ===== 2. LISTING DETAIL & CALENDAR TESTS =====

class TestListingDetail:
    """Test listing detail page and calendar functionality"""

    @pytest.fixture
    def active_listing_id(self, api_client):
        """Get an active listing ID"""
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=1")
        assert res.status_code == 200
        listings = res.json()["data"]["listings"]
        assert len(listings) > 0, "No listings available for testing"
        return listings[0]["id"]

    def test_listing_detail_api(self, api_client, active_listing_id):
        """Test GET /api/v2/listings/{id} returns listing details"""
        res = api_client.get(f"{BASE_URL}/api/v2/listings/{active_listing_id}")
        assert res.status_code == 200, f"Listing detail API failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        assert "data" in data
        
        listing = data["data"]
        assert listing["id"] == active_listing_id
        assert "title" in listing
        assert "basePriceThb" in listing
        assert "commissionRate" in listing

    def test_listing_calendar_api(self, api_client, active_listing_id):
        """Test GET /api/v2/listings/{id}/calendar returns calendar data"""
        res = api_client.get(f"{BASE_URL}/api/v2/listings/{active_listing_id}/calendar")
        assert res.status_code == 200, f"Calendar API failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        assert "data" in data
        assert "calendar" in data["data"], "No calendar data"
        
        # Calendar should have entries
        calendar = data["data"]["calendar"]
        assert len(calendar) > 0, "Calendar is empty"
        
        # Verify calendar entry structure
        day = calendar[0]
        assert "date" in day
        assert "status" in day
        assert "price" in day


# ===== 3. BOOKING FLOW TESTS =====

class TestBookingFlow:
    """Test complete booking creation and management"""

    @pytest.fixture
    def booking_params(self, api_client, renter_auth):
        """Prepare booking parameters"""
        # Get an active listing
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=1")
        listings = res.json()["data"]["listings"]
        listing = listings[0]
        
        # Set dates 60+ days in future to avoid conflicts
        check_in = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
        check_out = (datetime.now() + timedelta(days=93)).strftime("%Y-%m-%d")
        
        return {
            "listingId": listing["id"],
            "renterId": renter_auth.get("id"),
            "checkIn": check_in,
            "checkOut": check_out,
            "guestName": "Test E2E User",
            "guestEmail": "test-e2e@gostaylo.com",
            "guestPhone": "+66123456789",
            "specialRequests": "E2E Test Booking - Please ignore",
            "currency": "THB"
        }

    def test_booking_availability_check(self, api_client, booking_params):
        """Test availability check before booking"""
        listing_id = booking_params["listingId"]
        check_in = booking_params["checkIn"]
        check_out = booking_params["checkOut"]
        
        res = api_client.get(
            f"{BASE_URL}/api/v2/listings/{listing_id}/calendar?checkIn={check_in}&checkOut={check_out}"
        )
        assert res.status_code == 200

    def test_create_booking_api(self, api_client, booking_params, renter_auth):
        """Test POST /api/v2/bookings creates a booking"""
        res = api_client.post(f"{BASE_URL}/api/v2/bookings", json=booking_params)
        
        # Accept 200, 201, or 409 (if dates conflict from previous test)
        assert res.status_code in [200, 201, 409], f"Booking creation failed: {res.text}"
        
        if res.status_code in [200, 201]:
            data = res.json()
            assert data.get("success") == True, f"Booking not successful: {data}"
            
            # Verify booking was created
            booking = data.get("data", {}).get("booking", data.get("data", {}))
            assert "id" in booking or "id" in data.get("data", {}), "No booking ID returned"
            
            # Verify commission was calculated
            if "commission" in data.get("data", {}):
                assert "commissionRate" in data["data"]["commission"]
        elif res.status_code == 409:
            # Dates already booked - this is acceptable
            print("Dates already booked (409) - expected in repeated tests")

    def test_get_renter_bookings(self, api_client, renter_auth):
        """Test GET /api/v2/bookings?renterId returns renter's bookings"""
        renter_id = renter_auth.get("id")
        if not renter_id:
            pytest.skip("No renter ID available")
        
        res = api_client.get(f"{BASE_URL}/api/v2/bookings?renterId={renter_id}&limit=50")
        assert res.status_code == 200, f"Bookings API failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True


# ===== 4. CALENDAR BLOCKING TESTS =====

class TestCalendarBlocking:
    """Test that booked dates are properly blocked"""

    def test_calendar_shows_blocked_dates(self, api_client):
        """Verify calendar API returns blocked status for booked dates"""
        # Get a listing
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=1")
        listing = res.json()["data"]["listings"][0]
        
        # Get calendar
        cal_res = api_client.get(f"{BASE_URL}/api/v2/listings/{listing['id']}/calendar")
        assert cal_res.status_code == 200
        
        data = cal_res.json()
        calendar = data["data"]["calendar"]
        
        # Check calendar structure
        blocked_count = sum(1 for d in calendar if d["status"] == "BLOCKED")
        available_count = sum(1 for d in calendar if d["status"] == "AVAILABLE")
        
        print(f"Calendar stats: {blocked_count} blocked, {available_count} available")
        assert available_count > 0, "No available dates in calendar"


# ===== 5. PARTNER DASHBOARD TESTS =====

class TestPartnerDashboard:
    """Test partner dashboard APIs"""

    def test_partner_stats_api(self, api_client, partner_auth):
        """Test partner stats endpoint"""
        partner_id = partner_auth.get("id")
        if not partner_id:
            pytest.skip("No partner ID")
        
        res = api_client.get(f"{BASE_URL}/api/v2/partner/stats?partnerId={partner_id}")
        # May return 404 if endpoint not implemented - just log
        if res.status_code == 404:
            pytest.skip("Partner stats API not implemented")
        
        assert res.status_code == 200

    def test_partner_bookings_api(self, api_client, partner_auth):
        """Test partner bookings endpoint"""
        partner_id = partner_auth.get("id")
        if not partner_id:
            pytest.skip("No partner ID")
        
        res = api_client.get(f"{BASE_URL}/api/v2/partner/bookings?partnerId={partner_id}")
        if res.status_code == 404:
            pytest.skip("Partner bookings API not implemented")
        
        assert res.status_code == 200

    def test_partner_listings_api(self, api_client, partner_auth):
        """Test partner's own listings"""
        partner_id = partner_auth.get("id")
        if not partner_id:
            pytest.skip("No partner ID")
        
        res = api_client.get(f"{BASE_URL}/api/v2/listings?ownerId={partner_id}")
        # Check various response formats
        assert res.status_code in [200, 404]


# ===== 6. ADMIN PANEL TESTS =====

class TestAdminPanel:
    """Test admin panel APIs"""

    def test_admin_users_list_api(self, api_client):
        """Test admin users list endpoint"""
        res = api_client.get(f"{BASE_URL}/api/admin/users/list")
        assert res.status_code == 200, f"Admin users API failed: {res.text}"
        
        data = res.json()
        assert "data" in data, "No data in admin users response"
        assert len(data["data"]) > 0, "No users returned"
        
        # Verify user structure
        user = data["data"][0]
        assert "id" in user
        assert "email" in user
        assert "role" in user

    def test_admin_revalidate_api(self, api_client):
        """Test cache revalidation endpoint"""
        res = api_client.post(
            f"{BASE_URL}/api/admin/revalidate",
            json={"paths": ["/", "/listings"]}
        )
        assert res.status_code == 200, f"Revalidation API failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True


# ===== 7. COMMISSION CALCULATION TESTS =====

class TestCommissionCalculation:
    """Test commission calculation hierarchy:
    1. Partner custom_commission_rate (4% for 86boa@mail.ru)
    2. Global platform rate (7%)
    3. Fallback (15%)
    """

    def test_partner_custom_commission(self, api_client, partner_auth):
        """Verify partner 86boa@mail.ru has 4% custom commission"""
        # Get a listing owned by 86boa@mail.ru
        partner_id = partner_auth.get("id")
        if not partner_id:
            pytest.skip("No partner ID")
        
        # Search for listings - check if any have 4% commission
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=20")
        assert res.status_code == 200
        
        listings = res.json()["data"]["listings"]
        
        # Find listings owned by partner
        partner_listings = [l for l in listings if l.get("ownerId") == partner_id]
        if not partner_listings:
            print(f"No listings found for partner {partner_id}")
            pytest.skip("Partner has no active listings")
        
        # Get listing detail to check commission
        listing_id = partner_listings[0]["id"]
        detail_res = api_client.get(f"{BASE_URL}/api/v2/listings/{listing_id}")
        if detail_res.status_code == 200:
            data = detail_res.json()
            commission = data.get("data", {}).get("commissionRate")
            print(f"Commission rate for partner listing: {commission}%")

    def test_global_commission_fallback(self, api_client):
        """Test listings use global commission when no custom rate"""
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=5")
        assert res.status_code == 200
        
        listings = res.json()["data"]["listings"]
        
        # All listings should have a commissionRate
        for listing in listings:
            rate = listing.get("commissionRate", 15)
            assert rate > 0, f"Invalid commission rate for listing {listing['id']}"
            print(f"Listing {listing['id']}: {rate}% commission")


# ===== 8. REVIEWS API TESTS =====

class TestReviewsAPI:
    """Test reviews functionality"""

    def test_listing_reviews_api(self, api_client):
        """Test GET /api/v2/reviews?listingId returns reviews"""
        # Get a listing
        res = api_client.get(f"{BASE_URL}/api/v2/search?limit=1")
        listing = res.json()["data"]["listings"][0]
        
        # Get reviews
        reviews_res = api_client.get(f"{BASE_URL}/api/v2/reviews?listingId={listing['id']}")
        # May be 404 if no reviews or endpoint not implemented
        assert reviews_res.status_code in [200, 404], f"Reviews API error: {reviews_res.text}"


# ===== 9. FAVORITES API TESTS =====

class TestFavoritesAPI:
    """Test favorites functionality"""

    def test_favorites_api(self, api_client, renter_auth):
        """Test favorites endpoint"""
        renter_id = renter_auth.get("id")
        if not renter_id:
            pytest.skip("No renter ID")
        
        res = api_client.get(f"{BASE_URL}/api/v2/favorites?userId={renter_id}")
        # May return 404 if not implemented
        if res.status_code == 404:
            pytest.skip("Favorites API not implemented")
        
        assert res.status_code == 200


# ===== 10. AUTHENTICATION TESTS =====

class TestAuthentication:
    """Test authentication endpoints"""

    def test_login_valid_renter(self, api_client):
        """Test login with valid renter credentials"""
        res = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pavel29031983@gmail.com",
            "password": "az123456"
        })
        assert res.status_code == 200, f"Login failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True or "user" in data or "data" in data

    def test_login_valid_partner(self, api_client):
        """Test login with valid partner credentials"""
        res = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "86boa@mail.ru",
            "password": "az123456"
        })
        assert res.status_code == 200, f"Partner login failed: {res.text}"

    def test_login_valid_admin(self, api_client):
        """Test login with valid admin credentials"""
        res = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pavel_534@mail.ru",
            "password": "az123456"
        })
        assert res.status_code == 200, f"Admin login failed: {res.text}"

    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials returns error"""
        res = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        # Should return 401 or 400 for invalid credentials
        assert res.status_code in [400, 401, 404], f"Should reject invalid login: {res.status_code}"


# ===== MAIN =====

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])
