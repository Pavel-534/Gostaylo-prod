'use client'

/**
 * Static / legal / help pages — header + content insets only (Stage 171.25).
 * Stage 201.12 — soft-back leading chevron via AppHeader (iOS / PWA nested marketing).
 */

import { usePathname } from 'next/navigation'
import { AppHeader } from '@/components/app-header/AppHeader'
import { MainContent } from '@/components/main-content'
import { ChatUnreadBadgeProvider } from '@/lib/context/ChatUnreadBadgeContext'

/**
 * Default fallback for marketing secondary pages when history is empty.
 * Nested help (escrow) prefers parent /help.
 * @param {string | null | undefined} pathname
 * @returns {string}
 */
export function resolveMarketingSoftBackFallback(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  if (path === '/help/escrow-protection' || path.startsWith('/help/escrow-protection/')) {
    return '/help'
  }
  return '/'
}

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   showSoftBack?: boolean,
 *   softBackFallback?: string,
 * }} props
 */
export function MarketingAppShell({
  children,
  showSoftBack = true,
  softBackFallback,
}) {
  const pathname = usePathname()
  const fallback =
    softBackFallback != null && String(softBackFallback).trim()
      ? String(softBackFallback).trim()
      : resolveMarketingSoftBackFallback(pathname)

  return (
    <ChatUnreadBadgeProvider>
      <AppHeader showSoftBack={showSoftBack} softBackFallback={fallback} />
      <MainContent>{children}</MainContent>
    </ChatUnreadBadgeProvider>
  )
}
