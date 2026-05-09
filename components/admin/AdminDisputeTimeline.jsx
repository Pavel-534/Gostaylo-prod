'use client'

import { useMemo } from 'react'
import {
  Wallet,
  Paperclip,
  MessageCircle,
  Shield,
  Gavel,
  Bot,
  Scale,
  RefreshCw,
  Link2,
} from 'lucide-react'
import { ProxiedImage } from '@/components/proxied-image'

function iconForEvent(ev) {
  const t = String(ev.eventType || '').toUpperCase()
  const role = String(ev.actorRole || '').toUpperCase()
  if (t.includes('EVIDENCE')) return Paperclip
  if (t.includes('FREEZE') || t.includes('FORCE_REFUND')) return Wallet
  if (t.includes('PENALTY')) return Shield
  if (t.includes('CLOSED') || t.includes('CLOSE')) return Gavel
  if (t.includes('AUTO_') || role === 'SYSTEM') return Bot
  if (t.includes('MEDIATION')) return MessageCircle
  if (t.includes('IN_REVIEW') || t.includes('STATUS_CHANGE')) return RefreshCw
  return Scale
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function isVideoHref(href) {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(String(href || ''))
}

/**
 * Вертикальный таймлайн спора (dispute_events + блок вложений с signed URL).
 */
export default function AdminDisputeTimeline({
  events = [],
  evidenceItems = [],
  disputeCreatedAt,
  conversationId,
}) {
  const rows = useMemo(() => {
    const out = events.map((e) => ({ kind: 'event', at: e.createdAt, event: e }))
    if (evidenceItems.length > 0 && disputeCreatedAt) {
      out.push({ kind: 'attachments', at: disputeCreatedAt, items: evidenceItems })
    }
    out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    return out
  }, [events, evidenceItems, disputeCreatedAt])

  if (!rows.length) {
    return (
      <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4 space-y-1">
        <p>Событий журнала пока нет (примените миграцию 044 и выполните действие по кейсу — записи появятся).</p>
        {conversationId ? (
          <p className="text-xs flex items-center gap-1 text-slate-600">
            <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Переписку смотрите в блоке чата ниже.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
        <p className="text-sm font-semibold text-slate-900">История кейса</p>
        {conversationId ? (
          <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Живая переписка — блок чата ниже
          </span>
        ) : null}
      </div>
      <ul className="relative space-y-0 pl-0">
        <li className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />

        {rows.map((row, idx) => {
          if (row.kind === 'attachments') {
            return (
              <li key={`att-${idx}`} className="relative flex gap-3 pb-4 pl-1">
                <div className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm">
                  <Paperclip className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-900">Вложения при открытии</span>
                    <span className="text-xs text-slate-500">{formatWhen(row.at)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 mb-2">Подписанные URL (активны ограниченное время)</p>
                  <div className="flex flex-wrap gap-2">
                    {row.items.map(({ key, href, imgSrc }) =>
                      href && isVideoHref(href) ? (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-teal-800 hover:bg-teal-50"
                        >
                          <Link2 className="h-3.5 w-3.5" aria-hidden />
                          Видео
                        </a>
                      ) : (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block h-16 w-16 rounded-md overflow-hidden border border-slate-200 bg-white shrink-0"
                        >
                          <ProxiedImage src={imgSrc || href} alt="" fill className="object-cover" sizes="64px" />
                        </a>
                      ),
                    )}
                  </div>
                </div>
              </li>
            )
          }

          const ev = row.event
          const Icon = iconForEvent(ev)
          const label = String(ev.eventType || '').replace(/_/g, ' ')
          const statusLine = [ev.fromStatus, ev.toStatus].filter(Boolean).join(' → ')

          return (
            <li key={ev.id || `${idx}-${row.at}`} className="relative flex gap-3 pb-4 pl-1">
              <div className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white bg-teal-50 text-teal-800 shadow-sm">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 border-b border-slate-100/80 pb-3 last:border-0">
                <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
                  <span className="text-sm font-medium text-slate-900 capitalize">{label}</span>
                  <span className="text-xs font-mono text-slate-500">{formatWhen(ev.createdAt)}</span>
                  {ev.actorRole ? (
                    <span className="text-[10px] uppercase tracking-wide bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded">
                      {ev.actorRole}
                    </span>
                  ) : null}
                </div>
                {statusLine ? (
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="text-slate-400">Статус:</span> {statusLine}
                  </p>
                ) : null}
                {ev.reason ? (
                  <p className="text-sm text-slate-800 mt-1.5 whitespace-pre-wrap break-words">{ev.reason}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
