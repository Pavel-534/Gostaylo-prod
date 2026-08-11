/**
 * Partner listings — TanStack Query SSOT (Stage 171.6 / 200.91)
 *
 * - Normalized row shape for `app/partner/listings/page.js`
 * - Optimistic cache updates on PATCH / DELETE (no refetch storm)
 * - Overrides global `refetchOnMount: false` so post-save navigation shows fresh prices
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const partnerListingsKeys = {
  all: ['partner-listings'],
  list: (partnerId) => [...partnerListingsKeys.all, 'list', partnerId],
  detail: (id) => [...partnerListingsKeys.all, 'detail', id],
}

async function fetchPartnerListings(partnerId) {
  const res = await fetch(`/api/v2/partner/listings?partnerId=${partnerId}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload.error || 'Failed to fetch listings')
  }
  return payload
}

/** API camelCase row → normalized shape used by partner listings UI. */
export function normalizePartnerListingRow(l) {
  return {
    id: l.id,
    title: l.title,
    status: l.status,
    district: l.district,
    base_price_thb: l.basePriceThb,
    /** ADR-181 L1 — do not drop; list card must not fall back to fake THB. */
    base_currency: l.baseCurrency || l.base_currency || 'THB',
    baseCurrency: l.baseCurrency || l.base_currency || 'THB',
    basePriceAsset: l.basePriceAsset || l.base_price_asset || null,
    country_code: l.countryCode || l.country_code || null,
    commission_rate: l.commissionRate,
    images: l.images || [],
    cover_image: l.coverImage,
    available: l.available,
    is_featured: l.isFeatured,
    views: l.views || 0,
    bookings_count: l.bookingsCount || 0,
    rating: l.rating || 0,
    category: l.category,
    categorySlug: l.categorySlug || l.category?.slug || '',
    categoryName: l.categoryName || l.category?.name || '',
    wizardProfile: l.wizardProfile ?? l.category?.wizard_profile ?? null,
    latitude: l.latitude,
    longitude: l.longitude,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    metadata: l.metadata || {},
    description: l.description ?? '',
    rejection_reason: l.rejectionReason ?? null,
    rejected_at: l.rejectedAt ?? null,
    import_platform: l.importPlatform || l.import_platform || null,
    importPlatform: l.importPlatform || l.import_platform || null,
  }
}

function patchPartnerListingsCache(cached, listingId, patchFn) {
  if (!cached?.data) return cached
  return {
    ...cached,
    data: cached.data.map((row) => (row.id === listingId ? patchFn(row) : row)),
  }
}

/**
 * After wizard save: seed L1 price in cache (instant card) + invalidate with refetchType all
 * (list query is usually inactive on the wizard — default invalidate only refetches active).
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {{
 *   listingId?: string|null,
 *   basePriceAssetAmount?: number|null,
 *   baseCurrency?: string|null,
 * }} [opts]
 */
export async function refreshPartnerListingsAfterSave(queryClient, opts = {}) {
  if (!queryClient) return
  const listingId = opts.listingId ? String(opts.listingId) : ''
  const assetAmt = Number(opts.basePriceAssetAmount)
  const cur = String(opts.baseCurrency || '')
    .toUpperCase()
    .trim()

  if (listingId && Number.isFinite(assetAmt) && assetAmt >= 0) {
    queryClient.setQueriesData({ queryKey: partnerListingsKeys.all }, (old) => {
      if (!old?.data || !Array.isArray(old.data)) return old
      return {
        ...old,
        data: old.data.map((row) => {
          if (String(row.id) !== listingId) return row
          const prevAsset =
            row.basePriceAsset && typeof row.basePriceAsset === 'object' ? row.basePriceAsset : {}
          const currency = cur || prevAsset.currency || row.baseCurrency || row.base_currency || 'THB'
          return {
            ...row,
            baseCurrency: currency,
            base_currency: currency,
            basePriceAsset: {
              ...prevAsset,
              amount: assetAmt,
              currency,
            },
          }
        }),
      }
    })
  }

  await queryClient.invalidateQueries({
    queryKey: partnerListingsKeys.all,
    refetchType: 'all',
  })
}

export function usePartnerListings(partnerId, options = {}) {
  const { enabled = true } = options

  return useQuery({
    queryKey: partnerListingsKeys.list(partnerId),
    queryFn: () => fetchPartnerListings(partnerId),
    enabled: !!partnerId && enabled,
    // Override QUERY_CLIENT_SHARED_DEFAULTS.refetchOnMount:false (Stage 200.91).
    staleTime: 60 * 1000,
    refetchOnMount: true,
    select: (response) => {
      if (!response?.success || !response.data) {
        return { listings: [], total: 0 }
      }
      const listings = response.data.map(normalizePartnerListingRow)
      return { listings, total: response.count || listings.length }
    },
  })
}

/**
 * PATCH listing with optional optimistic cache merge (visibility, publish, etc.)
 */
export function usePartnerListingPatch(partnerId) {
  const queryClient = useQueryClient()
  const queryKey = partnerListingsKeys.list(partnerId)

  return useMutation({
    mutationFn: async ({ listingId, body }) => {
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!result.success) {
        const err = new Error(result.error || 'Failed to update listing')
        err.code = result.code
        err.errors = result.errors
        throw err
      }
      return result
    },
    onMutate: async ({ listingId, optimisticPatch }) => {
      if (!optimisticPatch) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old) =>
        patchPartnerListingsCache(old, listingId, (row) => ({ ...row, ...optimisticPatch(row) })),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (result, { listingId }) => {
      if (result.listing) {
        queryClient.setQueryData(queryKey, (old) =>
          patchPartnerListingsCache(old, listingId, () => result.listing),
        )
      }
    },
  })
}

export function usePartnerListingDelete(partnerId) {
  const queryClient = useQueryClient()
  const queryKey = partnerListingsKeys.list(partnerId)

  return useMutation({
    mutationFn: async ({ listingId }) => {
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete listing')
      }
      return result
    },
    onMutate: async ({ listingId }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        const nextData = old.data.filter((row) => row.id !== listingId)
        return { ...old, data: nextData, count: nextData.length }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
  })
}

/** @deprecated Use usePartnerListingDelete(partnerId) */
export function useDeleteListing(partnerId) {
  return usePartnerListingDelete(partnerId)
}

/** @deprecated Use usePartnerListingPatch(partnerId) */
export function usePublishListing(partnerId) {
  return usePartnerListingPatch(partnerId)
}

export default usePartnerListings
