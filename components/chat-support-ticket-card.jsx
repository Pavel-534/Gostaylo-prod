'use client'

import { LifeBuoy } from 'lucide-react'
import { SUPPORT_REASONS, SUPPORT_DISPUTE_KINDS } from '@/lib/support-request-options'

export function ChatSupportTicketCard({ ticket, senderName, language = 'ru' }) {
  if (!ticket?.category || !ticket?.disputeType) return null
  const isRu = language !== 'en'
  const reason = SUPPORT_REASONS.find((x) => x.slug === ticket.category)
  const dispute = SUPPORT_DISPUTE_KINDS.find((x) => x.slug === ticket.disputeType)
  const reasonLabel = reason ? (isRu ? reason.labelRu : reason.labelEn) : ticket.category
  const disputeLabel = dispute ? (isRu ? dispute.labelRu : dispute.labelEn) : ticket.disputeType
  const details = (ticket.details || '').trim()

  return (
    <div className="rounded-xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-50 to-orange-50/90 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-amber-950 font-semibold text-sm mb-2">
        <LifeBuoy className="h-4 w-4 shrink-0" />
        {isRu ? 'Обращение в поддержку' : 'Support request'}
      </div>
      <dl className="space-y-1.5 text-sm text-slate-800">
        <div>
          <dt className="text-xs font-medium text-amber-900/80 uppercase tracking-wide">
            {isRu ? 'Причина' : 'Reason'}
          </dt>
          <dd>{reasonLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-amber-900/80 uppercase tracking-wide">
            {isRu ? 'Суть' : 'Issue'}
          </dt>
          <dd>{disputeLabel}</dd>
        </div>
        {details ? (
          <div>
            <dt className="text-xs font-medium text-amber-900/80 uppercase tracking-wide">
              {isRu ? 'Комментарий' : 'Details'}
            </dt>
            <dd className="whitespace-pre-wrap break-words">{details}</dd>
          </div>
        ) : null}
        {senderName ? (
          <p className="text-xs text-slate-500 pt-1 border-t border-amber-200/80 mt-2">
            {isRu ? 'От: ' : 'From: '}
            {senderName}
          </p>
        ) : null}
      </dl>
    </div>
  )
}
