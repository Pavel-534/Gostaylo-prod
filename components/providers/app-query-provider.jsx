'use client'

/**
 * Единый QueryClient для всего приложения — кэш `wallet-me` и др. между layout’ами (public / renter / partner).
 */

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'

export function AppQueryProvider({ children }) {
  const [client] = useState(() => getQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
