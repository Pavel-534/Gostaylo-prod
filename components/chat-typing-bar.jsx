'use client'

/**
 * Строка «Печатает…» под шапкой чата (WhatsApp-style).
 */
export function ChatTypingBar({ name }) {
  if (!name) return null
  return (
    <div className="px-4 py-1.5 text-xs text-slate-600 bg-slate-50/95 border-b border-slate-100 animate-pulse">
      <span className="font-medium text-slate-800">{name}</span>
      <span className="text-slate-500"> печатает…</span>
    </div>
  )
}
