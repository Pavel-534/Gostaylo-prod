'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ListingCard } from '@/components/listing-card'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { getUIText } from '@/lib/translations'
import { SIMILAR_MIN_RESULTS } from '@/lib/recommendations/constants'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'

export function SimilarListingsRail({
  listingId,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
}) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = String(listingId || '').trim()
    if (!id) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/v2/listings/${encodeURIComponent(id)}/similar?limit=12`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.listings)) {
          setListings(data.listings)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [listingId])

  if (loading) {
    return (
      <RecommendationRailShell
        title={getUIText('similarListingsTitle', language)}
        className={className}
      >
        <div className="min-w-[260px] snap-start">
          <ListingGridSkeleton count={1} />
        </div>
      </RecommendationRailShell>
    )
  }

  if (listings.length < SIMILAR_MIN_RESULTS) return null

  return (
    <RecommendationRailShell
      title={getUIText('similarListingsTitle', language)}
      className={className}
    >
      {listings.map((listing) => (
        <div key={listing.id} className="w-[260px] shrink-0 snap-start">
          <Link href={`/listings/${listing.id}`} className="block">
            <ListingCard
              listing={listing}
              language={language}
              currency={currency}
              exchangeRates={exchangeRates}
              className="h-full"
            />
          </Link>
        </div>
      ))}
    </RecommendationRailShell>
  )
}
