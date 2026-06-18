'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

/**
 * Stage 167.0 — O(1) favorite state via `/api/v2/favorites/check`.
 */
export function useFavoriteState(listingId, { user, openLoginModal, language = 'ru' }) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [checkLoading, setCheckLoading] = useState(false)

  useEffect(() => {
    const id = String(listingId || '').trim()
    if (!user?.id || !id) {
      setIsFavorite(false)
      return
    }

    let cancelled = false
    setCheckLoading(true)
    fetch(`/api/v2/favorites/check?listingId=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success) setIsFavorite(Boolean(data.isFavorite))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, listingId])

  const handleFavoriteClick = useCallback(async () => {
    if (!user) {
      openLoginModal?.()
      return
    }
    const id = String(listingId || '').trim()
    if (favoriteLoading || !id) return

    setFavoriteLoading(true)
    const newState = !isFavorite
    setIsFavorite(newState)

    try {
      const res = await fetch('/api/v2/favorites', {
        method: newState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id }),
      })
      const data = await res.json()
      if (!data.success) {
        setIsFavorite(!newState)
        toast.error(getUIText('listingDetail_favoriteError', language))
      } else {
        toast.success(
          newState
            ? getUIText('listingDetail_favoriteAdded', language)
            : getUIText('listingDetail_favoriteRemoved', language),
        )
      }
    } catch {
      setIsFavorite(!newState)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setFavoriteLoading(false)
    }
  }, [user, favoriteLoading, listingId, isFavorite, language, openLoginModal])

  return {
    isFavorite,
    favoriteLoading: favoriteLoading || checkLoading,
    handleFavoriteClick,
    setIsFavorite,
  }
}
