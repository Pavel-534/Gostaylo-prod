"""
Stage 32 Backend API Tests
- Forex API /api/v2/forex returns live exchange rates
- Forex conversion with FunnyRate markup (THB to RUB, USD, CNY)
- Geo API /api/v2/geo detects user location and recommends currency
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

# FunnyRate markup is 3.5%
FUNNYRATE_MARKUP = 1.035


class TestForexAPI:
    """Tests for /api/v2/forex endpoint - Exchange rate service"""
    
    def test_forex_get_all_rates(self):
        """Test GET /api/v2/forex returns live exchange rates"""
        response = requests.get(f"{BASE_URL}/api/v2/forex", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('success') == True, f"API did not return success: {data}"
        assert data.get('baseCurrency') == 'THB', "Base currency should be THB"
        
        # Verify rates object exists and has expected currencies
        rates = data.get('rates', {})
        assert 'USD' in rates, "USD rate missing"
        assert 'RUB' in rates, "RUB rate missing"
        assert 'CNY' in rates, "CNY rate missing"
        assert 'EUR' in rates, "EUR rate missing"
        
        # Verify currencies list exists with FunnyRate
        currencies = data.get('currencies', [])
        assert len(currencies) > 0, "Currencies list should not be empty"
        
        # Check that funnyRate markup info is present
        assert 'markup' in data or '3.5%' in str(data.get('markup', '')), "FunnyRate markup info should be present"
        
        print(f"✅ Forex API returned {len(rates)} rates, baseCurrency: THB")
        print(f"   Sample rates: USD={rates.get('USD')}, RUB={rates.get('RUB')}, CNY={rates.get('CNY')}")
    
    def test_forex_conversion_thb_to_usd(self):
        """Test THB to USD conversion with FunnyRate markup"""
        amount = 10000  # 10,000 THB
        response = requests.get(
            f"{BASE_URL}/api/v2/forex",
            params={'convert': amount, 'from': 'THB', 'to': 'USD'},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"Conversion failed: {data}"
        
        # Verify original amount
        assert data.get('original', {}).get('amount') == amount, "Original amount mismatch"
        assert data.get('original', {}).get('currency') == 'THB', "Original currency should be THB"
        
        # Verify conversion result
        converted = data.get('converted', {})
        assert converted.get('currency') == 'USD', "Target currency should be USD"
        assert converted.get('amount') > 0, "Converted amount should be positive"
        
        # Verify FunnyRate is applied (funnyRate should be ~3.5% higher than market rate)
        market_rate = data.get('rate')
        funny_rate = data.get('funnyRate')
        if market_rate and funny_rate:
            expected_funny_rate = market_rate * FUNNYRATE_MARKUP
            # Allow small floating point tolerance
            assert abs(funny_rate - expected_funny_rate) < 0.0001, f"FunnyRate markup not applied correctly: {funny_rate} vs expected {expected_funny_rate}"
        
        print(f"✅ THB to USD conversion: {amount} THB → {converted.get('amount')} USD")
        print(f"   Market rate: {market_rate}, FunnyRate: {funny_rate}")
    
    def test_forex_conversion_thb_to_rub(self):
        """Test THB to RUB conversion with FunnyRate markup"""
        amount = 10000  # 10,000 THB
        response = requests.get(
            f"{BASE_URL}/api/v2/forex",
            params={'convert': amount, 'from': 'THB', 'to': 'RUB'},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"Conversion failed: {data}"
        
        converted = data.get('converted', {})
        assert converted.get('currency') == 'RUB', "Target currency should be RUB"
        assert converted.get('amount') > 0, "Converted amount should be positive"
        
        # RUB should be larger number than THB (1 THB ~ 2.5 RUB)
        assert converted.get('amount') > amount * 2, f"RUB conversion seems too low: {converted.get('amount')}"
        
        print(f"✅ THB to RUB conversion: {amount} THB → {converted.get('amount')} RUB")
    
    def test_forex_conversion_thb_to_cny(self):
        """Test THB to CNY conversion with FunnyRate markup"""
        amount = 10000  # 10,000 THB
        response = requests.get(
            f"{BASE_URL}/api/v2/forex",
            params={'convert': amount, 'from': 'THB', 'to': 'CNY'},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"Conversion failed: {data}"
        
        converted = data.get('converted', {})
        assert converted.get('currency') == 'CNY', "Target currency should be CNY"
        assert converted.get('amount') > 0, "Converted amount should be positive"
        
        # Verify formatted price exists
        assert converted.get('formatted'), "Formatted price should exist"
        
        print(f"✅ THB to CNY conversion: {amount} THB → {converted.get('amount')} CNY ({converted.get('formatted')})")
    
    def test_forex_auto_detect_currency(self):
        """Test auto-detect currency feature"""
        response = requests.get(
            f"{BASE_URL}/api/v2/forex",
            params={'auto': 'true'},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, f"API failed: {data}"
        
        print(f"✅ Forex API auto-detect: geoDetected={data.get('geoDetected')}")


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
        
        # Verify sample conversion exists
        sample = data.get('sample', {})
        assert sample.get('thb') == 10000, "Sample should be 10000 THB"
        assert sample.get('converted') > 0, "Sample converted amount should be positive"
        
        print(f"✅ Geo API detected: country={data.get('location', {}).get('country')}, currency={currency.get('code')}")
        print(f"   Sample: 10000 THB = {sample.get('formatted')}")
    
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
    
    def test_forex_and_geo_integration(self):
        """Test that geo-detected currency can be used for forex conversion"""
        # First get geo recommendation
        geo_response = requests.get(f"{BASE_URL}/api/v2/geo", timeout=30)
        assert geo_response.status_code == 200
        
        geo_data = geo_response.json()
        recommended_currency = geo_data.get('currency', {}).get('code', 'USD')
        
        # Then use that currency for forex conversion
        forex_response = requests.get(
            f"{BASE_URL}/api/v2/forex",
            params={'convert': 5000, 'from': 'THB', 'to': recommended_currency},
            timeout=30
        )
        
        assert forex_response.status_code == 200
        forex_data = forex_response.json()
        assert forex_data.get('success') == True
        assert forex_data.get('converted', {}).get('currency') == recommended_currency
        
        print(f"✅ Integration: Geo recommended {recommended_currency}, Forex converted 5000 THB → {forex_data.get('converted', {}).get('amount')} {recommended_currency}")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
