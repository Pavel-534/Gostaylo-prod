'use client'

/**
 * Временный диагностический оверлей Realtime (только admin-аккаунт).
 * Показывает: статус канала, JWT-токен, пришедшие события.
 * Убрать из лейаута после устранения проблемы.
 *
 * Использование в app/messages/[id]/page.js или layout.js:
 *   import { RealtimeDiagOverlay } from '@/components/chat/RealtimeDiagOverlay'
 *   // Render only for admin:  <RealtimeDiagOverlay conversationId="conv-…" />
 */

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'

export function RealtimeDiagOverlay({ conversationId }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState([])
  const [channelStatus, setChannelStatus] = useState('idle')
  const [diagJson, setDiagJson] = useState(null)
  const [tokenInfo, setTokenInfo] = useState(null)
  const seqRef = useRef(0)

  const addLog = (msg, level = 'info') => {
    const ts = new Date().toLocaleTimeString()
    setLog((prev) => [...prev.slice(-49), { ts, msg, level }])
  }

  // ── Server-side diagnostic ──────────────────────────────────────────────
  const runServerDiag = async () => {
    addLog('→ Запрашиваю /api/v2/realtime-diag …')
    try {
      const res = await fetch('/api/v2/realtime-diag', { credentials: 'include' })
      const data = await res.json()
      setDiagJson(data)
      addLog(`Server diag: ${data.summary}`, data.summary.startsWith('✅') ? 'ok' : 'error')
    } catch (e) {
      addLog(`Server diag error: ${e.message}`, 'error')
    }
  }

  // ── JWT token check ─────────────────────────────────────────────────────
  const checkToken = async () => {
    addLog('→ Запрашиваю /api/v2/auth/realtime-token …')
    try {
      const res = await fetch('/api/v2/auth/realtime-token', { credentials: 'include' })
      const data = await res.json()
      if (data?.access_token) {
        const parts = data.access_token.split('.')
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        setTokenInfo(payload)
        addLog(`JWT OK: sub=${payload.sub} role=${payload.role}`, 'ok')
        if (supabase) {
          supabase.realtime.setAuth(data.access_token)
          addLog('supabase.realtime.setAuth() → done', 'ok')
        }
      } else {
        addLog(`JWT FAIL: ${JSON.stringify(data)}`, 'error')
      }
    } catch (e) {
      addLog(`Token error: ${e.message}`, 'error')
    }
  }

  // ── Realtime channel test ───────────────────────────────────────────────
  const testChannel = () => {
    if (!supabase) { addLog('supabase client = null ⛔', 'error'); return }
    const attempt = ++seqRef.current
    addLog(`→ Создаю тестовый канал #${attempt} (messages, без фильтра) …`)
    setChannelStatus('connecting')

    const stop = subscribeRealtimeWithBackoff({
      supabase,
      channelLabel: `diag:messages:${attempt}`,
      createChannel: (n) =>
        supabase
          .channel(`diag-messages:${user?.id}:${n}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const cid = payload.new?.conversation_id ?? '?'
            addLog(`🟢 REALTIME_EVENT_RECEIVED: INSERT messages conv=${cid} id=${payload.new?.id}`, 'ok')
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
            addLog(`🟢 REALTIME_EVENT_RECEIVED: ${payload.eventType} conversations id=${payload.new?.id ?? payload.old?.id}`, 'ok')
          })
          .on('broadcast', { event: 'diag-ping' }, ({ payload }) => {
            addLog(`🟢 BROADCAST received: ${JSON.stringify(payload)}`, 'ok')
          }),
      onChannelStatus: (status) => {
        setChannelStatus(status)
        const icon = status === 'SUBSCRIBED' ? '✅' : '⚠️'
        addLog(`${icon} channel status: ${status}`, status === 'SUBSCRIBED' ? 'ok' : 'warn')
      },
    })

    // Очищаем при закрытии оверлея
    return stop
  }

  const stopRef = useRef(null)
  const startChannelTest = () => {
    stopRef.current?.()
    stopRef.current = testChannel()
  }

  useEffect(() => {
    return () => stopRef.current?.()
  }, [])

  // Показываем только для admin
  if (!user || (user.role !== 'ADMIN' && user.role !== 'admin')) return null

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-[9999] bg-red-600 text-white text-xs px-2 py-1 rounded opacity-80 hover:opacity-100"
        style={{ fontFamily: 'monospace' }}
      >
        REALTIME DIAG
      </button>

      {open && (
        <div className="fixed inset-0 z-[9998] bg-black/70 flex items-end justify-end p-4">
          <div
            className="bg-gray-950 text-green-400 text-xs rounded-xl p-4 w-full max-w-lg max-h-[90vh] overflow-auto"
            style={{ fontFamily: 'monospace' }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-yellow-300">🔧 Realtime Diagnostics</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Status bar */}
            <div className="mb-3 flex gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded ${channelStatus === 'SUBSCRIBED' ? 'bg-green-800' : channelStatus === 'CHANNEL_ERROR' ? 'bg-red-800' : 'bg-gray-700'}`}>
                Channel: {channelStatus}
              </span>
              {tokenInfo && (
                <span className="bg-blue-900 px-2 py-0.5 rounded">
                  sub: {tokenInfo.sub?.slice(0, 8)}… role: {tokenInfo.role}
                </span>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <button onClick={runServerDiag} className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-white">Server diag</button>
              <button onClick={checkToken}    className="bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded text-white">Check JWT</button>
              <button onClick={startChannelTest} className="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-white">Subscribe</button>
              <button onClick={() => setLog([])} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-white">Clear</button>
            </div>

            {/* Server diag result */}
            {diagJson && (
              <details className="mb-3">
                <summary className="cursor-pointer text-yellow-300">Server diagnostic JSON</summary>
                <pre className="text-xs mt-1 overflow-auto max-h-40 text-gray-300">{JSON.stringify(diagJson, null, 2)}</pre>
              </details>
            )}

            {/* Event log */}
            <div className="space-y-0.5 max-h-60 overflow-auto">
              {log.map((l, i) => (
                <div key={i} className={l.level === 'error' ? 'text-red-400' : l.level === 'ok' ? 'text-green-300' : l.level === 'warn' ? 'text-yellow-300' : 'text-gray-400'}>
                  <span className="text-gray-600">[{l.ts}]</span> {l.msg}
                </div>
              ))}
              {log.length === 0 && <div className="text-gray-600">Лог пуст. Нажмите Server diag → Check JWT → Subscribe</div>}
            </div>

            <div className="mt-3 text-gray-500 text-[10px]">
              Конвертация: если события идут после Subscribe → Realtime работает. Если нет — смотри Server diag.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
