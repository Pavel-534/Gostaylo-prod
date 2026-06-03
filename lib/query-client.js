/**
 * TanStack Query Client Configuration
 * 
 * Centralized configuration for React Query
 * - Stale time: 5 minutes
 * - Cache time: 30 minutes
 * - Retry: 1 attempt
 * - Refetch on window focus: enabled
 */

'use client'

import { QueryClient } from '@tanstack/react-query'

// Create a stable QueryClient instance
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
        // Refetch when window regains focus
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
      },
    },
  })
}

let browserQueryClient = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

/**
 * Stage 128.0 — сброс всего in-memory кэша TanStack Query (logout / смена сессии).
 * Вызывается из `clearBrowserPersistedAuthState` — единая точка с `invalidateAllClientRequests`.
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
