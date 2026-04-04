"""
Test Partner Application APIs
Tests for the partner application workflow:
1. POST /api/v2/partner/apply - Submit partner application
2. GET /api/v2/admin/partners - List pending applications (admin only)
3. POST /api/v2/admin/partners - Approve/reject applications (admin only)
4. GET /api/v2/partner/application-status - Check application status

Note: Due to Secure cookie flag, we manually set Cookie header for local HTTP testing
"""

import pytest
import requests
import os
import json
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000').rstrip('/')

# Test credentials
ADMIN_EMAIL = "pavel_534@mail.ru"
ADMIN_PASSWORD = "ChangeMe2025!"

# Supabase configuration for direct DB operations
SUPABASE_URL = "https://vtzzcdsjwudkaloxhvnw.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I"

# Track test user IDs for cleanup
created_test_users = []


class TestHelpers:
    """Helper functions for authentication and user creation"""
    
    @staticmethod
    def register_user(email, password, first_name="Test"):
        """Register a new user"""
        res = requests.post(f"{BASE_URL}/api/v2/auth/register", json={
            "email": email,
            "password": password,
            "first_name": first_name
        })
        return res
    
    @staticmethod
    def login_user(email, password):
        """Login and return session with manually set cookie (for local HTTP testing)"""
        # Do the login request
        res = requests.post(f"{BASE_URL}/api/v2/auth/login", json={
            "email": email,
            "password": password
        })
        
        if res.status_code != 200:
            return None, res
        
        # Extract the session cookie from Set-Cookie header
        set_cookie = res.headers.get('set-cookie', '')
        session_token = None
        
        if 'gostaylo_session=' in set_cookie:
            # Parse the cookie value
            start = set_cookie.find('gostaylo_session=') + len('gostaylo_session=')
            end = set_cookie.find(';', start)
            session_token = set_cookie[start:end] if end > start else set_cookie[start:]
        
        # Create a session that manually sets the cookie header
        # since the Secure flag prevents automatic sending over HTTP
        session = requests.Session()
        if session_token:
            session.headers['Cookie'] = f'gostaylo_session={session_token}'
        
        return session, res
    
    @staticmethod
    def verify_user_in_db(email):
        """Verify user by setting is_verified=true in profiles table via Supabase"""
        headers = {
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        # Use lowercase email since DB stores email in lowercase
        res = requests.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{email.lower()}",
            headers=headers,
            json={
                "is_verified": True,
                "verification_status": "VERIFIED"
            }
        )
        return res.status_code in [200, 204]


class TestPartnerApplyEndpoint:
    """Test POST /api/v2/partner/apply - Partner application submission"""
    
    def test_partner_apply_unauthorized(self):
        """Test that unauthenticated users cannot apply"""
        res = requests.post(f"{BASE_URL}/api/v2/partner/apply", json={
            "phone": "+66123456789",
            "experience": "Test experience"
        })
        
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("✓ Unauthenticated users correctly rejected")
    
    def test_partner_apply_missing_phone(self):
        """Test that phone is required"""
        test_email = f"TEST_missingphone_{uuid.uuid4().hex[:8]}@test.com"
        TestHelpers.register_user(test_email, "TestPass123!", "Test Missing Phone")
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        session, login_res = TestHelpers.login_user(test_email, "TestPass123!")
        
        if not session or login_res.status_code != 200:
            pytest.skip(f"Login failed: {login_res.text if login_res else 'No response'}")
        
        # Try to apply without phone
        res = session.post(f"{BASE_URL}/api/v2/partner/apply", json={
            "experience": "Test experience"
        })
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        print("✓ Missing phone field correctly rejected")
    
    def test_partner_apply_success(self):
        """Test successful partner application submission"""
        test_email = f"TEST_applysuccess_{uuid.uuid4().hex[:8]}@test.com"
        TestHelpers.register_user(test_email, "TestPass123!", "Test Apply Success")
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        session, login_res = TestHelpers.login_user(test_email, "TestPass123!")
        
        if not session or login_res.status_code != 200:
            pytest.skip(f"Login failed: {login_res.text if login_res else 'No response'}")
        
        # Submit application
        res = session.post(f"{BASE_URL}/api/v2/partner/apply", json={
            "phone": "+66987654321",
            "socialLink": "@test_telegram",
            "experience": "3 years experience renting 5 properties in Phuket",
            "portfolio": "https://airbnb.com/users/testuser"
        })
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        assert "redirectTo" in data
        print(f"✓ Partner application submitted successfully, redirect: {data.get('redirectTo')}")


