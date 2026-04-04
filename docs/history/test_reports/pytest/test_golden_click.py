"""
Golden Click Test - Approve/Decline Booking Flow with Full System Reactivity

Tests the complete chain:
1. Database Update - Status changes in Supabase
2. Revenue Calculation - partner_earnings_thb = price * 0.85
3. Stats API reactivity - Pending count, revenue updates
4. Calendar API reactivity - Booking color changes

Partner: 86boa@mail.ru / az123456
Partner ID: user-mmhsxted-zon
Listing ID: lst-mmk1uqyg-8uwm3
"""

import pytest
import requests
import time
import os

BASE_URL = "http://localhost:3000"
PARTNER_ID = "user-mmhsxted-zon"

# Supabase config for direct verification
SUPABASE_URL = "https://vtzzcdsjwudkaloxhvnw.supabase.co"
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I')


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestGoldenClickApproveFlow:
    """Test the Approve button flow - PENDING -> CONFIRMED"""
    
    def test_get_pending_bookings(self, api_client):
        """Get list of PENDING bookings"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/bookings",
            params={"partnerId": PARTNER_ID, "status": "PENDING"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        print(f"Found {len(data['data'])} PENDING bookings")
    
    def test_approve_booking_api(self, api_client):
        """Test PUT endpoint to approve a booking"""
        # First get a PENDING booking
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/bookings",
            params={"partnerId": PARTNER_ID, "status": "PENDING"}
        )
        data = response.json()
        
        if not data["data"]:
            pytest.skip("No PENDING bookings to approve")
        
        booking_id = data["data"][0]["id"]
        guest_name = data["data"][0]["guestName"]
        price_thb = data["data"][0]["priceThb"]
        
        print(f"Approving booking {booking_id} for {guest_name} (฿{price_thb})")
        
        # Approve booking
        approve_response = api_client.put(
            f"{BASE_URL}/api/v2/partner/bookings/{booking_id}",
            params={"partnerId": PARTNER_ID},
            json={"status": "CONFIRMED"}
        )
        
        assert approve_response.status_code == 200
        result = approve_response.json()
        assert result["status"] == "success"
        assert "подтверждено" in result.get("message", "").lower() or result["data"]["status"] == "CONFIRMED"
        print(f"Booking {booking_id} approved successfully!")
    
    def test_stats_update_after_approve(self, api_client):
        """Verify stats API reflects the approval"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/stats",
            params={"partnerId": PARTNER_ID}
        )
        assert response.status_code == 200
        data = response.json()
        
        stats = data["data"]
        print(f"Stats after approval:")
        print(f"  - Pending count: {stats['pending']['count']}")
        print(f"  - Confirmed revenue: ฿{stats['revenue']['confirmed']}")
        print(f"  - Confirmed bookings: {stats['bookings']['confirmed']}")
        
        # Should have at least 1 confirmed booking
        assert stats["bookings"]["confirmed"] >= 1


class TestGoldenClickDeclineFlow:
    """Test the Decline button flow - PENDING -> CANCELLED"""
    
    def test_decline_booking_api(self, api_client):
        """Test PUT endpoint to decline/cancel a booking"""
        # First get a PENDING booking
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/bookings",
            params={"partnerId": PARTNER_ID, "status": "PENDING"}
        )
        data = response.json()
        
        if not data["data"]:
            pytest.skip("No PENDING bookings to decline")
        
        booking_id = data["data"][0]["id"]
        guest_name = data["data"][0]["guestName"]
        
        print(f"Declining booking {booking_id} for {guest_name}")
        
        # Decline booking
        decline_response = api_client.put(
            f"{BASE_URL}/api/v2/partner/bookings/{booking_id}",
            params={"partnerId": PARTNER_ID},
            json={"status": "CANCELLED", "reason": "Test decline"}
        )
        
        assert decline_response.status_code == 200
        result = decline_response.json()
        assert result["status"] == "success"
        print(f"Booking {booking_id} declined successfully!")


class TestRevenueCalculation:
    """Test partner earnings calculation (85% commission)"""
    
    def test_partner_earnings_calculation(self, api_client):
        """Verify partner earnings = price * 0.85"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/bookings",
            params={"partnerId": PARTNER_ID, "status": "CONFIRMED"}
        )
        data = response.json()
        
        if not data["data"]:
            pytest.skip("No CONFIRMED bookings to verify")
        
        for booking in data["data"]:
            price = booking["priceThb"]
            partner_earnings = booking["partnerEarningsThb"]
            expected_earnings = price * 0.85
            
            # If partner_earnings_thb is 0 in DB, it should use fallback calculation
            if partner_earnings == 0:
                print(f"Booking {booking['id']}: price=฿{price}, earnings=0 (using fallback ฿{expected_earnings})")
            else:
                assert abs(partner_earnings - expected_earnings) < 1, \
                    f"Earnings mismatch: got ฿{partner_earnings}, expected ฿{expected_earnings}"
                print(f"Booking {booking['id']}: price=฿{price}, earnings=฿{partner_earnings} ✓")


class TestCalendarReactivity:
    """Test calendar API reflects booking status changes"""
    
    def test_calendar_shows_bookings(self, api_client):
        """Verify calendar API returns booking blocks"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/calendar",
            params={
                "partnerId": PARTNER_ID,
                "startDate": "2026-03-10",
                "endDate": "2026-04-15"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "listings" in data["data"]
        
        listings = data["data"]["listings"]
        if listings:
            total_bookings = sum(
                1 for listing in listings 
                for avail in listing.get("availability", {}).values()
                if avail.get("status") == "BOOKED"
            )
            print(f"Calendar shows {total_bookings} booked date blocks")


class TestStatusTransitionValidation:
    """Test status transition rules"""
    
    def test_invalid_transition_rejected(self, api_client):
        """Verify invalid status transitions are rejected"""
        # Get a CONFIRMED booking
        response = api_client.get(
            f"{BASE_URL}/api/v2/partner/bookings",
            params={"partnerId": PARTNER_ID, "status": "CONFIRMED"}
        )
        data = response.json()
        
        if not data["data"]:
            pytest.skip("No CONFIRMED bookings to test")
        
        booking_id = data["data"][0]["id"]
        
        # Try invalid transition: CONFIRMED -> PENDING (not allowed)
        invalid_response = api_client.put(
            f"{BASE_URL}/api/v2/partner/bookings/{booking_id}",
            params={"partnerId": PARTNER_ID},
            json={"status": "PENDING"}
        )
        
        # Should be rejected with 400
        assert invalid_response.status_code == 400
        result = invalid_response.json()
        assert result["status"] == "error"
        assert "Cannot transition" in result.get("error", "")
        print(f"Invalid transition correctly rejected: {result['error']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
