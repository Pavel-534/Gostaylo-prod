'use client'

/**
 * Stage 201.97 — below-fold catalog cards mount on approach (IntersectionObserver).
 */

import { useEffect, useRef, useState } from 'react'
import { ListingCardSkeleton } from '@/components/listing-card-skeleton'

export function CatalogDeferredCardSlot({
  forceMount = false,
  children,
}) {
  const ref = useRef(null)
  const [mounted, setMounted] = useState(forceMount)

  useEffect(() => {
    if (forceMount) setMounted(true)
  }, [forceMount])

  useEffect(() => {
    if (mounted) return undefined
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMounted(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
          io.disconnect()
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mounted])

  if (mounted) return children

  return (
    <div ref={ref} data-testid="catalog-deferred-card-slot">
      <ListingCardSkeleton />
    </div>
  )
}
