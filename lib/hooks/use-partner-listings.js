/**
 * usePartnerListings - TanStack Query hook for partner listings
 * 
 * Features:
 * - Auto-refetch on window focus
 * - Cache invalidation on mutations
 * - Loading and error states
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Query key factory
export const partnerListingsKeys = {
  all: ['partner-listings'],
  list: (partnerId) => [...partnerListingsKeys.all, 'list', partnerId],
  detail: (id) => [...partnerListingsKeys.all, 'detail', id],
}

/**
 * Fetch partner listings from API v2
 */
async function fetchPartnerListings(partnerId) {
  const res = await fetch(`/api/v2/partner/listings?partnerId=${partnerId}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch listings')
  }
  
  return res.json()
}

/**
 * Hook to fetch partner listings
 */
export function usePartnerListings(partnerId, options = {}) {
  const { enabled = true } = options
  
  return useQuery({
    queryKey: partnerListingsKeys.list(partnerId),
    queryFn: () => fetchPartnerListings(partnerId),
    enabled: !!partnerId && enabled,
    select: (response) => ({
      listings: response.data || [],
      total: response.count || 0
    })
  })
}

/**
 * Hook to delete a listing
 */
export function useDeleteListing() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ listingId, partnerId }) => {
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete listing')
      }
      
      return res.json()
    },
    
    onSuccess: (_, { partnerId }) => {
      toast.success('Листинг удалён')
      queryClient.invalidateQueries({ queryKey: partnerListingsKeys.list(partnerId) })
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка при удалении')
    }
  })
}

/**
 * Hook to publish a listing (submit for moderation)
 */
export function usePublishListing() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ listingId, partnerId }) => {
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PENDING',
          metadata: {
            is_draft: false,
            needs_review: true,
            submitted_at: new Date().toISOString()
          }
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to publish listing')
      }
      
      return res.json()
    },
    
    onSuccess: (_, { partnerId }) => {
      toast.success('Отправлено на модерацию')
      queryClient.invalidateQueries({ queryKey: partnerListingsKeys.list(partnerId) })
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка публикации')
    }
  })
}

export default usePartnerListings
