'use client'

import { Headphones } from 'lucide-react'
import { resolveAnnouncementText } from '@/lib/booking-chat-copy.js'

/**
 * Premium glass banner for system_key support_joined (not a chat bubble).
 */
export function SupportJoinedBanner({ message, language = 'ru' }) {
  const meta = message?.metadata || {}
  const copies = meta?.announcement_title
    ? {
        ru: { title: meta.announcement_title, body: meta.announcement_body },
        en: { title: meta.announcement_title_en, body: meta.announcement_body_en },
        zh: { title: meta.announcement_title_zh, body: meta.announcement_body_zh },
        th: { title: meta.announcement_title_th, body: meta.announcement_body_th },
      }
    : null

  const fromMeta = copies ? resolveAnnouncementText(copies, language) : null
  const isEn = language === 'en'
  const fallback = isEn
    ? 'Support has joined the conversation'
    : 'Поддержка присоединилась к диалогу'
  const text =
    fromMeta?.body?.trim() ||
    (message?.message || message?.content || '').trim() ||
    fallback

  return (
    <div
      className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
      role="status"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-hover ring-1 ring-slate-200">
          <Headphones className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-medium leading-snug tracking-tight text-slate-700">
          {text}
        </p>
      </div>
    </div>
  )
}
