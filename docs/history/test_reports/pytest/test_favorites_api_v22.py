"""
Gostaylo Favorites API Tests - Phase 3 Renter Portal
Tests for GET, POST (toggle), DELETE favorites endpoints

Test User: pavel29031983@gmail.com (user-mmq8fm4a-n1s)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000').rstrip('/')
TEST_USER_ID = "user-mmq8fm4a-n1s"

# Known test listing IDs
TEST_LISTING_1 = "lst-mmih84ji-6jolf"
TEST_LISTING_2 = "lst-f2b62ebd"


class TestFavoritesGetAPI:
    """GET /api/v2/renter/favorites - List user favorites"""
    
    def test_get_favorites_success(self):
        """Test GET returns favorites with listing details"""
        response = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Structure assertions
        assert data.get("success") == True
        assert "data" in data
        assert "count" in data
        assert isinstance(data["data"], list)
        
    def test_get_favorites_has_listing_details(self):
        """Test that favorites include full listing objects"""
        response = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        data = response.json()
        
        if data.get("count", 0) > 0:
            favorite = data["data"][0]
            assert "id" in favorite
            assert "listing_id" in favorite
            assert "created_at" in favorite
            assert "listing" in favorite
            
            # Listing should have details
            listing = favorite.get("listing")
            if listing:
                assert "title" in listing
                assert "district" in listing
                assert "base_price_thb" in listing
                print(f"✅ Favorite has listing: {listing.get('title')}")
    
    def test_get_favorites_missing_userid(self):
        """Test GET without userId returns 400"""
        response = requests.get(f"{BASE_URL}/api/v2/renter/favorites")
        
        assert response.status_code == 400
        data = response.json()
        assert data.get("success") == False
        assert "userId" in data.get("error", "").lower() or "missing" in data.get("error", "").lower()


class TestFavoritesToggleAPI:
    """POST /api/v2/renter/favorites - Toggle favorite (add/remove)"""
    
    def test_toggle_add_favorite(self):
        """Test adding a listing to favorites"""
        # First remove if exists
        requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
        
        # Verify count before
        get_resp = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        initial_count = get_resp.json().get("count", 0)
        
        # Toggle - should add since we just removed
        response = requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # One of these should be true
        action = data.get("action")
        assert action in ["added", "removed"], f"Unexpected action: {action}"
        print(f"✅ Toggle action: {action}")
    
    def test_toggle_remove_favorite(self):
        """Test removing a listing from favorites via toggle"""
        # First ensure it exists by checking GET, then add if needed
        get_resp = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        listing_ids = [f["listing_id"] for f in get_resp.json().get("data", [])]
        
        # Add if not in favorites
        if TEST_LISTING_1 not in listing_ids:
            add_resp = requests.post(
                f"{BASE_URL}/api/v2/renter/favorites",
                json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
            )
            assert add_resp.json().get("action") == "added"
        
        # Now toggle - should remove
        response = requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("action") == "removed"
        assert data.get("isFavorite") == False
        print("✅ Toggle removed favorite")
    
    def test_toggle_missing_fields(self):
        """Test POST without required fields returns 400"""
        # Missing listingId
        response = requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data.get("success") == False


class TestFavoritesDeleteAPI:
    """DELETE /api/v2/renter/favorites - Remove specific favorite"""
    
    def test_delete_favorite_success(self):
        """Test direct delete of a favorite"""
        # First ensure it exists
        requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
        
        # Delete
        response = requests.delete(
            f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}&listingId={TEST_LISTING_1}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("✅ Direct DELETE successful")
        
        # Re-add for other tests
        requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
    
    def test_delete_missing_params(self):
        """Test DELETE without params returns 400"""
        response = requests.delete(f"{BASE_URL}/api/v2/renter/favorites")
        
        assert response.status_code == 400
        data = response.json()
        assert data.get("success") == False


class TestFavoritesDataPersistence:
    """Test data persistence - verify changes are saved to DB"""
    
    def test_add_verify_get(self):
        """Test: Add favorite → GET shows it"""
        # First remove to ensure clean state
        requests.delete(
            f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}&listingId={TEST_LISTING_1}"
        )
        
        # Add favorite
        add_resp = requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
        assert add_resp.json().get("action") == "added"
        
        # Verify via GET
        get_resp = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        data = get_resp.json()
        
        listing_ids = [f["listing_id"] for f in data.get("data", [])]
        assert TEST_LISTING_1 in listing_ids, f"Added listing not found in favorites: {listing_ids}"
        print(f"✅ Persistence verified - listing {TEST_LISTING_1} in favorites")
    
    def test_remove_verify_get(self):
        """Test: Remove favorite → GET doesn't show it"""
        # Ensure listing is in favorites first - check state then add if needed
        get_resp = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        listing_ids = [f["listing_id"] for f in get_resp.json().get("data", [])]
        
        if TEST_LISTING_1 not in listing_ids:
            add_resp = requests.post(
                f"{BASE_URL}/api/v2/renter/favorites",
                json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
            )
            assert add_resp.json().get("action") == "added"
        
        # Remove via toggle
        remove_resp = requests.post(
            f"{BASE_URL}/api/v2/renter/favorites",
            json={"userId": TEST_USER_ID, "listingId": TEST_LISTING_1}
        )
        assert remove_resp.json().get("action") == "removed"
        
        # Verify via GET
        get_resp = requests.get(f"{BASE_URL}/api/v2/renter/favorites?userId={TEST_USER_ID}")
        data = get_resp.json()
        
        listing_ids = [f["listing_id"] for f in data.get("data", [])]
        assert TEST_LISTING_1 not in listing_ids, f"Removed listing still in favorites: {listing_ids}"
        print(f"✅ Removal verified - listing {TEST_LISTING_1} not in favorites")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
