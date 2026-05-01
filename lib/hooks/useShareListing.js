'use client'

/**
 * useShareListing — Web Share API хелпер с fallback на clipboard.
 *
 * - Если поддерживается navigator.share — открывает нативный sharesheet (iOS/Android/Edge)
 * - Иначе копирует ссылку в буфер обмена и кидает toast
 * - Все строки — i18n через getUIText
 * - UTM-параметры автоматически добавляются для аналитики виральности:
 *   ?utm_source=share&utm_medium=guest&utm_campaign=listing&utm_id={listing_id}
 *
 * @created 2026-02 Squash Sprint — Web Share для виральности
 * @updated 2026-02 — UTM tracking
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

/** Добавляет UTM-параметры к URL для аналитики */
function appendShareUtm(url, listingId) {
  try {
    const u = new URL(url)
    // Не перезаписываем существующие UTM (например, если пользователь уже пришёл по share-ссылке)
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'share')
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'guest')
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', 'listing')
    if (listingId && !u.searchParams.has('utm_id')) u.searchParams.set('utm_id', String(listingId))
    return u.toString()
  } catch {
    return url
  }
}

/**
 * @param {object} opts
 * @param {string} opts.url — абсолютный или относительный URL (будет приведён к абсолютному)
 * @param {string} opts.title
 * @param {string} [opts.text]
 * @param {string} [opts.language='ru']
 * @param {string|number} [opts.listingId] — для utm_id, рекомендуется
 */
export function useShareListing({ url, title, text, language = 'ru', listingId }) {
  return useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (e?.stopPropagation) e.stopPropagation()

    if (typeof window === 'undefined') return

    const baseUrl = url?.startsWith('http')
      ? url
      : `${window.location.origin}${url || window.location.pathname}`
    const absoluteUrl = appendShareUtm(baseUrl, listingId)

    // 1) Web Share API (native sheet)
    if (navigator?.share) {
      try {
        await navigator.share({ title, text: text || title, url: absoluteUrl })
        return
      } catch (err) {
        // AbortError = user cancelled — silent
        if (err?.name === 'AbortError') return
        // Otherwise fall through to clipboard
      }
    }

    // 2) Clipboard fallback
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      toast.success(getUIText('shareCopied', language))
    } catch {
      toast.error(getUIText('shareCopyError', language))
    }
  }, [url, title, text, language, listingId])
}

export default useShareListing
