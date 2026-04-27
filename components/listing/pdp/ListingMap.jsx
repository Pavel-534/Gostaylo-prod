'use client'

import { useEffect, useState } from 'react'
import nextDynamic from 'next/dynamic'
import { getUIText, detectLanguage } from '@/lib/translations'

function ListingMapLoadFallback() {
  const [lang, setLang] = useState('ru')
  useEffect(() => {
    setLang(detectLanguage())
    const h = (e) => e?.detail && setLang(e.detail)
    window.addEventListener('language-change', h)
    return () => window.removeEventListener('language-change', h)
  }, [])
  return (
    <div className="h-[400px] bg-slate-100 rounded-xl flex items-center justify-center">
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

export function ListingMap({ listing, language }) {
  const slug = listing?.categorySlug || listing?.category?.slug
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight mb-4">
        {getUIText('whereYoullBe', language, {
          listingCategorySlug: slug,
        })}
      </h2>
      <ListingMapCore
        latitude={listing.latitude}
        longitude={listing.longitude}
        title={listing.title}
        district={listing.district}
        language={language}
        categoryId={listing.category_id}
        categorySlug={slug}
      />
      {listing.district ? (
        <p className="text-sm text-slate-600 mt-4">
          {listing.district}, {listing.city || 'Phuket'}, {getUIText('thailand', language)}
        </p>
      ) : null}
    </div>
  )
}
