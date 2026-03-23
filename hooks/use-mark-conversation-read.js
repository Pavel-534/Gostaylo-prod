'use client'

import { useEffect, useCallback } from 'react'

/**
 * Периодически помечает входящие сообщения прочитанными, пока открыт чат.
 * Чаще опрашиваем, когда собеседник в Presence — быстрее появляются двойные галочки.
 */
export function useMarkConversationRead(conversationId, enabled, peerOnline) {
  const mark = useCallback(async () => {
    if (!conversationId || !enabled) return
    try {
      await fetch('/api/v2/chat/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })
    } catch {
      /* ignore */
    }
  }, [conversationId, enabled])

  const intervalMs = peerOnline ? 10000 : 22000

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
}
