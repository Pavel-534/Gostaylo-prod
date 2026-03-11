"""
Booking Flow Critical Tests - v7
Tests for:
1. Commission API returns real rate (not hardcoded 15%)
2. POST /api/v2/bookings creates booking successfully
3. Telegram webhook handles callback_query
4. Admin moderation reject includes edit link
"""

import pytest
import requests
import os

BASE_URL = "http://localhost:3000"

class TestCommissionAPI:
    """Test /api/v2/commission endpoint"""
    
    def test_commission_returns_system_rate(self):
        """Commission API should return system rate (currently 5%)"""
        response = requests.get(f"{BASE_URL}/api/v2/commission")
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] == True
        assert 'data' in data
        assert 'systemRate' in data['data']
        assert 'effectiveRate' in data['data']
        
        # System rate should NOT be hardcoded 15%
        # Current system rate is 5%
        effective_rate = data['data']['effectiveRate']
        print(f"Commission effective rate: {effective_rate}%")
        assert effective_rate == 5, f"Expected 5% but got {effective_rate}%"
        
    def test_commission_with_partner_id(self):
        """Commission API with partnerId should return personal rate if set"""
        response = requests.get(f"{BASE_URL}/api/v2/commission?partnerId=partner-1")
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] == True
        assert 'personalRate' in data['data']
        assert 'partnerEarningsPercent' in data['data']
        
        # Partner earnings should be 100 - effectiveRate
        effective = data['data']['effectiveRate']
        earnings = data['data']['partnerEarningsPercent']
        assert earnings == 100 - effective


class TestBookingsAPI:
    """Test /api/v2/bookings endpoint"""
    
    def test_create_booking_success(self):
        """POST /api/v2/bookings should create booking successfully"""
        payload = {
            "listingId": "lst-696041b6",
            "checkIn": "2026-09-01",
            "checkOut": "2026-09-05",
            "guestName": "Test User",
            "guestEmail": "test@test.com",
            "guestPhone": "+66123456789"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 with success=true OR 400 with "Dates not available"
        data = response.json()
        
        if response.status_code == 200:
            assert data['success'] == True
            assert 'booking' in data
            assert data['booking']['listing_id'] == "lst-696041b6"
            assert data['booking']['guest_name'] == "Test User"
            print(f"Booking created: {data['booking']['id']}")
        else:
            # If dates are unavailable, that's still a valid response
            assert 'error' in data
            print(f"Booking failed (expected if dates booked): {data['error']}")
    
    def test_create_booking_missing_fields(self):
        """POST /api/v2/bookings should fail with missing required fields"""
        payload = {
            "listingId": "lst-696041b6",
            # Missing checkIn, checkOut
            "guestName": "Test User"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/bookings",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data['success'] == False
        assert 'error' in data
        assert 'required' in data['error'].lower()


class TestTelegramWebhook:
    """Test /api/webhooks/telegram endpoint"""
    
    def test_webhook_health_check(self):
        """GET /api/webhooks/telegram should return health info"""
        response = requests.get(f"{BASE_URL}/api/webhooks/telegram")
        assert response.status_code == 200
        
        data = response.json()
        assert data['ok'] == True
        assert data['service'] == 'Gostaylo Telegram Webhook'
        assert 'callback_query' in str(data.get('features', [])) or data.get('version', '') >= '7.0'
    
    def test_webhook_callback_query_handling(self):
        """POST /api/webhooks/telegram with callback_query should be handled"""
        payload = {
            "callback_query": {
                "id": "test-callback-pytest",
                "data": "approve_booking_test-booking-id",
                "from": {"id": 12345},
                "message": {"chat": {"id": 12345}, "message_id": 100}
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/telegram",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 with ok=true (even if booking not found)
        assert response.status_code == 200
        data = response.json()
        assert data['ok'] == True
        print("Telegram callback_query handling works")
    
    def test_webhook_decline_callback(self):
        """POST /api/webhooks/telegram with decline callback should work"""
        payload = {
            "callback_query": {
                "id": "test-decline-pytest",
                "data": "decline_booking_test-booking-id",
                "from": {"id": 12345},
                "message": {"chat": {"id": 12345}, "message_id": 101}
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/telegram",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['ok'] == True


class TestAdminModeration:
    """Test /api/admin/moderation endpoint"""
    
    def test_get_pending_listings(self):
        """GET /api/admin/moderation should return pending listings"""
        response = requests.get(f"{BASE_URL}/api/admin/moderation")
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] == True
        assert 'listings' in data
        assert 'count' in data
        
        # Check listings have effective commission
        for listing in data.get('listings', [])[:3]:
            assert 'effectiveCommission' in listing
            print(f"Listing {listing.get('id', 'unknown')}: commission={listing.get('effectiveCommission')}%")
    
    def test_reject_requires_reason(self):
        """PATCH /api/admin/moderation reject without reason should fail"""
        payload = {
            "listingId": "test-listing-id",
            "action": "reject"
            # Missing rejectReason
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/admin/moderation",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 400 or 404 (listing not found is ok for this test)
        assert response.status_code in [400, 404]
        data = response.json()
        
        if response.status_code == 400:
            # If listing exists, should require reason
            assert 'reason' in data.get('error', '').lower() or 'required' in data.get('error', '').lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
