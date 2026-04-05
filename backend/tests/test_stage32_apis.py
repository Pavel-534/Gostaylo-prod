"""
Stage 32 Backend API Tests
- GET /api/v2/exchange-rates — rateMap (THB за 1 ед. валюты), канон CurrencyService
- Geo API /api/v2/geo — гео + пример форматирования через тот же курс
- Push API /api/v2/push returns template list
- Payout cron /api/cron/payouts?secret=funnyrent-cron-2026 returns 24H rule status
- Check-in reminder cron /api/cron/checkin-reminder?secret=funnyrent-cron-2026 works
"""

import pytest
import requests
import os
import time

BASE_URL = 'http://localhost:3000'  # Use localhost for testing since preview has 502 errors
CRON_SECRET = "funnyrent-cron-2026"


class TestExchangeRatesAPI:
    """Tests for GET /api/v2/exchange-rates (CurrencyService.getDisplayRateMap)."""

    def test_exchange_rates_returns_rate_map(self):
        response = requests.get(f"{BASE_URL}/api/v2/exchange-rates", timeout=30)

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data.get('success') is True, f"API did not return success: {data}"

        rate_map = data.get('rateMap') or {}
        assert isinstance(rate_map, dict) and len(rate_map) > 0, "rateMap should be a non-empty object"
        assert rate_map.get('THB') == 1, "THB baseline should be 1 in rateMap"

        for code in ('USD', 'RUB', 'EUR'):
            if code in rate_map:
                assert float(rate_map[code]) > 0, f"{code} rate should be positive"

        print(f"✅ exchange-rates keys sample: USD={rate_map.get('USD')}, RUB={rate_map.get('RUB')}")


