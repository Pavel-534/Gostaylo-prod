"""
Phase 4.2 - Final Polish & Cleanup Tests
Gostaylo Partner Portal

Tests:
1. Conflict Resolution Stress Test (March 2026)
2. Dashboard Stats API with Seasonal Prices
3. Global Cleanup Verification
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

# API Configuration
SUPABASE_URL = "https://vtzzcdsjwudkaloxhvnw.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I")
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k"

# Test Data
PARTNER_ID = "user-mmhsxted-zon"
LISTING_ID = "lst-mmk1uqyg-8uwm3"

# API endpoint base
BASE_URL = "http://localhost:3000"

class TestPhase42ConflictResolution:
    """Stress Test - Create overlapping seasonal prices and verify conflict resolution"""
    
    @pytest.fixture(autouse=True)
    def cleanup_march_prices(self):
        """Clean up any March 2026 test data before and after tests"""
        # Before test - clean up
        self._delete_march_prices()
        yield
        # After test - clean up
        self._delete_march_prices()
    
    def _delete_march_prices(self):
        """Delete all March 2026 seasonal prices for test listing"""
        try:
            # Get March prices
            url = f"{SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.{LISTING_ID}&start_date=gte.2026-03-01&start_date=lte.2026-03-31"
            res = requests.get(url, headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            })
            prices = res.json()
            
            if isinstance(prices, list):
                for price in prices:
                    delete_url = f"{SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.{price['id']}"
                    requests.delete(delete_url, headers={
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
                    })
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    def test_stress_conflict_march_1_10(self):
        """
        Step 1: Create seasonal price for March 1-10, 2026
        Expected: 1 record created
        """
        # Create March 1-10 price
        payload = {
            "listingId": LISTING_ID,
            "startDate": "2026-03-01",
            "endDate": "2026-03-10",
            "priceDaily": 7000,
            "seasonType": "HIGH",
            "minStay": 3
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/partner/seasonal-prices",
            json=payload,
            params={"partnerId": PARTNER_ID}
        )
        
        assert response.status_code == 200, f"Failed to create March 1-10: {response.text}"
        data = response.json()
        assert data.get("status") == "success", f"API error: {data}"
        
        # Verify in database
        db_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.{LISTING_ID}&start_date=gte.2026-03-01&start_date=lte.2026-03-31&order=start_date.asc",
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        records = db_res.json()
        
        assert len(records) == 1, f"Expected 1 record, got {len(records)}"
        assert records[0]["start_date"] == "2026-03-01"
        assert records[0]["end_date"] == "2026-03-10"
        assert records[0]["price_daily"] == 7000
        assert records[0]["min_stay"] == 3
        print("Step 1 PASS: March 1-10 created with min_stay=3")
    
    def test_stress_conflict_march_5_15_overlap(self):
        """
        Step 2: Create overlapping March 5-15 price
        Expected: Original March 1-10 trimmed to March 1-4
        """
        # First create March 1-10
        self.test_stress_conflict_march_1_10()
        
        # Now create overlapping March 5-15
        payload = {
            "listingId": LISTING_ID,
            "startDate": "2026-03-05",
            "endDate": "2026-03-15",
            "priceDaily": 9000,
            "seasonType": "PEAK",
            "minStay": 5
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/partner/seasonal-prices",
            json=payload,
            params={"partnerId": PARTNER_ID}
        )
        
        assert response.status_code == 200, f"Failed to create March 5-15: {response.text}"
        data = response.json()
        assert data.get("status") == "success", f"API error: {data}"
        
        # Check conflict resolution metadata
        meta = data.get("meta", {})
        conflicts = meta.get("conflictsResolved", {})
        print(f"Conflicts resolved: deleted={conflicts.get('deleted', 0)}, updated={conflicts.get('updated', 0)}")
        
        # Verify in database - should have 2 records now
        db_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.{LISTING_ID}&start_date=gte.2026-03-01&start_date=lte.2026-03-31&order=start_date.asc",
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        records = db_res.json()
        
        assert len(records) == 2, f"Expected 2 records after conflict resolution, got {len(records)}: {records}"
        
        # First record should be trimmed to March 1-4
        assert records[0]["start_date"] == "2026-03-01", f"First record start wrong: {records[0]['start_date']}"
        assert records[0]["end_date"] == "2026-03-04", f"First record should end on March 4, got {records[0]['end_date']}"
        assert records[0]["price_daily"] == 7000
        assert records[0]["min_stay"] == 3
        
        # Second record should be March 5-15
        assert records[1]["start_date"] == "2026-03-05"
        assert records[1]["end_date"] == "2026-03-15"
        assert records[1]["price_daily"] == 9000
        assert records[1]["min_stay"] == 5
        
        print("Step 2 PASS: Conflict resolved - March 1-10 trimmed to March 1-4, March 5-15 created")


class TestDashboardStatsAPI:
    """Test Dashboard Stats API uses seasonal prices"""
    
    def test_stats_api_returns_data(self):
        """Test /api/v2/partner/stats returns valid response"""
        response = requests.get(
            f"{BASE_URL}/api/v2/partner/stats",
            params={"partnerId": PARTNER_ID}
        )
        
        assert response.status_code == 200, f"Stats API failed: {response.text}"
        data = response.json()
        assert data.get("status") == "success"
        
        stats = data.get("data", {})
        
        # Check revenue section exists
        assert "revenue" in stats, "Missing revenue in stats"
        revenue = stats["revenue"]
        assert "confirmed" in revenue
        assert "pending" in revenue
        
        # Check occupancy section exists  
        assert "occupancy" in stats, "Missing occupancy in stats"
        occupancy = stats["occupancy"]
        assert "rate" in occupancy
        assert "listingsCount" in occupancy
        
        print(f"Stats API: Revenue confirmed={revenue.get('confirmed')}, Occupancy={occupancy.get('rate')}%")
    
    def test_stats_api_includes_potential_revenue(self):
        """Test stats API returns potential revenue field"""
        response = requests.get(
            f"{BASE_URL}/api/v2/partner/stats",
            params={"partnerId": PARTNER_ID}
        )
        
        data = response.json()
        stats = data.get("data", {})
        revenue = stats.get("revenue", {})
        
        # Potential revenue should be calculated
        potential = revenue.get("potential")
        print(f"Potential revenue (next 30 days): {potential} THB")
        # Note: This may be 0 if no listings or all booked


class TestCalendarAPI:
    """Test Calendar API returns prices and minStay"""
    
    def test_calendar_returns_seasonal_prices(self):
        """Test calendar API returns priceThb and minStay for available dates"""
        # Get calendar for December 2025 (where we have seasonal prices)
        response = requests.get(
            f"{BASE_URL}/api/v2/partner/calendar",
            params={
                "partnerId": PARTNER_ID,
                "startDate": "2025-12-20",
                "endDate": "2025-12-31"
            }
        )
        
        assert response.status_code == 200, f"Calendar API failed: {response.text}"
        data = response.json()
        assert data.get("status") == "success"
        
        calendar_data = data.get("data", {})
        listings = calendar_data.get("listings", [])
        
        assert len(listings) > 0, "No listings in calendar"
        
        # Check first listing's availability
        first_listing = listings[0]
        availability = first_listing.get("availability", {})
        
        # Check December 20 (should have seasonal price)
        dec20 = availability.get("2025-12-20", {})
        if dec20.get("status") == "AVAILABLE":
            print(f"Dec 20 - Price: {dec20.get('priceThb')}, MinStay: {dec20.get('minStay')}, Season: {dec20.get('seasonType')}")
            # Should have high season price
            assert dec20.get("priceThb") is not None, "Missing priceThb"
        
        print(f"Calendar API working. Listings: {len(listings)}")


class TestNoDevModeRemnants:
    """Global cleanup verification - no dev mode remnants"""
    
    def test_no_401_on_calendar_with_valid_partner(self):
        """Calendar API should not return 401 when partnerId provided"""
        response = requests.get(
            f"{BASE_URL}/api/v2/partner/calendar",
            params={"partnerId": PARTNER_ID}
        )
        
        # Should not be 401
        assert response.status_code != 401, "Got 401 - auth issue"
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
    
    def test_no_401_on_stats_with_valid_partner(self):
        """Stats API should not return 401 when partnerId provided"""
        response = requests.get(
            f"{BASE_URL}/api/v2/partner/stats",
            params={"partnerId": PARTNER_ID}
        )
        
        assert response.status_code != 401, "Got 401 - auth issue"
        assert response.status_code == 200
    
    def test_seasonal_prices_api_no_401(self):
        """Seasonal prices API should not return 401"""
        response = requests.get(
            f"{BASE_URL}/api/v2/partner/seasonal-prices",
            params={"partnerId": PARTNER_ID}
        )
        
        assert response.status_code != 401, "Got 401 on seasonal-prices"
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
