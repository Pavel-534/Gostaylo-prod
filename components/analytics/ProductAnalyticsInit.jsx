'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  initProductAnalytics,
  trackProductEvent,
  ProductAnalyticsEvents,
} from '@/lib/analytics/product-analytics.js'

/**
 * Stage 116.0 — page_view + PostHog init (opt-in via NEXT_PUBLIC_POSTHOG_KEY).
 */
export function ProductAnalyticsInit() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    void initProductAnalytics()
  }, [])

  useEffect(() => {
    if (!pathname) return
    const qs = searchParams?.toString()
    void trackProductEvent(ProductAnalyticsEvents.PAGE_VIEW, {
      path: pathname,
      search: qs || undefined,
    })
  }, [pathname, searchParams])

  return null
}
