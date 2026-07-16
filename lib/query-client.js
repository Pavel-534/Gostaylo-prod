/**
 * TanStack Query Client Configuration
 *
 * Browser singleton — defaults from `lib/query/query-default-options.js`.
 */

'use client'

import { QueryClient } from '@tanstack/react-query'
import {
  QUERY_CLIENT_SHARED_DEFAULTS,
  getRefetchOnWindowFocusDefault,
  getRefetchOnReconnectDefault,
} from '@/lib/query/query-default-options.js'

export {
  QUERY_CLIENT_SHARED_DEFAULTS,
  getRefetchOnWindowFocusDefault,
  getRefetchOnReconnectDefault,
} from '@/lib/query/query-default-options.js'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...QUERY_CLIENT_SHARED_DEFAULTS,
        refetchOnWindowFocus: getRefetchOnWindowFocusDefault(),
        refetchOnReconnect: getRefetchOnReconnectDefault(),
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

let browserQueryClient = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

/**
 * Stage 128.0 — сброс всего in-memory кэша TanStack Query (logout / смена сессии).
 */
export function clearClientQueryCache() {
  if (typeof window === 'undefined') return
  try {
    getQueryClient().clear()
  } catch {
    /* ignore — logout must not fail */
  }
}

export default getQueryClient