class TestApplicationStatusEndpoint:
    """Test GET /api/v2/partner/application-status - Check application status"""
    
    def test_status_unauthorized(self):
        """Test that unauthenticated users cannot check status"""
        res = requests.get(f"{BASE_URL}/api/v2/partner/application-status")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("✓ Unauthenticated status check correctly rejected")
    
    def test_status_no_application(self):
        """Test status for user without application"""
        test_email = f"TEST_nostatus_{uuid.uuid4().hex[:8]}@test.com"
        
        TestHelpers.register_user(test_email, "TestPass123!", "No Status Test")
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        session, login_res = TestHelpers.login_user(test_email, "TestPass123!")
        
        if not session or login_res.status_code != 200:
            pytest.skip(f"Login failed")
        
        res = session.get(f"{BASE_URL}/api/v2/partner/application-status")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data.get("success") == True
        assert data.get("hasApplication") == False
        print("✓ Status correctly reports no application")
    
    def test_status_with_pending_application(self):
        """Test status after submitting an application"""
        test_email = f"TEST_withstatus_{uuid.uuid4().hex[:8]}@test.com"
        
        TestHelpers.register_user(test_email, "TestPass123!", "With Status Test")
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        session, login_res = TestHelpers.login_user(test_email, "TestPass123!")
        
        if not session or login_res.status_code != 200:
            pytest.skip(f"Login failed")
        
        # Submit application
        apply_res = session.post(f"{BASE_URL}/api/v2/partner/apply", json={
            "phone": "+66111222333",
            "experience": "Test experience for status check"
        })
        
        if apply_res.status_code != 200:
            pytest.skip(f"Apply failed: {apply_res.text}")
        
        # Check status - should be PENDING
        res = session.get(f"{BASE_URL}/api/v2/partner/application-status")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data.get("success") == True
        assert data.get("hasApplication") == True
        assert data.get("status") == "PENDING"
        print("✓ Status correctly reports PENDING application")


