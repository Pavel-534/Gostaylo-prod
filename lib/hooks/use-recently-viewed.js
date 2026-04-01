/**
 * GoStayLo - Recently Viewed Listings Hook
 * 
 * Tracks user's recently viewed listings in localStorage
 * Max 10 listings, newest first
 * 
 * @version 1.0
 */

import { useState, useEffect, useCallback } from 'react'

const MAX_RECENT = 10
const STORAGE_KEY = 'gostaylo_recent_viewed'

export function useRecentlyViewed() {
  const [recentListings, setRecentListings] = useState([])
  
  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setRecentListings(parsed)
      }
    } catch (error) {
      console.error('[RECENT VIEWED] Failed to load', error)
    }
  }, [])
  
  // Add listing to recent
  const addToRecent = useCallback((listing) => {
    if (!listing || !listing.id) return
    
    try {
      setRecentListings(prev => {
        // Remove if already exists (to update position)
        const filtered = prev.filter(item => item.id !== listing.id)
        
        // Add to front
        const updated = [
          {
            id: listing.id,
            title: listing.title,
            district: listing.district,
            base_price_thb: listing.base_price_thb || listing.basePriceThb,
            images: listing.images,
            cover_image: listing.cover_image || listing.coverImage,
            property_type: listing.property_type || listing.metadata?.property_type,
            bedrooms: listing.bedrooms || listing.metadata?.bedrooms,
            bathrooms: listing.bathrooms || listing.metadata?.bathrooms,
            viewed_at: new Date().toISOString()
          },
          ...filtered
        ].slice(0, MAX_RECENT) // Keep only MAX_RECENT
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        
        return updated
      })
    } catch (error) {
      console.error('[RECENT VIEWED] Failed to add', error)
    }
  }, [])
  
  // Clear all recent
  const clearRecent = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setRecentListings([])
    } catch (error) {
      console.error('[RECENT VIEWED] Failed to clear', error)
    }
  }, [])
  
  return {
    recentListings,
    addToRecent,
    clearRecent
  }
}
