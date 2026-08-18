'use client'

/**
 * Stage 201.103 — passthrough only. Home and catalog UI render inside their
 * page HydrationBoundary again. Parking both trees in the shell (201.97–201.102)
 * left visible UI without dehydrated cache and kept Home+catalog mounted together
 * on phones (skeletons / white screen).
 */

import { useEffect } from 'react'
import { registerStorefrontSearchKeepAliveReveal } from '@/lib/navigation/storefront-search-keep-alive'

export function StorefrontSearchKeepAlivePane({ children }) {
  useEffect(() => registerStorefrontSearchKeepAliveReveal(() => false), [])
  return children
}
