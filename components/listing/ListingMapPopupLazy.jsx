'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'
import { ListingPopupCard } from '@/components/listing/ListingPopupCard'
import { getUIText } from '@/lib/translations'

const LISTING_DETAIL_STALE_MS = 5 * 60 * 1000

function ListingMapPopupSkeleton({ language }) {
  return (
    <div
      className="w-[220px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 animate-pulse"
      aria-busy="true"
      aria-label={getUIText('mapPicker_loading', language)}
    >
      <div className="h-28 w-full bg-slate-200" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-4/5 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
        <div className="mt-1 h-9 w-full rounded-xl bg-slate-200" />
      </div>
    </div>
  )
}

/**
 * Stage 163.1 — lazy popup body: skeleton → GET /api/v2/listings/:id (TanStack cache).
 */
export function ListingMapPopupLazy({
  listingId,
  enabled = true,
  language = 'ru',
  isApproximateLocation = false,
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onOpenDetails = null,
}) {
  const id = String(listingId || '').trim()
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.listing.detail(id),
    queryFn: () => fetchListingDetail(id),
    enabled: enabled && Boolean(id),
    staleTime: LISTING_DETAIL_STALE_MS,
  })

  if (!id) return null
  if (isLoading) return <ListingMapPopupSkeleton language={language} />
  if (isError || !data) {
    return (
      <p className="w-64 p-3 text-sm text-slate-500">{getUIText('failedToLoadListing', language)}</p>
    )
  }
  if (data.moderationPending) {
    return (
      <p className="w-64 p-3 text-sm text-slate-500">
        {getUIText('listingDetail_underModeration', language)}
      </p>
    )
  }

  return (
    <ListingPopupCard
      listing={data}
      language={language}
      isApproximateLocation={isApproximateLocation}
      initialDates={initialDates}
      currency={currency}
      exchangeRates={exchangeRates}
      onOpenDetails={onOpenDetails}
    />
  )
}
