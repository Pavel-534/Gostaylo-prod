/**
 * Partner listings — TanStack Query SSOT (Stage 171.6 / 200.91 / 200.128)
 *
 * - Normalized row shape for `app/partner/listings/page.js`
 * - Optimistic cache updates on PATCH / DELETE / RESTORE
 * - `filter=deleted` trash list (Stage 200.128)
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const partnerListingsKeys = {
  all: ['partner-listings'],
  list: (partnerId, filter = 'active') => [
    ...partnerListingsKeys.all,
    'list',
    partnerId,
    filter || 'active',
  ],
  detail: (id) => [...partnerListingsKeys.all, 'detail', id],
}

/**
 * @param {string} partnerId
 * @param {{ filter?: string | null }} [opts]
 */
async function fetchPartnerListings(partnerId, opts = {}) {
  const params = new URLSearchParams({ partnerId: String(partnerId) })
  if (opts.filter === 'deleted') {
    params.set('filter', 'deleted')
  }
  const res = await fetch(`/api/v2/partner/listings?${params}`, {
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

/**
 * @param {string} partnerId
 * @param {{ enabled?: boolean, filter?: 'deleted' | null }} [options]
 */
export function usePartnerListings(partnerId, options = {}) {
  const { enabled = true, filter = null } = options
  const listFilter = filter === 'deleted' ? 'deleted' : 'active'

  return useQuery({
    queryKey: partnerListingsKeys.list(partnerId, listFilter),
    queryFn: () =>
      fetchPartnerListings(partnerId, {
        filter: listFilter === 'deleted' ? 'deleted' : null,
      }),
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
  const queryKey = partnerListingsKeys.list(partnerId, 'active')

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
  const activeKey = partnerListingsKeys.list(partnerId, 'active')
  const deletedKey = partnerListingsKeys.list(partnerId, 'deleted')

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
      await queryClient.cancelQueries({ queryKey: activeKey })
      const previous = queryClient.getQueryData(activeKey)
      queryClient.setQueryData(activeKey, (old) => {
        if (!old?.data) return old
        const nextData = old.data.filter((row) => row.id !== listingId)
        return { ...old, data: nextData, count: nextData.length }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(activeKey, context.previous)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deletedKey, refetchType: 'all' })
    },
  })
}

/** Stage 200.128 — undelete from trash (`POST …/restore`). */
export function usePartnerListingRestore(partnerId) {
  const queryClient = useQueryClient()
  const activeKey = partnerListingsKeys.list(partnerId, 'active')
  const deletedKey = partnerListingsKeys.list(partnerId, 'deleted')

  return useMutation({
    mutationFn: async ({ listingId }) => {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/restore`, {
        method: 'POST',
        credentials: 'include',
      })
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to restore listing')
      }
      return result
    },
    onMutate: async ({ listingId }) => {
      await queryClient.cancelQueries({ queryKey: deletedKey })
      const previous = queryClient.getQueryData(deletedKey)
      queryClient.setQueryData(deletedKey, (old) => {
        if (!old?.data) return old
        const nextData = old.data.filter((row) => row.id !== listingId)
        return { ...old, data: nextData, count: nextData.length }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(deletedKey, context.previous)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeKey, refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: deletedKey, refetchType: 'all' })
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
