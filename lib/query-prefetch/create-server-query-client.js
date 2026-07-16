/**
 * Ephemeral TanStack Query client for RSC prefetch / dehydrate.
 * Stage 171.24 (PR-2) — no browser singleton; one instance per server request.
 *
 * Default options mirror `lib/query-client.js` (`makeQueryClient`) so hydrated
 * cache behaves the same as catalog hover prefetch and client `getQueryClient()`.
 */

import { QueryClient } from '@tanstack/react-query'
import { QUERY_CLIENT_SHARED_DEFAULTS } from '@/lib/query/query-default-options.js'

/** @type {import('@tanstack/react-query').DefaultOptions} */
export const SERVER_QUERY_CLIENT_DEFAULT_OPTIONS = {
  queries: {
    ...QUERY_CLIENT_SHARED_DEFAULTS,
    // RSC prefetch only — focus refetch is a browser concern
    refetchOnWindowFocus: true,
  },
  mutations: {
    retry: 1,
  },
}
/**
 * Create a fresh QueryClient for server-side prefetch.
 * Callers must not reuse across requests — always create per RSC render.
 *
 * @returns {import('@tanstack/react-query').QueryClient}
 */
export function createServerQueryClient() {
  return new QueryClient({
    defaultOptions: SERVER_QUERY_CLIENT_DEFAULT_OPTIONS,
  })
}
