"""
FunnyRent Stage 32.2 - Cron API and Currency Selector Tests
Tests:
1. Payout cron API with Vercel cron header simulation
2. Checkin-reminder cron API with Vercel cron header simulation
3. Authorization check for cron APIs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000').rstrip('/')
CRON_SECRET = 'funnyrent-cron-2026'


class TestPayoutCronAPI:
    """Payout cron job API tests"""
    
    def test_payout_cron_with_vercel_header(self):
        """Test payout cron accepts x-vercel-cron header"""
        response = requests.post(
            f"{BASE_URL}/api/cron/payouts",
            headers={"x-vercel-cron": "1"}
        )
        # Should succeed with Vercel cron header
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert '24H Rule' in data.get('message', '') or data.get('rule') is not None
        print(f"Payout cron with Vercel header: {data}")
    
    def test_payout_cron_with_secret_header(self):
        """Test payout cron accepts x-cron-secret header"""
        response = requests.post(
            f"{BASE_URL}/api/cron/payouts",
            headers={"x-cron-secret": CRON_SECRET}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        print(f"Payout cron with secret header: {data}")
    
    def test_payout_cron_with_bearer_token(self):
        """Test payout cron accepts Bearer token authorization"""
        response = requests.post(
            f"{BASE_URL}/api/cron/payouts",
            headers={"authorization": f"Bearer {CRON_SECRET}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        print(f"Payout cron with Bearer token: {data}")
    
    def test_payout_cron_unauthorized(self):
        """Test payout cron rejects unauthorized requests"""
        response = requests.post(f"{BASE_URL}/api/cron/payouts")
        assert response.status_code == 401
        data = response.json()
        assert data.get('success') == False
        assert 'Unauthorized' in data.get('error', '')
        print(f"Payout cron unauthorized: {data}")
    
    def test_payout_cron_get_status(self):
        """Test payout cron GET returns 24H rule status"""
        response = requests.get(
            f"{BASE_URL}/api/cron/payouts",
            params={"secret": CRON_SECRET}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'readyForPayout' in data
        assert 'upcomingThaw' in data
        assert '24 hours after check-in' in data.get('rule', '')
        print(f"Payout cron status: {data}")


class TestCheckinReminderCronAPI:
    """Check-in reminder cron job API tests"""
    
    def test_checkin_cron_with_vercel_header(self):
        """Test checkin-reminder cron accepts x-vercel-cron header"""
        response = requests.post(
            f"{BASE_URL}/api/cron/checkin-reminder",
            headers={"x-vercel-cron": "1"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        print(f"Checkin cron with Vercel header: {data}")
    
    def test_checkin_cron_with_secret_header(self):
        """Test checkin-reminder cron accepts x-cron-secret header"""
        response = requests.post(
            f"{BASE_URL}/api/cron/checkin-reminder",
            headers={"x-cron-secret": CRON_SECRET}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        print(f"Checkin cron with secret header: {data}")
    
    def test_checkin_cron_unauthorized(self):
        """Test checkin-reminder cron rejects unauthorized requests"""
        response = requests.post(f"{BASE_URL}/api/cron/checkin-reminder")
        assert response.status_code == 401
        data = response.json()
        assert data.get('success') == False
        assert 'Unauthorized' in data.get('error', '')
        print(f"Checkin cron unauthorized: {data}")
    
    def test_checkin_cron_get_status(self):
        """Test checkin-reminder GET returns today's check-ins status"""
        response = requests.get(
            f"{BASE_URL}/api/cron/checkin-reminder",
            params={"secret": CRON_SECRET}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'todayCheckIns' in data
        assert 'scheduledTime' in data
        print(f"Checkin cron status: {data}")


class TestCronSecurity:
    """Security tests for cron endpoints"""
    
    def test_wrong_secret_rejected(self):
        """Test that wrong secret is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/cron/payouts",
            headers={"x-cron-secret": "wrong-secret"}
        )
        assert response.status_code == 401
        print("Wrong secret rejected correctly")
    
    def test_empty_bearer_rejected(self):
        """Test that empty bearer token is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/cron/payouts",
            headers={"authorization": "Bearer "}
        )
        assert response.status_code == 401
        print("Empty bearer rejected correctly")
