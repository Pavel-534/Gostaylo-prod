'use client'

/**
 * Partner route group wrapper — unread badge without full Chat Realtime stack.
 */

import { ChatUnreadBadgeProvider } from '@/lib/context/ChatUnreadBadgeContext'
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'

export function PartnerRouteShell({ children }) {
  return (
    <ChatUnreadBadgeProvider>
      <I18nSliceBootstrap preset="partner" />
      {children}
    </ChatUnreadBadgeProvider>
  )
}
