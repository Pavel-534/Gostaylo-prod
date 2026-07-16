/**
 * TanStack Query shared defaults (Stage 171.32).
 * Safe for server prefetch + browser `getQueryClient()` — no `'use client'`.
 */

import { isStandaloneDisplayMode } from '@/lib/pwa/pwa-platform.js'

export const QUERY_CLIENT_SHARED_DEFAULTS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 1,
  refetchOnMount: false,
}

/**
 * Standalone PWA — disable focus refetch burst on resume (iOS audit IOS-P1-02).
 * Browser tabs — keep refetch on focus.
 *
 * @returns {boolean}
 */
export function getRefetchOnWindowFocusDefault() {
  if (typeof window === 'undefined') return true
  return !isStandaloneDisplayMode()
}

/**
 * Stage 189.0 — standalone also skips reconnect storms after radio flap on 4G Phuket.
 * @returns {boolean}
 */
export function getRefetchOnReconnectDefault() {
  if (typeof window === 'undefined') return true
  return !isStandaloneDisplayMode()
}
