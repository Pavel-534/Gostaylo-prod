/**
 * useSeasonalPrices - TanStack Query hook for seasonal pricing
 * 
 * Features:
 * - Fetch seasonal prices for listings
 * - UPSERT with automatic conflict resolution
 * - Delete seasonal price policies
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Query key factory
export const seasonalPricesKeys = {
  all: ['seasonal-prices'],
  list: (partnerId, listingId) => [...seasonalPricesKeys.all, 'list', partnerId, listingId],
}

/**
 * Fetch seasonal prices
 */
async function fetchSeasonalPrices({ partnerId, listingId }) {
  const params = new URLSearchParams()
  if (partnerId) params.set('partnerId', partnerId)
  if (listingId) params.set('listingId', listingId)
  
  const res = await fetch(`/api/v2/partner/seasonal-prices?${params.toString()}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store'
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch seasonal prices')
  }
  
  return res.json()
}

/**
 * Hook to fetch seasonal prices
 */
export function useSeasonalPrices(partnerId, listingId = null, options = {}) {
  return useQuery({
    queryKey: seasonalPricesKeys.list(partnerId, listingId),
    queryFn: () => fetchSeasonalPrices({ partnerId, listingId }),
    enabled: !!partnerId && (options.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (response) => response.data
  })
}

/**
 * Hook to upsert seasonal price (with conflict resolution)
 */
export function useUpsertSeasonalPrice() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ listingId, startDate, endDate, priceDaily, seasonType, label, minStay, partnerId }) => {
      const res = await fetch(`/api/v2/partner/seasonal-prices?partnerId=${partnerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          listingId, 
          startDate, 
          endDate, 
          priceDaily,
          seasonType,
          label,
          minStay
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to upsert seasonal price')
      }
      
      return res.json()
    },
    
    onSuccess: (data) => {
      const conflictsResolved = data.meta?.conflictsResolved
      if (conflictsResolved && (conflictsResolved.deleted > 0 || conflictsResolved.updated > 0)) {
        toast.success(`Цены обновлены (разрешено ${conflictsResolved.deleted + conflictsResolved.updated} конфликтов)`)
      } else {
        toast.success('Сезонная цена установлена')
      }
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка при установке цены')
    },
    
    onSettled: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: seasonalPricesKeys.all })
      queryClient.invalidateQueries({ queryKey: ['partner-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['partner-stats'] })
    }
  })
}

/**
 * Hook to delete seasonal price
 */
export function useDeleteSeasonalPrice() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ priceId, partnerId }) => {
      const res = await fetch(
        `/api/v2/partner/seasonal-prices?id=${priceId}&partnerId=${partnerId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete seasonal price')
      }
      
      return res.json()
    },
    
    onSuccess: () => {
      toast.success('Сезонная цена удалена')
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка при удалении')
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: seasonalPricesKeys.all })
      queryClient.invalidateQueries({ queryKey: ['partner-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['partner-stats'] })
    }
  })
}

export default useSeasonalPrices
