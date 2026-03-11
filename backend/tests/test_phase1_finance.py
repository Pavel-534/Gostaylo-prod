"""
Phase 1: Finance Core & Admin Empowerment Tests
Tests for:
1. Admin Settings API - Save commission rate
2. Commission API - Get commission rate
3. Personal commission for partners
"""
import pytest
import requests
import os

# Use localhost for API testing (more reliable than preview URL)
BASE_URL = "http://localhost:3000"

# Test credentials
ADMIN_CREDENTIALS = {
    "email": "pavel_534@mail.ru",
    "password": "ChangeMe2025!"
}

PARTNER_CREDENTIALS = {
    "email": "86boa@mail.ru",
    "password": "az123456"
}

class TestAdminSettingsAPI:
    """Tests for Admin Settings API - GET/PUT system settings"""
    
    def test_get_admin_settings(self):
        """Test GET /api/admin/settings returns system settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "data" in data, "Response should contain 'data' field"
        
        settings = data["data"]
        assert "defaultCommissionRate" in settings, "Settings should contain 'defaultCommissionRate'"
        assert isinstance(settings["defaultCommissionRate"], (int, float)), "Commission rate should be numeric"
        
        print(f"✅ GET /api/admin/settings - OK. Commission rate: {settings['defaultCommissionRate']}%")
        return settings

    def test_update_admin_settings_commission(self):
        """Test PUT /api/admin/settings to update commission rate"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings", timeout=30)
        assert get_response.status_code == 200
        current_settings = get_response.json()["data"]
        original_rate = current_settings.get("defaultCommissionRate", 15)
        
        # Update commission to a new value (20%)
        new_rate = 20 if original_rate != 20 else 18
        
        update_payload = {
            "defaultCommissionRate": new_rate,
            "maintenanceMode": current_settings.get("maintenanceMode", False),
            "heroTitle": current_settings.get("heroTitle", "Luxury Rentals in Phuket"),
            "heroSubtitle": current_settings.get("heroSubtitle", "Villas, Bikes, Yachts & Tours")
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/settings",
            json=update_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}: {put_response.text}"
        
        result = put_response.json()
        assert result.get("success") == True, "Response should indicate success"
        
        # Verify the change persisted by GET
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings", timeout=30)
        assert verify_response.status_code == 200
        
        updated_settings = verify_response.json()["data"]
        assert updated_settings["defaultCommissionRate"] == new_rate, \
            f"Commission rate should be {new_rate}%, got {updated_settings['defaultCommissionRate']}%"
        
        print(f"✅ PUT /api/admin/settings - OK. Commission updated from {original_rate}% to {new_rate}%")
        
        # Restore original rate
        restore_payload = {**update_payload, "defaultCommissionRate": original_rate}
        requests.put(f"{BASE_URL}/api/admin/settings", json=restore_payload, timeout=30)
        print(f"   Restored commission rate to {original_rate}%")


