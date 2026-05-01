'use client'

/**
 * useShareListing — Web Share API хелпер с fallback на clipboard.
 *
 * - Если поддерживается navigator.share — открывает нативный sharesheet (iOS/Android/Edge)
 * - Иначе копирует ссылку в буфер обмена и кидает toast
 * - Все строки — i18n через getUIText
 *
 * @created 2026-02 Squash Sprint — Web Share для виральности
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

/**
 * @param {object} opts
 * @param {string} opts.url — абсолютный или относительный URL (будет приведён к абсолютному)
 * @param {string} opts.title
 * @param {string} [opts.text]
 * @param {string} [opts.language='ru']
 */
export function useShareListing({ url, title, text, language = 'ru' }) {
  return useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (e?.stopPropagation) e.stopPropagation()

    if (typeof window === 'undefined') return

    const absoluteUrl = url?.startsWith('http')
      ? url
      : `${window.location.origin}${url || window.location.pathname}`

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
  }, [url, title, text, language])
}

export default useShareListing