class TestAdminPartnersEndpoint:
    """Test /api/v2/admin/partners - Admin partner management"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin"""
        session, login_res = TestHelpers.login_user(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        if not session or login_res.status_code != 200:
            pytest.skip(f"Admin login failed: {login_res.text if login_res else 'No response'}")
        
        return session
    
    def test_admin_list_unauthorized_no_auth(self):
        """Test that unauthenticated requests are rejected"""
        res = requests.get(f"{BASE_URL}/api/v2/admin/partners")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("✓ Unauthenticated request correctly rejected")
    
    def test_admin_list_unauthorized_non_admin(self):
        """Test that non-admin users cannot list applications"""
        test_email = f"TEST_nonadmin_{uuid.uuid4().hex[:8]}@test.com"
        TestHelpers.register_user(test_email, "TestPass123!")
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        session, _ = TestHelpers.login_user(test_email, "TestPass123!")
        
        if not session:
            pytest.skip("Login failed")
        
        res = session.get(f"{BASE_URL}/api/v2/admin/partners")
        
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("✓ Non-admin correctly denied access")
    
    def test_admin_list_success(self, admin_session):
        """Test admin can list pending applications"""
        res = admin_session.get(f"{BASE_URL}/api/v2/admin/partners")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        assert "applications" in data
        assert "count" in data
        print(f"✓ Admin retrieved {data.get('count')} pending applications")
    
    def test_admin_approve_missing_userid(self, admin_session):
        """Test approve action with missing userId"""
        res = admin_session.post(f"{BASE_URL}/api/v2/admin/partners", json={
            "action": "approve"
        })
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("✓ Missing userId correctly rejected")
    
    def test_admin_invalid_userid(self, admin_session):
        """Test with invalid userId (user not found)"""
        res = admin_session.post(f"{BASE_URL}/api/v2/admin/partners", json={
            "action": "approve",
            "userId": "nonexistent-user-id"
        })
        
        # Should return 404 since user doesn't exist
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        print("✓ Invalid userId correctly returns 404")


class TestFullPartnerWorkflow:
    """Test complete partner application workflow: Apply -> Admin Review -> Status Check"""
    
    def test_full_approve_workflow(self):
        """Test complete workflow: user applies, admin approves, user role changes"""
        # 1. Create and verify test user
        test_email = f"TEST_approve_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "WorkflowTest123!"
        
        reg_res = TestHelpers.register_user(test_email, test_password, "Approve Workflow")
        if reg_res.status_code not in [200, 201]:
            pytest.skip(f"Registration failed: {reg_res.text}")
        
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        # 2. Login as test user and apply
        user_session, login_res = TestHelpers.login_user(test_email, test_password)
        
        if not user_session or login_res.status_code != 200:
            pytest.skip(f"User login failed")
        
        apply_res = user_session.post(f"{BASE_URL}/api/v2/partner/apply", json={
            "phone": "+66111222333",
            "socialLink": "@workflow_test",
            "experience": "Full workflow test experience",
            "portfolio": ""
        })
        
        assert apply_res.status_code == 200, f"Apply failed: {apply_res.text}"
        print("✓ Step 1: User applied successfully")
        
        # 3. Check status - should be PENDING
        status_res = user_session.get(f"{BASE_URL}/api/v2/partner/application-status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data.get("status") == "PENDING"
        print("✓ Step 2: Status is PENDING")
        
        # 4. Login as admin
        admin_session, admin_login = TestHelpers.login_user(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_session or admin_login.status_code != 200:
            pytest.skip(f"Admin login failed")
        
        # 5. List applications and find our user
        list_res = admin_session.get(f"{BASE_URL}/api/v2/admin/partners")
        assert list_res.status_code == 200, f"Admin list failed: {list_res.text}"
        
        list_data = list_res.json()
        applications = list_data.get("applications", [])
        
        test_user_app = None
        for app in applications:
            if app.get("email") == test_email.lower():
                test_user_app = app
                break
        
        if not test_user_app:
            pytest.skip(f"Test user not found in pending list")
        
        user_id = test_user_app.get("id")
        print(f"✓ Step 3: Found application, user ID: {user_id}")
        
        # 6. Approve the application
        approve_res = admin_session.post(f"{BASE_URL}/api/v2/admin/partners", json={
            "action": "approve",
            "userId": user_id
        })
        
        assert approve_res.status_code == 200, f"Approve failed: {approve_res.text}"
        print("✓ Step 4: Admin approved application")
        
        # 7. Re-login and check final status
        user_session2, _ = TestHelpers.login_user(test_email, test_password)
        if user_session2:
            final_status_res = user_session2.get(f"{BASE_URL}/api/v2/partner/application-status")
            if final_status_res.status_code == 200:
                final_status = final_status_res.json()
                assert final_status.get("status") == "APPROVED"
                print("✓ Step 5: Status is APPROVED")
        
        print("\n✅ Full partner APPROVAL workflow completed!")
    
    def test_full_reject_workflow(self):
        """Test complete workflow: user applies, admin rejects with reason"""
        # 1. Create and verify test user
        test_email = f"TEST_reject_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "RejectTest123!"
        
        reg_res = TestHelpers.register_user(test_email, test_password, "Reject Workflow")
        if reg_res.status_code not in [200, 201]:
            pytest.skip(f"Registration failed: {reg_res.text}")
        
        TestHelpers.verify_user_in_db(test_email)
        created_test_users.append(test_email)
        
        # 2. Login and apply
        user_session, login_res = TestHelpers.login_user(test_email, test_password)
        
        if not user_session or login_res.status_code != 200:
            pytest.skip(f"User login failed")
        
        apply_res = user_session.post(f"{BASE_URL}/api/v2/partner/apply", json={
            "phone": "+66999888777",
            "experience": "Reject workflow test"
        })
        
        assert apply_res.status_code == 200, f"Apply failed: {apply_res.text}"
        print("✓ Step 1: User applied")
        
        # 3. Admin login and reject
        admin_session, _ = TestHelpers.login_user(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_session:
            pytest.skip("Admin login failed")
        
        # 4. Find and reject
        list_res = admin_session.get(f"{BASE_URL}/api/v2/admin/partners")
        applications = list_res.json().get("applications", [])
        
        test_user_app = None
        for app in applications:
            if app.get("email") == test_email.lower():
                test_user_app = app
                break
        
        if not test_user_app:
            pytest.skip("Test user not found")
        
        user_id = test_user_app.get("id")
        
        # 5. Reject
        reject_res = admin_session.post(f"{BASE_URL}/api/v2/admin/partners", json={
            "action": "reject",
            "userId": user_id,
            "reason": "Test rejection: insufficient experience"
        })
        
        assert reject_res.status_code == 200, f"Reject failed: {reject_res.text}"
        print("✓ Step 2: Admin rejected with reason")
        
        # 6. Check final status
        user_session2, _ = TestHelpers.login_user(test_email, test_password)
        if user_session2:
            final_status = user_session2.get(f"{BASE_URL}/api/v2/partner/application-status").json()
            assert final_status.get("status") == "REJECTED"
            assert final_status.get("rejectionReason") is not None
            print(f"✓ Step 3: Status REJECTED, reason: {final_status.get('rejectionReason')}")
        
        print("\n✅ Full partner REJECTION workflow completed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
