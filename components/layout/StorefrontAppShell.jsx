'use client'

/**
 * Guest storefront shell — Query, analytics, nav chrome (Stage 171.25 route group).
 * Chat Realtime / Push / full ChatProvider — only in `(chat)` layout.
 */

import { Suspense } from 'react'
import GeoSuggestToast from '@/components/geo/GeoSuggestToast'
import { AppHeader } from '@/components/app-header/AppHeader'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { MainContent } from '@/components/main-content'
import { AppQueryProvider } from '@/components/providers/app-query-provider'
import { ProductAnalyticsInit } from '@/components/analytics/ProductAnalyticsInit'
import { PwaInstallChrome } from '@/components/pwa/PwaInstallChrome'
import { PwaInstallProvider } from '@/hooks/use-pwa-install'
import { ChatUnreadBadgeProvider } from '@/lib/context/ChatUnreadBadgeContext'
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'

export function StorefrontAppShell({ children }) {
  return (
    <AppQueryProvider>
      <PwaInstallProvider>
        <ChatUnreadBadgeProvider>
          <I18nSliceBootstrap preset="storefront" />
          <Suspense fallback={null}>
            <ProductAnalyticsInit />
          </Suspense>
          <AppHeader />
          <MainContent>{children}</MainContent>
          <MobileBottomNav />
          <PwaInstallChrome />
          <GeoSuggestToast />
        </ChatUnreadBadgeProvider>
      </PwaInstallProvider>
    </AppQueryProvider>
  )
}
