"""
Test Seasonal Pricing API with Conflict Resolution Logic
Phase 4.1 Testing - Gostaylo

Tests cover:
1. Conflict resolution (date splitting/trimming)
2. Min stay handling
3. Database verification after operations
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

# Supabase direct access for verification
SUPABASE_URL = "https://vtzzcdsjwudkaloxhvnw.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k"

# Partner credentials for authenticated API calls
PARTNER_ID = "user-mmhsxted-zon"
LISTING_ID = "lst-mmk1uqyg-8uwm3"

# Local API base URL (for testing via frontend)
LOCAL_API_BASE = "http://localhost:3000"


class TestSeasonalPricingConflicts:
    """Test seasonal pricing conflict resolution logic"""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup - clean up test data before each test"""
        self.supabase_headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Content-Type': 'application/json'
        }
        # Clean up test seasonal prices (those created in Jan 2026)
        self._cleanup_test_data()
        yield
        # Cleanup after test
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Remove test data from Jan 2026"""
        try:
            # Delete test seasonal prices for Jan 2026
            delete_url = f"{SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.{LISTING_ID}&start_date=gte.2026-01-01&start_date=lte.2026-01-31"
            requests.delete(delete_url, headers=self.supabase_headers)
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    def _get_seasonal_prices(self, start_date="2026-01-01", end_date="2026-01-31"):
        """Get all seasonal prices for listing in date range"""
        url = f"{SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.{LISTING_ID}&start_date=gte.{start_date}&end_date=lte.{end_date}&order=start_date.asc&select=*"
        response = requests.get(url, headers=self.supabase_headers)
        return response.json() if response.status_code == 200 else []
    
    def _create_seasonal_price(self, start_date, end_date, price_daily, season_type="PEAK", min_stay=1, label=None):
        """Create seasonal price via API"""
        url = f"{LOCAL_API_BASE}/api/v2/partner/seasonal-prices?partnerId={PARTNER_ID}"
        payload = {
            "listingId": LISTING_ID,
            "startDate": start_date,
            "endDate": end_date,
            "priceDaily": price_daily,
            "seasonType": season_type,
            "minStay": min_stay,
            "label": label
        }
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        return response
    
    # ===== TEST 1: Basic Conflict Resolution =====
    def test_basic_conflict_resolution_partial_overlap_left(self):
        """
        TEST 1: Partial overlap on left - new range starts within existing
        
        Existing: Jan 1-10 (฿6000)
        New:      Jan 5-15 (฿8000)
        
        Expected Result:
        - Record 1: Jan 1-4 (฿6000) - trimmed
        - Record 2: Jan 5-15 (฿8000) - new
        """
        # Step 1: Create initial range
        response1 = self._create_seasonal_price(
            start_date="2026-01-01",
            end_date="2026-01-10",
            price_daily=6000,
            season_type="PEAK",
            min_stay=3,
            label="Test Initial"
        )
        assert response1.status_code == 200, f"Failed to create initial price: {response1.text}"
        print(f"Step 1: Created Jan 1-10 at ฿6000, min_stay=3")
        
        # Verify initial creation
        prices_before = self._get_seasonal_prices()
        assert len(prices_before) == 1, f"Expected 1 record, got {len(prices_before)}"
        assert prices_before[0]["start_date"] == "2026-01-01"
        assert prices_before[0]["end_date"] == "2026-01-10"
        assert prices_before[0]["price_daily"] == 6000
        assert prices_before[0]["min_stay"] == 3
        print(f"Verified: {len(prices_before)} record(s) in DB before overlap")
        
        # Step 2: Create overlapping range
        response2 = self._create_seasonal_price(
            start_date="2026-01-05",
            end_date="2026-01-15",
            price_daily=8000,
            season_type="HIGH",
            min_stay=5,
            label="Test Overlap"
        )
        assert response2.status_code == 200, f"Failed to create overlapping price: {response2.text}"
        
        # Check if conflicts were resolved
        data = response2.json()
        print(f"Conflict resolution response: {data.get('meta', {})}")
        
        # Step 3: Verify DB state
        prices_after = self._get_seasonal_prices()
        print(f"DB records after overlap: {prices_after}")
        
        # Should have 2 records: trimmed original + new
        assert len(prices_after) == 2, f"Expected 2 records after conflict resolution, got {len(prices_after)}"
        
        # Record 1: Trimmed to Jan 1-4
        record1 = next((p for p in prices_after if p["start_date"] == "2026-01-01"), None)
        assert record1 is not None, "Trimmed record (Jan 1-4) not found"
        assert record1["end_date"] == "2026-01-04", f"Expected end_date 2026-01-04, got {record1['end_date']}"
        assert record1["price_daily"] == 6000
        assert record1["min_stay"] == 3
        print(f"✓ Record 1: Jan 1-4 at ฿6000, min_stay=3 (trimmed)")
        
        # Record 2: New range Jan 5-15
        record2 = next((p for p in prices_after if p["start_date"] == "2026-01-05"), None)
        assert record2 is not None, "New record (Jan 5-15) not found"
        assert record2["end_date"] == "2026-01-15"
        assert record2["price_daily"] == 8000
        assert record2["min_stay"] == 5
        print(f"✓ Record 2: Jan 5-15 at ฿8000, min_stay=5 (new)")
        
    # ===== TEST 2: Full Overlap (Delete existing) =====
    def test_full_overlap_delete_existing(self):
        """
        TEST 2: New range fully contains existing - should delete existing
        
        Existing: Jan 5-10 (฿5000)
        New:      Jan 1-15 (฿7000)
        
        Expected: Only 1 record (Jan 1-15 at ฿7000)
        """
        # Create smaller existing range
        response1 = self._create_seasonal_price(
            start_date="2026-01-05",
            end_date="2026-01-10",
            price_daily=5000,
            season_type="LOW",
            min_stay=2
        )
        assert response1.status_code == 200
        
        # Create larger range that fully covers existing
        response2 = self._create_seasonal_price(
            start_date="2026-01-01",
            end_date="2026-01-15",
            price_daily=7000,
            season_type="HIGH",
            min_stay=4
        )
        assert response2.status_code == 200
        
        # Verify - should only have 1 record
        prices = self._get_seasonal_prices()
        assert len(prices) == 1, f"Expected 1 record after full overlap, got {len(prices)}"
        assert prices[0]["start_date"] == "2026-01-01"
        assert prices[0]["end_date"] == "2026-01-15"
        assert prices[0]["price_daily"] == 7000
        assert prices[0]["min_stay"] == 4
        print(f"✓ Full overlap resolved: Only Jan 1-15 at ฿7000 remains")
    
    # ===== TEST 3: Additional Conflict Test =====
    def test_conflict_partial_overlap_right(self):
        """
        TEST 3: Partial overlap on right - new range ends within existing
        
        Existing: Jan 20-30 (฿5000)
        New:      Jan 15-25 (฿7000)
        
        Expected:
        - Record 1: Jan 15-25 (฿7000) - new
        - Record 2: Jan 26-30 (฿5000) - trimmed
        """
        # Create existing range
        response1 = self._create_seasonal_price(
            start_date="2026-01-20",
            end_date="2026-01-30",
            price_daily=5000,
            season_type="BASE",
            min_stay=2
        )
        assert response1.status_code == 200
        
        # Create overlapping range from left
        response2 = self._create_seasonal_price(
            start_date="2026-01-15",
            end_date="2026-01-25",
            price_daily=7000,
            season_type="HIGH",
            min_stay=4
        )
        assert response2.status_code == 200
        
        # Verify
        prices = self._get_seasonal_prices(start_date="2026-01-15", end_date="2026-01-31")
        print(f"Records after right overlap: {prices}")
        
        assert len(prices) == 2, f"Expected 2 records, got {len(prices)}"
        
        # New range
        new_record = next((p for p in prices if p["price_daily"] == 7000), None)
        assert new_record is not None
        assert new_record["start_date"] == "2026-01-15"
        assert new_record["end_date"] == "2026-01-25"
        print(f"✓ New record: Jan 15-25 at ฿7000")
        
        # Trimmed range
        trimmed_record = next((p for p in prices if p["price_daily"] == 5000), None)
        assert trimmed_record is not None
        assert trimmed_record["start_date"] == "2026-01-26"
        assert trimmed_record["end_date"] == "2026-01-30"
        print(f"✓ Trimmed record: Jan 26-30 at ฿5000")
    
    # ===== TEST 4: Min Stay Verification =====
    def test_min_stay_values(self):
        """
        TEST 4: Verify min_stay values are stored and returned correctly
        """
        test_cases = [
            {"min_stay": 1, "start": "2026-01-01", "end": "2026-01-05"},
            {"min_stay": 3, "start": "2026-01-06", "end": "2026-01-10"},
            {"min_stay": 7, "start": "2026-01-11", "end": "2026-01-15"},
            {"min_stay": 14, "start": "2026-01-16", "end": "2026-01-20"},
        ]
        
        for tc in test_cases:
            response = self._create_seasonal_price(
                start_date=tc["start"],
                end_date=tc["end"],
                price_daily=5000,
                season_type="BASE",
                min_stay=tc["min_stay"]
            )
            assert response.status_code == 200, f"Failed to create price with min_stay={tc['min_stay']}"
        
        # Verify all created
        prices = self._get_seasonal_prices(start_date="2026-01-01", end_date="2026-01-20")
        assert len(prices) == 4, f"Expected 4 records, got {len(prices)}"
        
        for tc in test_cases:
            record = next((p for p in prices if p["start_date"] == tc["start"]), None)
            assert record is not None, f"Record not found for {tc['start']}"
            assert record["min_stay"] == tc["min_stay"], f"min_stay mismatch for {tc['start']}: expected {tc['min_stay']}, got {record['min_stay']}"
            print(f"✓ min_stay={tc['min_stay']} correctly stored for {tc['start']}")


class TestCalendarAPISeasonalPrices:
    """Test that Calendar API returns seasonal prices with minStay"""
    
    def test_calendar_api_returns_seasonal_data(self):
        """
        Verify Calendar API includes seasonal pricing in availability response
        """
        url = f"{LOCAL_API_BASE}/api/v2/partner/calendar?partnerId={PARTNER_ID}&startDate=2025-12-15&endDate=2025-12-31"
        response = requests.get(url, headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200, f"Calendar API failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Unexpected status: {data}"
        
        calendar_data = data.get("data", {})
        listings = calendar_data.get("listings", [])
        
        # Find our test listing
        test_listing = next((l for l in listings if l["listing"]["id"] == LISTING_ID), None)
        assert test_listing is not None, "Test listing not found in calendar"
        
        availability = test_listing.get("availability", {})
        
        # Check Dec 20-27 (Christmas week with seasonal price)
        dec_20 = availability.get("2025-12-20", {})
        if dec_20.get("status") == "AVAILABLE":
            assert dec_20.get("priceThb") == 8000, f"Expected ฿8000 for Dec 20, got {dec_20.get('priceThb')}"
            assert dec_20.get("minStay") == 7, f"Expected minStay=7 for Dec 20, got {dec_20.get('minStay')}"
            print(f"✓ Dec 20 returns priceThb=8000, minStay=7")
        else:
            print(f"Dec 20 is not available (status={dec_20.get('status')})")
            
        # Check date outside seasonal range
        dec_15 = availability.get("2025-12-15", {})
        if dec_15.get("status") == "AVAILABLE":
            # Should use base price
            base_price = test_listing["listing"]["basePriceThb"]
            print(f"Dec 15 price: {dec_15.get('priceThb')}, base: {base_price}")


class TestAPIAuthentication:
    """Test API authentication and authorization"""
    
    def test_seasonal_prices_requires_partner_id(self):
        """POST without partnerId should fail"""
        url = f"{LOCAL_API_BASE}/api/v2/partner/seasonal-prices"
        payload = {
            "listingId": LISTING_ID,
            "startDate": "2026-02-01",
            "endDate": "2026-02-10",
            "priceDaily": 5000
        }
        response = requests.post(url, json=payload)
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_seasonal_prices_get_requires_partner_id(self):
        """GET without partnerId should fail"""
        url = f"{LOCAL_API_BASE}/api/v2/partner/seasonal-prices"
        response = requests.get(url)
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