class TestCommissionAPI:
    """Tests for Commission Rate API - GET /api/v2/commission"""
    
    def test_get_system_commission(self):
        """Test GET /api/v2/commission returns system commission rate"""
        response = requests.get(f"{BASE_URL}/api/v2/commission", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "data" in data, "Response should contain 'data' field"
        
        commission_data = data["data"]
        assert "systemRate" in commission_data, "Should contain 'systemRate'"
        assert "effectiveRate" in commission_data, "Should contain 'effectiveRate'"
        assert "partnerEarningsPercent" in commission_data, "Should contain 'partnerEarningsPercent'"
        
        system_rate = commission_data["systemRate"]
        effective_rate = commission_data["effectiveRate"]
        partner_earnings = commission_data["partnerEarningsPercent"]
        
        # Validate calculations
        assert partner_earnings == 100 - effective_rate, \
            f"Partner earnings should be {100 - effective_rate}%, got {partner_earnings}%"
        
        print(f"✅ GET /api/v2/commission - OK. System rate: {system_rate}%, Effective: {effective_rate}%, Partner earnings: {partner_earnings}%")
        return commission_data

    def test_commission_matches_settings(self):
        """Test that commission API returns the same rate as admin settings"""
        # Get from admin settings
        settings_response = requests.get(f"{BASE_URL}/api/admin/settings", timeout=30)
        assert settings_response.status_code == 200
        settings_rate = settings_response.json()["data"]["defaultCommissionRate"]
        
        # Get from commission API
        commission_response = requests.get(f"{BASE_URL}/api/v2/commission", timeout=30)
        assert commission_response.status_code == 200
        commission_rate = commission_response.json()["data"]["systemRate"]
        
        assert settings_rate == commission_rate, \
            f"Settings rate ({settings_rate}%) should match Commission API rate ({commission_rate}%)"
        
        print(f"✅ Commission API and Admin Settings are in sync: {commission_rate}%")

    def test_commission_after_settings_update(self):
        """Test that commission API reflects changes after settings update"""
        # Get current settings
        settings_response = requests.get(f"{BASE_URL}/api/admin/settings", timeout=30)
        current_settings = settings_response.json()["data"]
        original_rate = current_settings["defaultCommissionRate"]
        
        # Update to a different rate
        new_rate = 25 if original_rate != 25 else 22
        
        update_payload = {
            "defaultCommissionRate": new_rate,
            "maintenanceMode": current_settings.get("maintenanceMode", False),
            "heroTitle": current_settings.get("heroTitle", ""),
            "heroSubtitle": current_settings.get("heroSubtitle", "")
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/settings",
            json=update_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        assert put_response.status_code == 200
        
        # Verify commission API returns new rate
        commission_response = requests.get(f"{BASE_URL}/api/v2/commission", timeout=30)
        assert commission_response.status_code == 200
        
        updated_rate = commission_response.json()["data"]["systemRate"]
        assert updated_rate == new_rate, \
            f"Commission API should return new rate {new_rate}%, got {updated_rate}%"
        
        print(f"✅ Commission API reflects settings change: {original_rate}% -> {new_rate}%")
        
        # Restore original rate
        restore_payload = {**update_payload, "defaultCommissionRate": original_rate}
        requests.put(f"{BASE_URL}/api/admin/settings", json=restore_payload, timeout=30)
        print(f"   Restored commission rate to {original_rate}%")


class TestPersonalCommission:
    """Tests for personal commission rates for partners"""
    
    @pytest.fixture
    def supabase_config(self):
        """Get Supabase configuration - use service role key for write operations"""
        return {
            "url": "https://vtzzcdsjwudkaloxhvnw.supabase.co",
            "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I"
        }

    def test_get_partner_profile(self, supabase_config):
        """Test fetching partner profile from Supabase"""
        # Find partner user (86boa@mail.ru)
        response = requests.get(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"email": "eq.86boa@mail.ru", "select": "id,email,role,custom_commission_rate"},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}"
            },
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert len(data) > 0, "Partner user should exist"
        
        partner = data[0]
        assert partner["role"] == "PARTNER", f"User should be PARTNER, got {partner['role']}"
        
        print(f"✅ Partner profile found: {partner['email']}, custom_commission_rate: {partner.get('custom_commission_rate')}")
        return partner

    def test_commission_with_partner_id(self, supabase_config):
        """Test GET /api/v2/commission with partnerId parameter"""
        # First get partner ID
        profile_response = requests.get(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"email": "eq.86boa@mail.ru", "select": "id"},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}"
            },
            timeout=30
        )
        
        assert profile_response.status_code == 200
        profiles = profile_response.json()
        assert len(profiles) > 0, "Partner should exist"
        
        partner_id = profiles[0]["id"]
        
        # Get commission with partnerId
        commission_response = requests.get(
            f"{BASE_URL}/api/v2/commission",
            params={"partnerId": partner_id},
            timeout=30
        )
        
        assert commission_response.status_code == 200, f"Expected 200, got {commission_response.status_code}"
        
        data = commission_response.json()["data"]
        assert "systemRate" in data
        assert "personalRate" in data
        assert "effectiveRate" in data
        
        print(f"✅ Commission with partnerId: systemRate={data['systemRate']}%, personalRate={data['personalRate']}, effectiveRate={data['effectiveRate']}%")
        return data

    def test_set_and_verify_personal_commission(self, supabase_config):
        """Test setting personal commission and verifying via API"""
        # Get partner ID
        profile_response = requests.get(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"email": "eq.86boa@mail.ru", "select": "id,custom_commission_rate"},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}"
            },
            timeout=30
        )
        
        profiles = profile_response.json()
        partner_id = profiles[0]["id"]
        original_rate = profiles[0].get("custom_commission_rate")
        
        # Set personal commission to 10%
        test_rate = 10
        
        update_response = requests.patch(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"id": f"eq.{partner_id}"},
            json={"custom_commission_rate": test_rate},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            timeout=30
        )
        
        assert update_response.status_code in [200, 204], f"Expected 200/204, got {update_response.status_code}"
        
        # Verify via commission API
        commission_response = requests.get(
            f"{BASE_URL}/api/v2/commission",
            params={"partnerId": partner_id},
            timeout=30
        )
        
        assert commission_response.status_code == 200
        data = commission_response.json()["data"]
        
        assert data["personalRate"] == test_rate, f"Personal rate should be {test_rate}%, got {data['personalRate']}"
        assert data["effectiveRate"] == test_rate, f"Effective rate should use personal rate {test_rate}%"
        
        print(f"✅ Personal commission set and verified: {test_rate}%")
        print(f"   System rate: {data['systemRate']}%, Personal: {data['personalRate']}%, Effective: {data['effectiveRate']}%")
        
        # Restore original rate
        restore_response = requests.patch(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"id": f"eq.{partner_id}"},
            json={"custom_commission_rate": original_rate},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            timeout=30
        )
        
        print(f"   Restored original rate: {original_rate}")


