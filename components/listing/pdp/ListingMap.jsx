'use client'

import { memo } from 'react'
import { useEffect, useState } from 'react'
import nextDynamic from 'next/dynamic'
import { getUIText, detectLanguage } from '@/lib/translations'
import { useElementInView } from '@/hooks/use-element-in-view'
import { useNetworkQuality } from '@/hooks/use-network-quality'
import { useIsMobile } from '@/hooks/use-mobile'
import { PDP_MAP_FALLBACK_CLASS } from '@/lib/listing/pdp-hero-layout'

function ListingMapLoadFallback() {
  const [lang, setLang] = useState('ru')
  useEffect(() => {
    setLang(detectLanguage())
    const h = (e) => e?.detail && setLang(e.detail)
    window.addEventListener('language-change', h)
    return () => window.removeEventListener('language-change', h)
  }, [])
  return (
    <div
      className={`${PDP_MAP_FALLBACK_CLASS} rounded-xl bg-slate-100 flex items-center justify-center`}
    >
      <div className="animate-pulse text-slate-400">{getUIText('mapPicker_loading', lang)}</div>
    </div>
  )
}

const ListingMapCore = nextDynamic(
  () => import('@/components/listing/ListingMap').then((mod) => mod.ListingMap),
  {
    ssr: false,
    loading: () => <ListingMapLoadFallback />,
  },
)

/**
 * PDP map — dynamic import + viewport-gated init (Stage 171.23).
 */
export const ListingMap = memo(function ListingMap({ listing, language }) {
  const networkQuality = useNetworkQuality()
  const isMobile = useIsMobile()
  const rootMargin = networkQuality.constrained ? '0px' : '280px'
  const { ref, inView } = useElementInView({
    rootMargin,
    threshold: networkQuality.constrained ? 0.2 : 0.08,
    once: true,
  })

  const slug = listing?.categorySlug || listing?.category?.slug
  const wizardProfile = listing?.wizardProfile || listing?.category?.wizard_profile

  return (
    <div ref={ref}>
      <h2 className="text-2xl font-medium tracking-tight mb-4">
        {getUIText('whereYoullBe', language, {
          listingCategorySlug: slug,
          wizardProfile,
        })}
      </h2>
      {inView ? (
        <ListingMapCore
          listing={listing}
          latitude={listing.latitude}
          longitude={listing.longitude}
          title={listing.title}
          district={listing.district}
          language={language}
          categoryId={listing.category_id}
          categorySlug={slug}
          cooperativeTouch={isMobile}
        />
      ) : (
        <ListingMapLoadFallback />
      )}
      {listing.district ? (
        <p className="text-sm text-slate-600 mt-4">
          {listing.district}, {listing.city || 'Phuket'}, {getUIText('thailand', language)}
        </p>
      ) : null}
    </div>
  )
})
