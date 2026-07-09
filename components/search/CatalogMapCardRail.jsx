'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { MapRailCard } from '@/components/search/MapRailCard'
import { CATALOG_MAP_MOBILE_RAIL_CARD_WIDTH } from '@/lib/maps/catalog-map-ux-policy'

/**
 * Controlled mobile rail for map sheet (native CSS snap + scroll math).
 */
export function CatalogMapCardRail({
  listings = [],
  activeListingId = null,
  onActiveListingChange,
  onListingOpen,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
}) {
  const containerRef = useRef(null)
  const rafRef = useRef(0)
  const lastEmitRef = useRef(null)

  const idToIndex = useMemo(() => {
    const map = new Map()
    for (let i = 0; i < listings.length; i += 1) {
      const id = String(listings[i]?.id || '')
      if (id) map.set(id, i)
    }
    return map
  }, [listings])

  const emitCenteredListing = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const children = Array.from(container.querySelectorAll('[data-rail-card]'))
    if (!children.length) return

    const centerX = container.scrollLeft + container.clientWidth / 2
    let winnerId = null
    let winnerDelta = Number.POSITIVE_INFINITY

    for (const node of children) {
      const id = node.getAttribute('data-listing-id')
      if (!id) continue
      const mid = node.offsetLeft + node.clientWidth / 2
      const delta = Math.abs(mid - centerX)
      if (delta < winnerDelta) {
        winnerDelta = delta
        winnerId = id
      }
    }

    if (!winnerId) return
    if (lastEmitRef.current === winnerId) return
    lastEmitRef.current = winnerId
    onActiveListingChange?.(winnerId)
  }, [onActiveListingChange])

  const scheduleEmit = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      emitCenteredListing()
    })
  }, [emitCenteredListing])

  useEffect(() => {
    scheduleEmit()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [listings, scheduleEmit])

  useEffect(() => {
    const id = String(activeListingId || '')
    if (!id) return
    const container = containerRef.current
    if (!container) return

    const index = idToIndex.get(id)
    if (index == null) return

    const node = container.querySelector(`[data-listing-id="${id}"]`)
    if (!node) return

    const targetLeft = node.offsetLeft - (container.clientWidth - node.clientWidth) / 2
    const delta = Math.abs(container.scrollLeft - targetLeft)
    if (delta < 4) return

    container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
  }, [activeListingId, idToIndex])

  if (!listings.length) return null

  return (
    <div className={cn('pointer-events-auto', className)}>
      <div
        ref={containerRef}
        className={cn(
          'flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 py-2',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
        onScroll={scheduleEmit}
      >
        <div className="w-[1px] shrink-0" aria-hidden />
        {listings.map((listing, index) => {
          const id = String(listing?.id || '')
          const isActive = id && String(activeListingId || '') === id
          return (
            <div
              key={id || `rail-${index}`}
              data-rail-card
              data-listing-id={id}
              className="snap-center shrink-0"
              style={{ width: `${CATALOG_MAP_MOBILE_RAIL_CARD_WIDTH}px` }}
            >
              <MapRailCard
                listing={listing}
                active={isActive}
                language={language}
                currency={currency}
                exchangeRates={exchangeRates}
                onOpen={(nextListing) =>
                  onListingOpen?.(String(nextListing?.id || ''), nextListing)
                }
              />
            </div>
          )
        })}
        <div className="w-[1px] shrink-0" aria-hidden />
      </div>
    </div>
  )
}

export default CatalogMapCardRail
