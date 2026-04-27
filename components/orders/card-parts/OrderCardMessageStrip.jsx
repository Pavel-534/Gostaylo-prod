'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

/**
 * Booking thread preview + quick open (replaces a duplicate «chat» chip in the action row when shown).
 * Pass **`lastMessagePreview`** when the list API enriches rows (see **`resolveBookingConversationPreview`**).
 */
export function OrderCardMessageStrip({
  conversationId,
  language,
  lastMessagePreview = null,
  /** When true, subtle highlight for unread-style emphasis (caller may derive from booking or inbox). */
  hasUnread = false,
}) {
  if (!conversationId) return null

  const href = `/messages/${encodeURIComponent(String(conversationId))}`

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
        hasUnread ? 'border-amber-200 bg-amber-50/80' : 'border-slate-200 bg-slate-50/90'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {getUIText('orderCard_chatThreadLabel', language)}
        </p>
        {lastMessagePreview ? (
          <p
            className={`text-sm mt-0.5 line-clamp-2 leading-snug ${
              hasUnread ? 'text-amber-950 font-medium' : 'text-slate-700'
            }`}
          >
            {lastMessagePreview}
          </p>
        ) : (
          <p className="text-sm text-slate-600 mt-0.5">{getUIText('orderCard_chatNoPreviewYet', language)}</p>
        )}
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 border-teal-200 text-teal-900 hover:bg-teal-50">
        <Link href={href}>
          <MessageSquare className="h-4 w-4 mr-2" aria-hidden />
          {getUIText('bookingCard_openChat', language)}
        </Link>
      </Button>
    </div>
  )
}
