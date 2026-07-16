'use client'

/**
 * Static / legal / help pages — header + content insets only (Stage 171.25).
 */

import { AppHeader } from '@/components/app-header/AppHeader'
import { MainContent } from '@/components/main-content'
import { ChatUnreadBadgeProvider } from '@/lib/context/ChatUnreadBadgeContext'

export function MarketingAppShell({ children }) {
  return (
    <ChatUnreadBadgeProvider>
      <AppHeader />
      <MainContent>{children}</MainContent>
    </ChatUnreadBadgeProvider>
  )
}
