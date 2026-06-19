'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { fetchFavoritesCheckBatch } from '@/lib/favorites/fetch-favorites-check-batch.js'
import { normalizeListingIdList } from '@/lib/favorites/parse-listing-ids.js'

const OPTIMISTIC_GUARD_MS = 300

/**
 * Batch favorite state for catalog cards (ADR-167 §2.5).
 *
 * @param {{ userId?: string | null, listingIds?: Array<string | number | null | undefined> }} params
 */
export function useFavoritesBatch({ userId, listingIds }) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set())
  const [isChecking, setIsChecking] = useState(false)
  const dirtyIdsRef = useRef(new Set())
  const dirtyTimersRef = useRef(new Map())

  const normalizedIds = useMemo(() => normalizeListingIdList(listingIds), [listingIds])
  const listingIdsKey = useMemo(() => normalizedIds.join(','), [normalizedIds])

  const markDirty = useCallback((listingId) => {
    const id = String(listingId || '').trim()
    if (!id) return

    dirtyIdsRef.current.add(id)
    const prevTimer = dirtyTimersRef.current.get(id)
    if (prevTimer) clearTimeout(prevTimer)
    dirtyTimersRef.current.set(
      id,
      setTimeout(() => {
        dirtyIdsRef.current.delete(id)
        dirtyTimersRef.current.delete(id)
      }, OPTIMISTIC_GUARD_MS),
    )
  }, [])

  useEffect(() => {
    const timers = dirtyTimersRef.current
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setFavoriteIds(new Set())
      setIsChecking(false)
      return
    }

    const ids = listingIdsKey ? listingIdsKey.split(',') : []
    if (ids.length === 0) {
      setIsChecking(false)
      return
    }

    const controller = new AbortController()
    setIsChecking(true)

    fetchFavoritesCheckBatch(ids, { signal: controller.signal })
      .then((favoritesMap) => {
        if (controller.signal.aborted) return
        setFavoriteIds((prev) => {
          const next = new Set(prev)
          for (const [id, isFavorite] of Object.entries(favoritesMap)) {
            if (dirtyIdsRef.current.has(id)) continue
            if (isFavorite) next.add(id)
            else next.delete(id)
          }
          return next
        })
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        console.error('[useFavoritesBatch]', err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsChecking(false)
      })

    return () => controller.abort()
  }, [userId, listingIdsKey])

  const applyOptimisticFavorite = useCallback(
    (listingId, isFavorite) => {
      const id = String(listingId || '').trim()
      if (!id) return
      markDirty(id)
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (isFavorite) next.add(id)
        else next.delete(id)
        return next
      })
    },
    [markDirty],
  )

  return {
    favoriteIds,
    setFavoriteIds,
    isChecking,
    applyOptimisticFavorite,
  }
}
