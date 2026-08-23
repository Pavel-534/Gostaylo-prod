'use client'

/**
 * Messages / chat shell — Realtime JWT, push, presence, full ChatContext (Stage 171.25).
 */

import { ChatProvider } from '@/lib/context/ChatContext'
import { PresenceProvider } from '@/lib/context/PresenceContext'
import { SupabaseRealtimeAuthSync } from '@/components/supabase-realtime-auth-sync'
import { PushClientInit } from '@/components/push-client-init'
import { PushSoftPromptBanner } from '@/components/push/PushSoftPromptBanner'
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'
import { UnpaidCheckoutNudgeBanner } from '@/components/guest/UnpaidCheckoutNudgeBanner'

export function ChatAppShell({ children }) {
  return (
    <>
      <I18nSliceBootstrap preset="chat" />
      <SupabaseRealtimeAuthSync />
      <PushClientInit />
      <PushSoftPromptBanner />
      <PresenceProvider>
        <ChatProvider>
          {children}
          <UnpaidCheckoutNudgeBanner />
        </ChatProvider>
      </PresenceProvider>
    </>
  )
}
