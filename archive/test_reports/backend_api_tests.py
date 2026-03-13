"""
FunnyRent Stage 31 - Backend API Tests
Tests for Invoice API, Escrow Service, and PWA Icons
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://gostaylo-502-fix.preview.emergentagent.com')


class TestPWAIcons:
    """Test PWA icon accessibility"""
    
    def test_icon_192x192_accessible(self):
        """Test 192x192 PWA icon is accessible"""
        response = requests.get(f"{BASE_URL}/icons/icon-192x192.png", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get('content-type', '').startswith('image/'), "Expected image content type"
        assert len(response.content) > 1000, "Image content too small"
        print(f"PASS: icon-192x192.png accessible, size: {len(response.content)} bytes")
    
    def test_icon_512x512_accessible(self):
        """Test 512x512 PWA icon is accessible"""
        response = requests.get(f"{BASE_URL}/icons/icon-512x512.png", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get('content-type', '').startswith('image/'), "Expected image content type"
        assert len(response.content) > 1000, "Image content too small"
        print(f"PASS: icon-512x512.png accessible, size: {len(response.content)} bytes")


class TestInvoiceAPI:
    """Test Chat Invoice API /api/v2/chat/invoice"""
    
    def test_invoice_validation_missing_fields(self):
        """Test invoice API returns 400 for missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/v2/chat/invoice",
            json={},
            timeout=30
        )
        # Should return 400 for missing required fields
        assert response.status_code == 400, f"Expected 400 for empty body, got {response.status_code}"
        data = response.json()
        assert 'error' in data or not data.get('success', True)
        print("PASS: Invoice API validates required fields")
    
    def test_invoice_validation_missing_amount(self):
        """Test invoice API returns 400 for missing amount"""
        response = requests.post(
            f"{BASE_URL}/api/v2/chat/invoice",
            json={"conversationId": "test", "senderId": "test"},
            timeout=30
        )
        assert response.status_code == 400
        print("PASS: Invoice API requires amount field")
    
    def test_invoice_validation_missing_sender(self):
        """Test invoice API returns 400 for missing senderId"""
        response = requests.post(
            f"{BASE_URL}/api/v2/chat/invoice",
            json={"conversationId": "test", "amount": 1000},
            timeout=30
        )
        assert response.status_code == 400
        print("PASS: Invoice API requires senderId field")
    
    def test_invoice_get_requires_params(self):
        """Test GET invoice requires invoiceId or conversationId"""
        response = requests.get(
            f"{BASE_URL}/api/v2/chat/invoice",
            timeout=30
        )
        assert response.status_code == 400
        data = response.json()
        assert 'error' in data or not data.get('success', True)
        print("PASS: GET invoice requires parameters")


class TestHomepage:
    """Test homepage and basic routes"""
    
    def test_homepage_loads(self):
        """Test homepage returns 200"""
        response = requests.get(BASE_URL, timeout=30)
        assert response.status_code == 200
        assert 'FunnyRent' in response.text or 'Luxury Rentals' in response.text
        print("PASS: Homepage loads successfully")
    
    def test_partner_portal_route(self):
        """Test partner portal route exists"""
        response = requests.get(f"{BASE_URL}/partner", timeout=30)
        assert response.status_code == 200
        print("PASS: Partner portal route accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
