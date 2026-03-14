/**
 * Gostaylo - Renter Favorites (Wishlist) Page
 * 
 * Features:
 * - Grid layout with GostayloListingCard
 * - TanStack Query for real-time data
 * - Empty state with CTA
 * - Remove from favorites action
 * 
 * @version 2.0
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heart, Loader2, Home, Search, Trash2 } from 'lucide-react'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'
import { toast } from 'sonner'

// Fetch favorites
async function fetchFavorites(userId) {
  if (!userId) throw new Error('No user ID')
  
  const res = await fetch(`/api/v2/renter/favorites?userId=${userId}`, {
    cache: 'no-store'
  })
  
  if (!res.ok) throw new Error('Failed to fetch favorites')
  
  const data = await res.json()
  return data.data || []
}

// Remove from favorites
async function removeFavorite(userId, listingId) {
  const res = await fetch('/api/v2/renter/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, listingId })
  })
  
  if (!res.ok) throw new Error('Failed to remove favorite')
  
  return await res.json()
}

// Shimmer skeleton
function FavoriteCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200 animate-pulse">
      <div className="w-full h-64 bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-6 w-3/4 bg-slate-200 rounded" />
        <div className="h-4 w-1/2 bg-slate-200 rounded" />
        <div className="h-8 w-24 bg-slate-200 rounded" />
      </div>
    </div>
  )
}

export default function RenterFavoritesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState(null)
  
  // Get user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserId(user.id)
      } catch (e) {
        console.error('[FAVORITES] Failed to parse user', e)
      }
    }
  }, [])
  
  // Fetch favorites with TanStack Query
  const {
    data: favorites = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => fetchFavorites(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
  
  // Remove favorite mutation
  const removeMutation = useMutation({
    mutationFn: ({ listingId }) => removeFavorite(userId, listingId),
    onMutate: async ({ listingId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['favorites', userId] })
      
      // Snapshot previous value
      const previousFavorites = queryClient.getQueryData(['favorites', userId])
      
      // Optimistically update
      queryClient.setQueryData(['favorites', userId], (old) =>
        old.filter(fav => fav.listing_id !== listingId)
      )
      
      return { previousFavorites }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['favorites', userId], context.previousFavorites)
      toast.error('Failed to remove from favorites')
    },
    onSuccess: () => {
      toast.success('Removed from favorites')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] })
    }
  })
  
  // Handle favorite toggle
  const handleFavoriteToggle = (listingId) => {
    removeMutation.mutate({ listingId })
  }
  
  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 text-center">
          <Heart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Please log in
          </h3>
          <p className="text-slate-600 mb-4">
            Sign in to view your wishlist
          </p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/profile?login=true">Log In</Link>
          </Button>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Heart className="h-8 w-8 text-rose-500 fill-rose-500" />
            My Wishlist
          </h1>
          <p className="text-slate-600 mt-1">
            {isLoading 
              ? 'Loading...' 
              : `${favorites.length} ${favorites.length === 1 ? 'property' : 'properties'} saved`
            }
          </p>
        </div>
        
        <Button asChild variant="outline">
          <Link href="/listings">
            <Search className="h-4 w-4 mr-2" />
            Browse Listings
          </Link>
        </Button>
      </div>
      
      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FavoriteCardSkeleton />
          <FavoriteCardSkeleton />
          <FavoriteCardSkeleton />
        </div>
      ) : isError ? (
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Failed to load favorites
            </h3>
            <p className="text-slate-600 mb-4">{error?.message}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </Card>
      ) : favorites.length === 0 ? (
        <Card className="p-12">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 mb-2">
              Your wishlist is empty
            </h3>
            <p className="text-slate-600 mb-6">
              Start exploring Phuket! Click the heart icon on any listing to save it here.
            </p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700" size="lg">
              <Link href="/listings">
                <Home className="h-5 w-5 mr-2" />
                Explore Properties
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((favorite) => {
            const listing = favorite.listing
            
            if (!listing) {
              return null // Skip if listing was deleted
            }
            
            return (
              <div key={favorite.id} className="relative group">
                <GostayloListingCard
                  listing={listing}
                  currency="THB"
                  language="en"
                  onFavorite={() => handleFavoriteToggle(listing.id)}
                  className="h-full"
                />
                
                {/* Remove button overlay */}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleFavoriteToggle(listing.id)
                  }}
                  className="absolute top-3 right-3 z-10 w-10 h-10 bg-white rounded-full shadow-lg 
                           flex items-center justify-center opacity-0 group-hover:opacity-100 
                           transition-opacity duration-200 hover:bg-red-50"
                  disabled={removeMutation.isPending}
                >
                  {removeMutation.isPending && removeMutation.variables?.listingId === listing.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                  ) : (
                    <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Stats */}
      {favorites.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-teal-600">{favorites.length}</p>
              <p className="text-sm text-slate-600">Total Saved</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-teal-600">
                {new Set(favorites.map(f => f.listing?.district)).size}
              </p>
              <p className="text-sm text-slate-600">Districts</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-teal-600">
                {favorites[0]?.listing?.district || 'Various'}
              </p>
              <p className="text-sm text-slate-600">Most Saved</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
