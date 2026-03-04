"""
FunnyRent 2.1 - Stage 33.1 Backend Tests
Tests for: Booking API, Admin Stats, Partner Stats, Dashboard Routes
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')

class TestBookingAPI:
    """Tests for /api/v2/bookings endpoint"""
    
    def test_booking_create_guest(self):
        """Test creating a booking as guest (no renterId)"""
        response = requests.post(f"{BASE_URL}/api/v2/bookings", json={
            "listingId": "lst-test-final-1772285152",
            "checkIn": "2026-11-01",
            "checkOut": "2026-11-03",
            "guestName": "Test Guest Stage331",
            "guestPhone": "+66812345678",
            "guestEmail": "test331@test.com",
            "currency": "THB"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'data' in data
        assert data['data'].get('id') is not None
        assert data['data'].get('status') == 'PENDING'
        assert data['data'].get('guest_name') == "Test Guest Stage331"
        print(f"✓ Booking created: {data['data']['id']}")
    
    def test_booking_create_missing_fields(self):
        """Test booking creation fails without required fields"""
        response = requests.post(f"{BASE_URL}/api/v2/bookings", json={
            "guestName": "Test Guest"
        })
        
        assert response.status_code == 400
        data = response.json()
        assert data.get('success') == False
        print("✓ Missing fields returns 400 error")
    
    def test_booking_list_by_listing(self):
        """Test listing bookings by listing ID"""
        response = requests.get(f"{BASE_URL}/api/v2/bookings", params={
            "listingId": "lst-test-final-1772285152"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'data' in data
        assert isinstance(data['data'], list)
        print(f"✓ Found {len(data['data'])} bookings for listing")
    
    def test_booking_list_by_partner(self):
        """Test listing bookings by partner ID"""
        response = requests.get(f"{BASE_URL}/api/v2/bookings", params={
            "partnerId": "partner-1"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        print(f"✓ Found {len(data.get('data', []))} bookings for partner")


class TestAdminStats:
    """Tests for /api/v2/admin/stats endpoint"""
    
    def test_admin_stats_returns_data(self):
        """Test admin stats returns required fields"""
        response = requests.get(f"{BASE_URL}/api/v2/admin/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'data' in data
        
        stats = data['data']
        assert 'users' in stats
        assert 'listings' in stats
        assert 'bookings' in stats
        assert 'revenue' in stats
        
        # Check user counts
        assert stats['users'].get('total') is not None
        assert stats['users'].get('partners') is not None
        assert stats['users'].get('renters') is not None
        
        # Check listing counts
        assert stats['listings'].get('active') is not None
        print(f"✓ Admin stats: {stats['users']['total']} users, {stats['listings']['active']} active listings")


class TestPartnerStats:
    """Tests for /api/v2/partner/stats endpoint"""
    
    def test_partner_stats_requires_partner_id(self):
        """Test partner stats fails without partnerId"""
        response = requests.get(f"{BASE_URL}/api/v2/partner/stats")
        
        assert response.status_code == 400
        data = response.json()
        assert data.get('success') == False
        print("✓ Partner stats requires partnerId")
    
    def test_partner_stats_returns_data(self):
        """Test partner stats returns data for valid partner"""
        response = requests.get(f"{BASE_URL}/api/v2/partner/stats", params={
            "partnerId": "partner-1"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'data' in data
        
        stats = data['data']
        assert 'partner' in stats
        assert 'listings' in stats
        assert 'bookings' in stats
        assert 'balance' in stats
        print(f"✓ Partner stats: {stats['listings'].get('total', 0)} listings, {stats['bookings'].get('total', 0)} bookings")


class TestListingsAPI:
    """Tests for /api/v2/listings endpoint"""
    
    def test_listings_returns_active(self):
        """Test listings returns active listings"""
        response = requests.get(f"{BASE_URL}/api/v2/listings", params={
            "limit": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'data' in data
        assert isinstance(data['data'], list)
        print(f"✓ Found {len(data['data'])} listings")


class TestRLSSQLScript:
    """Tests for RLS SQL script existence"""
    
    def test_rls_script_v2_exists(self):
        """Test that RLS v2 script exists"""
        script_path = "/app/database/rls_policies_v2.sql"
        assert os.path.exists(script_path), f"RLS v2 script not found at {script_path}"
        
        with open(script_path, 'r') as f:
            content = f.read()
        
        # Check for TEXT casting
        assert '::text' in content, "RLS script should contain ::text casting"
        assert 'auth.uid()::text' in content, "RLS script should cast auth.uid() to text"
        assert 'current_user_id()' in content, "RLS script should define current_user_id function"
        
        print("✓ RLS v2 script exists with TEXT casting")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
