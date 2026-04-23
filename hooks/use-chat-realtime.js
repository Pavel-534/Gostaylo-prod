'use client'

/**
 * Realtime message INSERT/UPDATE for a single conversation (thread).
 * Wraps `useRealtimeMessages` — SSoT for live delivery and read-receipt updates in the messenger.
 * @see hooks/use-realtime-chat.js
 * @see hooks/use-chat-thread-messages.js
 */
import { useRealtimeMessages } from '@/hooks/use-realtime-chat'

/**
 * @param {string|null} conversationId
 * @param {(raw: object) => void} onInsert
 * @param {(raw: object) => void} onUpdate
 * @param {{ onResync?: () => void|Promise<void> }|null} [options]
 * @returns {{ isConnected: boolean, error: unknown, reconnectGeneration: number }}
 */
export function useChatRealtime(conversationId, onInsert, onUpdate, options = null) {
  return useRealtimeMessages(conversationId, onInsert, onUpdate, options)
}
