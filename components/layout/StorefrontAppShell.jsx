'use client'

/**
 * Guest storefront shell — Query, analytics, nav chrome (Stage 171.25 route group).
 * Stage M1.1 — PushClientInit here (and partner layout); chat layout keeps a copy for direct /messages entry.
 * Stage 201.13 — soft-back leading on nested profile / settings / my-bookings via AppHeader.
 * Stage 201.37 — no workspace menu toggle here (guest shell has no sidebar).
 * Stage 201.97 — Search tab keep-alive pane (catalog tree parked in this shell).
 */

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import GeoSuggestToast from '@/components/geo/GeoSuggestToast'
import { AppHeader } from '@/components/app-header/AppHeader'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { MainContent } from '@/components/main-content'
import { StorefrontSearchKeepAlivePane } from '@/components/navigation/StorefrontSearchKeepAlive'
import { AppQueryProvider } from '@/components/providers/app-query-provider'
import { ProductAnalyticsInit } from '@/components/analytics/ProductAnalyticsInit'
import { PwaInstallChrome } from '@/components/pwa/PwaInstallChrome'
import { PwaInstallProvider } from '@/hooks/use-pwa-install'
import { PushClientInit } from '@/components/push-client-init'
import { ChatUnreadBadgeProvider } from '@/lib/context/ChatUnreadBadgeContext'
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'
import { UnpaidCheckoutNudgeBanner } from '@/components/guest/UnpaidCheckoutNudgeBanner'
import { resolveStorefrontSoftBack } from '@/lib/navigation/soft-back-routes'

export function StorefrontAppShell({ children }) {
  const pathname = usePathname()
  const { showSoftBack, softBackFallback } = resolveStorefrontSoftBack(pathname)

  return (
    <AppQueryProvider>
      <PwaInstallProvider>
        <ChatUnreadBadgeProvider>
          <I18nSliceBootstrap preset="storefront" />
          <Suspense fallback={null}>
            <ProductAnalyticsInit />
          </Suspense>
          <PushClientInit />
          <AppHeader
            showSoftBack={showSoftBack}
            softBackFallback={softBackFallback}
            showMenuButton={false}
          />
          <MainContent>
            <StorefrontSearchKeepAlivePane>{children}</StorefrontSearchKeepAlivePane>
          </MainContent>
          <UnpaidCheckoutNudgeBanner />
          <MobileBottomNav />
          <PwaInstallChrome />
          <GeoSuggestToast />
        </ChatUnreadBadgeProvider>
      </PwaInstallProvider>
    </AppQueryProvider>
  )
}
