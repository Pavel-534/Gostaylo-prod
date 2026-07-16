'use client'

/**
 * Partner route group wrapper — unread badge without full Chat Realtime stack.
 * AppQueryProvider also lives in RootClientProviders; kept here as belt-and-suspenders
 * if a future slim root omits query again.
 */

import { AppQueryProvider } from '@/components/providers/app-query-provider'
import { ChatUnreadBadgeProvider } from '@/lib/context/ChatUnreadBadgeContext'
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'

export function PartnerRouteShell({ children }) {
  return (
    <AppQueryProvider>
      <ChatUnreadBadgeProvider>
        <I18nSliceBootstrap preset="partner" />
        {children}
      </ChatUnreadBadgeProvider>
    </AppQueryProvider>
  )
}
