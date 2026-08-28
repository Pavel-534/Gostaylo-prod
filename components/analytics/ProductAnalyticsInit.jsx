'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { COOKIE_CONSENT_EVENT } from '@/lib/consent/cookie-consent-config.js'
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
    const onConsentGranted = () => {
      void (async () => {
        const { hasAnalyticsConsent } = await import('@/lib/consent/cookie-consent-state.js')
        if (!hasAnalyticsConsent()) return
        await initProductAnalytics()
        if (!pathname) return
        const qs = searchParams?.toString()
        void trackProductEvent(ProductAnalyticsEvents.PAGE_VIEW, {
          path: pathname,
          search: qs || undefined,
        })
      })()
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentGranted)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentGranted)
  }, [pathname, searchParams])

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
