'use client'

import { useEffect, useCallback } from 'react'
import { postChatMarkRead } from '@/lib/chat/chat-ui-api-client'

/**
 * Периодически помечает входящие сообщения прочитанными, пока открыт чат.
 * Возвращает `markNow()` — вызывайте при получении нового Realtime-сообщения,
 * чтобы двойные галочки синели мгновенно, не дожидаясь следующего тика.
 */
export function useMarkConversationRead(conversationId, enabled, peerOnline) {
  const mark = useCallback(async () => {
    if (!conversationId || !enabled) return
    try {
      await postChatMarkRead(conversationId)
    } catch {
      /* ignore */
    }
  }, [conversationId, enabled])

  // Быстрее при активном собеседнике — галочки синеют без задержки
  const intervalMs = peerOnline ? 6000 : 20000

  useEffect(() => {
    if (!enabled || !conversationId) return
    mark()
    const t = setInterval(mark, intervalMs)
    const onVis = () => {
      if (document.visibilityState === 'visible') mark()
    }
    window.addEventListener('focus', mark)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', mark)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, conversationId, mark, intervalMs])

  // Возвращаем для вызова по событию (новое сообщение от собеседника)
  return { markNow: mark }
}
