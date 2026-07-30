'use client'

/**
 * Stage 200.17 — soft back: progress signal + history.back with fallback push.
 */

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'

/**
 * @param {string} [fallbackHref='/']
 */
export function useSoftBack(fallbackHref = '/') {
  const router = useRouter()
  const fallback = String(fallbackHref || '/').trim() || '/'

  return useCallback(() => {
    dispatchOptimisticNavPending(fallback)
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallback)
  }, [fallback, router])
}
