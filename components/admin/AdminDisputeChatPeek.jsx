'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ru-RU', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminDisputeChatPeek({ conversationId, adminUserId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v2/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(json.error || 'Не удалось загрузить сообщения')
        setMessages([])
        return
      }
      setMessages(Array.isArray(json.data) ? json.data : [])
    } catch {
      setError('Ошибка сети')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, conversationId])

  if (!conversationId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
        Нет привязанного чата к этому кейсу.
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <MessageSquare className="h-4 w-4 text-teal-700" />
          История чата
        </div>
        <button
          type="button"
          className="text-xs text-teal-700 hover:underline"
          onClick={() => void load()}
          disabled={loading}
        >
          Обновить
        </button>
      </div>
      <div className="h-56 overflow-y-auto px-2 py-2 space-y-2 bg-slate-50/80">
        {loading ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 px-2 py-4">{typeof error === 'string' ? error : 'Ошибка'}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500 px-2 py-4">Сообщений пока нет.</p>
        ) : (
          messages.map((m) => {
            const mine = adminUserId && String(m.senderId || '') === String(adminUserId)
            const label = m.senderName || m.senderRole || 'Участник'
            const body = String(m.content ?? m.message ?? '').trim()
            return (
              <div
                key={m.id}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[92%] rounded-lg px-2.5 py-1.5 text-xs shadow-sm',
                    mine ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-100',
                  )}
                >
                  <div className={cn('font-semibold mb-0.5', mine ? 'text-indigo-100' : 'text-slate-600')}>
                    {label}
                    <span className={cn('font-normal ml-1 opacity-80')}>{formatTime(m.createdAt)}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{body || '—'}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