class TestUserDetailAPI:
    """Tests for user detail page data availability"""
    
    @pytest.fixture
    def supabase_config(self):
        return {
            "url": "https://vtzzcdsjwudkaloxhvnw.supabase.co",
            "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k"
        }

    def test_user_profiles_accessible(self, supabase_config):
        """Test that user profiles are accessible via Supabase"""
        response = requests.get(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"select": "id,email,role,first_name,last_name", "limit": "10"},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}"
            },
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        profiles = response.json()
        assert len(profiles) > 0, "Should have at least one profile"
        
        print(f"✅ Profiles API accessible. Found {len(profiles)} users")
        return profiles

    def test_partner_applications_kyc_accessible(self, supabase_config):
        """Test that KYC documents (partner_applications) are accessible"""
        # First get a partner ID
        profile_response = requests.get(
            f"{supabase_config['url']}/rest/v1/profiles",
            params={"role": "eq.PARTNER", "select": "id", "limit": "1"},
            headers={
                "apikey": supabase_config["key"],
                "Authorization": f"Bearer {supabase_config['key']}"
            },
            timeout=30
        )
        
        if profile_response.status_code == 200 and len(profile_response.json()) > 0:
            partner_id = profile_response.json()[0]["id"]
            
            # Try to get KYC docs
            kyc_response = requests.get(
                f"{supabase_config['url']}/rest/v1/partner_applications",
                params={"user_id": f"eq.{partner_id}", "select": "*"},
                headers={
                    "apikey": supabase_config["key"],
                    "Authorization": f"Bearer {supabase_config['key']}"
                },
                timeout=30
            )
            
            assert kyc_response.status_code == 200, f"Expected 200, got {kyc_response.status_code}"
            
            docs = kyc_response.json()
            print(f"✅ KYC API accessible. Found {len(docs)} documents for partner")
        else:
            print("⚠️ No partner found to test KYC documents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
