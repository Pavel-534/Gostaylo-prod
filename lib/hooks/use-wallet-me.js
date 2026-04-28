'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

export const WALLET_ME_QUERY_KEY = ['wallet-me']

async function fetchWalletMe() {
  const res = await fetch('/api/v2/wallet/me', { credentials: 'include', cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'WALLET_ME_FAILED')
  }
  return json.data
}

/**
 * Глобальный кэш баланса (ключ `wallet-me`). Инвалидируйте после операций с кошельком.
 */
export function useWalletMeQuery(options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: WALLET_ME_QUERY_KEY,
    queryFn: fetchWalletMe,
    enabled,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/** Инвалидация глобального кэша баланса (шапка, реферальная страница и т.д.) */
export function invalidateWalletMeQuery(queryClient) {
  if (!queryClient) return Promise.resolve()
  return queryClient.invalidateQueries({ queryKey: WALLET_ME_QUERY_KEY })
}

export function useInvalidateWalletMe() {
  const qc = useQueryClient()
  return () => invalidateWalletMeQuery(qc)
}
