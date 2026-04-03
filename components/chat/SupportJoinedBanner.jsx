'use client'

import { Headphones } from 'lucide-react'

/**
 * Premium glass banner for system_key support_joined (not a chat bubble).
 */
export function SupportJoinedBanner({ message, language = 'ru' }) {
  const isEn = language === 'en'
  const fallback = isEn
    ? 'Support has joined the conversation'
    : 'Поддержка присоединилась к диалогу'
  const text = (message?.message || message?.content || '').trim() || fallback

  return (
    <div
      className="w-full max-w-2xl rounded-2xl border border-white/40 bg-white/45 px-4 py-3 text-center shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-slate-600/30 dark:bg-slate-900/35"
      role="status"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-700 ring-1 ring-teal-600/20 dark:text-teal-300">
          <Headphones className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-medium leading-snug tracking-tight text-slate-700 dark:text-slate-200">
          {text}
        </p>
      </div>
    </div>
  )
}
