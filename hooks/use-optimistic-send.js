'use client'

/**
 * useOptimisticSend — хук для мгновенной отправки сообщения (optimistic UI).
 *
 * Сценарий:
 *  1. Нажатие «Отправить» → сообщение сразу появляется в ленте со статусом 'sending' (полупрозрачное + часики).
 *  2. Сервер ответил успешно → статус меняется на 'sent' (реальное id + is_read: false → ✓).
 *  3. Ошибка → сообщение удаляется из ленты, показывается toast.
 *
 * Использование:
 *   const { sendText } = useOptimisticSend({ conversationId, userId, setMessages })
 *   await sendText(content, extraBody)  // extra = { skipPush, metadata, ... }
 */

import { useCallback } from 'react'
import { toast } from 'sonner'

let _tempCounter = 0
function tempId() {
  return `_opt_${Date.now()}_${++_tempCounter}`
}

function buildOptimisticMessage({ id, conversationId, userId, content, type = 'text', metadata = null }) {
  return {
    id,
    _optimistic: true,
    _status: 'sending',       // 'sending' | 'sent' | 'error'
    conversation_id: conversationId,
    sender_id: userId,
    sender_role: null,
    sender_name: null,
    message: content,
    content,
    type,
    metadata,
    is_read: false,
    isRead: false,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
}

export function useOptimisticSend({ conversationId, userId, setMessages }) {
  const sendText = useCallback(
    async (content, extraBody = {}) => {
      if (!content?.trim() || !conversationId || !userId) return null

      const tid = tempId()
      const optimistic = buildOptimisticMessage({
        id: tid,
        conversationId,
        userId,
        content: content.trim(),
        type: 'text',
      })

      // 1. Мгновенно показываем
      setMessages((prev) => [...prev, optimistic])

      try {
        const res = await fetch('/api/v2/chat/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            content: content.trim(),
            type: 'text',
            ...extraBody,
          }),
        })
        const json = await res.json()

        if (res.ok && json.success && json.data) {
          const real = json.data
          // 2. Заменяем оптимистичное реальным
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tid
                ? {
                    ...m,
                    id: real.id ?? real.messageId ?? m.id,
                    _optimistic: false,
                    _status: 'sent',
                    is_read: real.isRead ?? real.is_read ?? false,
                    isRead: real.isRead ?? real.is_read ?? false,
                    created_at: real.createdAt ?? real.created_at ?? m.created_at,
                    createdAt: real.createdAt ?? real.created_at ?? m.createdAt,
                  }
                : m,
            ),
          )
          return json.data
        } else {
          // 3. Ошибка — удаляем и показываем toast
          setMessages((prev) => prev.filter((m) => m.id !== tid))
          toast.error(json.error || 'Ошибка отправки')
          return null
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tid))
        toast.error('Ошибка сети')
        return null
      }
    },
    [conversationId, userId, setMessages],
  )

  return { sendText }
}