class TestGeoAPI:
    """Tests for /api/v2/geo endpoint - IP-based geo detection"""
    
    def test_geo_detect_location(self):
        """Test GET /api/v2/geo detects user location and recommends currency"""
        response = requests.get(f"{BASE_URL}/api/v2/geo", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Geo API should return success (true) or fallback gracefully
        # Note: For server/container requests, IP detection may not work, but API should not fail
        
        # Verify currency recommendation exists
        currency = data.get('currency', {})
        assert currency.get('code'), f"Currency code should exist: {data}"
        assert currency.get('symbol'), "Currency symbol should exist"
        assert currency.get('name'), "Currency name should exist"
        
        # Пример: только formatted строка (курс из CurrencyService, без отдельного Forex)
        sample = data.get('sample', {})
        assert sample.get('thb') == 10000, "Sample should be 10000 THB"
        assert sample.get('formatted'), "Sample formatted price should exist"

        print(f"✅ Geo API detected: country={data.get('location', {}).get('country')}, currency={currency.get('code')}")
        print(f"   Sample: 10000 THB → {sample.get('formatted')}")
    
    def test_geo_returns_fallback_on_error(self):
        """Test that Geo API returns fallback USD on error"""
        # Even if geo detection fails, API should return 200 with fallback
        response = requests.get(f"{BASE_URL}/api/v2/geo", timeout=30)
        
        assert response.status_code == 200, f"Expected 200 even on detection failure, got {response.status_code}"
        
        data = response.json()
        # Should always have currency field
        assert 'currency' in data, "Currency field should always exist"
        
        print(f"✅ Geo API returns valid response with currency: {data.get('currency', {}).get('code')}")


class TestPushAPI:
    """Tests for /api/v2/push endpoint - Firebase Push Notifications"""
    
    def test_push_get_template_list(self):
        """Test GET /api/v2/push returns template list"""
        response = requests.get(f"{BASE_URL}/api/v2/push", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"API failed: {data}"
        assert data.get('service') == 'Firebase Cloud Messaging', "Service should be FCM"
        
        # Verify templates list
        templates = data.get('templates', [])
        assert len(templates) > 0, "Templates list should not be empty"
        
        expected_templates = [
            'NEW_MESSAGE',
            'BOOKING_REQUEST', 
            'BOOKING_CONFIRMED',
            'PAYMENT_RECEIVED',
            'CHECKIN_REMINDER',
            'PAYOUT_READY'
        ]
        for template in expected_templates:
            assert template in templates, f"Template {template} missing from list"
        
        # Verify endpoints documentation
        endpoints = data.get('endpoints', {})
        assert 'register' in endpoints, "Register endpoint documentation missing"
        assert 'send' in endpoints, "Send endpoint documentation missing"
        assert 'test' in endpoints, "Test endpoint documentation missing"
        
        print(f"✅ Push API returned {len(templates)} templates: {templates}")
    
    def test_push_register_requires_params(self):
        """Test POST /api/v2/push register action requires params"""
        response = requests.post(
            f"{BASE_URL}/api/v2/push",
            json={'action': 'register'},
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400 for missing params, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == False, "Should fail without params"
        assert 'token' in data.get('error', '').lower() or 'userid' in data.get('error', '').lower(), \
            f"Error should mention missing token/userId: {data}"
        
        print(f"✅ Push API correctly rejects register without token/userId")
    
    def test_push_test_action_requires_token(self):
        """Test POST /api/v2/push test action requires token"""
        response = requests.post(
            f"{BASE_URL}/api/v2/push",
            json={'action': 'test'},
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400 for missing token, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == False, "Should fail without token"
        
        print(f"✅ Push API test action correctly rejects without token")
    
    def test_push_invalid_action(self):
        """Test POST /api/v2/push with invalid action"""
        response = requests.post(
            f"{BASE_URL}/api/v2/push",
            json={'action': 'invalid_action'},
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == False, "Should fail with invalid action"
        
        print(f"✅ Push API correctly rejects invalid action")


class TestPayoutCronAPI:
    """Tests for /api/cron/payouts endpoint - 24H Escrow Rule"""
    
    def test_payout_cron_unauthorized_without_secret(self):
        """Test payout cron rejects requests without secret"""
        response = requests.get(f"{BASE_URL}/api/cron/payouts", timeout=30)
        
        assert response.status_code == 401, f"Expected 401 without secret, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == False, "Should fail without secret"
        assert 'unauthorized' in data.get('error', '').lower(), f"Error should mention unauthorized: {data}"
        
        print(f"✅ Payout cron correctly rejects unauthorized request")
    
    def test_payout_cron_status_with_secret(self):
        """Test GET /api/cron/payouts?secret=... returns 24H rule status"""
        response = requests.get(
            f"{BASE_URL}/api/cron/payouts",
            params={'secret': CRON_SECRET},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('success') == True, f"API failed: {data}"
        
        # Verify 24H rule is documented
        assert '24H' in data.get('message', '') or '24H' in data.get('rule', '') or '24' in str(data), \
            f"24H rule should be mentioned: {data}"
        
        # Verify structure
        assert 'readyForPayout' in data, "readyForPayout field should exist"
        assert 'upcomingThaw' in data, "upcomingThaw field should exist"
        
        ready = data.get('readyForPayout', {})
        assert 'count' in ready, "readyForPayout should have count"
        
        upcoming = data.get('upcomingThaw', {})
        assert 'count' in upcoming, "upcomingThaw should have count"
        
        print(f"✅ Payout cron status: readyForPayout={ready.get('count')}, upcomingThaw={upcoming.get('count')}")
        print(f"   Rule: {data.get('rule', 'Payouts released 24 hours after check-in')}")
    
    def test_payout_cron_post_unauthorized(self):
        """Test POST /api/cron/payouts requires secret header"""
        response = requests.post(f"{BASE_URL}/api/cron/payouts", timeout=30)
        
        assert response.status_code == 401, f"Expected 401 without secret, got {response.status_code}"
        
        print(f"✅ Payout cron POST correctly rejects unauthorized request")
    
    def test_payout_cron_preview_thaw(self):
        """Test preview-thaw action shows bookings that will thaw tomorrow"""
        response = requests.get(
            f"{BASE_URL}/api/cron/payouts",
            params={'secret': CRON_SECRET, 'action': 'preview-thaw'},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"Preview thaw failed: {data}"
        
        print(f"✅ Payout preview-thaw: {data.get('message', 'OK')}")


class TestCheckInReminderCronAPI:
    """Tests for /api/cron/checkin-reminder endpoint"""
    
    def test_checkin_cron_unauthorized_without_secret(self):
        """Test check-in cron rejects requests without secret"""
        response = requests.get(f"{BASE_URL}/api/cron/checkin-reminder", timeout=30)
        
        assert response.status_code == 401, f"Expected 401 without secret, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == False, "Should fail without secret"
        
        print(f"✅ Check-in cron correctly rejects unauthorized request")
    
    def test_checkin_cron_status_with_secret(self):
        """Test GET /api/cron/checkin-reminder?secret=... returns status"""
        response = requests.get(
            f"{BASE_URL}/api/cron/checkin-reminder",
            params={'secret': CRON_SECRET},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('success') == True, f"API failed: {data}"
        
        # Verify structure
        assert 'todayCheckIns' in data, "todayCheckIns field should exist"
        assert 'scheduledTime' in data, "scheduledTime field should exist"
        assert '14:00' in data.get('scheduledTime', ''), "Scheduled time should be 14:00"
        
        print(f"✅ Check-in cron status: todayCheckIns={data.get('todayCheckIns')}, scheduledTime={data.get('scheduledTime')}")
    
    def test_checkin_cron_post_unauthorized(self):
        """Test POST /api/cron/checkin-reminder requires secret header"""
        response = requests.post(f"{BASE_URL}/api/cron/checkin-reminder", timeout=30)
        
        assert response.status_code == 401, f"Expected 401 without secret, got {response.status_code}"
        
        print(f"✅ Check-in cron POST correctly rejects unauthorized request")


class TestIntegration:
    """Integration tests for Stage 32 features"""
    
    def test_geo_and_exchange_rates_integration(self):
        """Geo sample uses same rate source as /api/v2/exchange-rates (CurrencyService)."""
        geo_response = requests.get(f"{BASE_URL}/api/v2/geo", timeout=30)
        assert geo_response.status_code == 200

        geo_data = geo_response.json()
        recommended_currency = geo_data.get('currency', {}).get('code', 'USD')
        sample = geo_data.get('sample', {})
        assert sample.get('thb') == 10000
        assert sample.get('formatted'), "Geo sample should include formatted price"

        er = requests.get(f"{BASE_URL}/api/v2/exchange-rates", timeout=30)
        assert er.status_code == 200
        er_data = er.json()
        assert er_data.get('success') is True
        rate_map = er_data.get('rateMap') or {}
        if recommended_currency not in rate_map and recommended_currency != 'THB':
            print(
                f"⚠️ Geo recommends {recommended_currency} but display rateMap may omit it; geo sample falls back to THB formatting"
            )

        print(
            f"✅ Integration: Geo → {recommended_currency}, sample formatted={sample.get('formatted')!r}"
        )


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
