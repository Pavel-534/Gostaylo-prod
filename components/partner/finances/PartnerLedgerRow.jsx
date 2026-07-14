'use client'

import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { PartnerHostLedgerAmountCell } from '@/components/partner/finances/partner-host-amount-display'
import {
  mapLedgerDescription,
  mapLedgerEventType,
  mapLedgerSide,
} from '@/lib/partner/ledger-display-labels'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * Compact ledger row — tap opens detail drawer (Stage 186.2).
 */
export function PartnerLedgerRow({ row, language = 'ru', selected = false, showArchiveBadge = false, onOpen }) {
  const t = (key) => getUIText(key, language)
  const eventLabel = mapLedgerEventType(row.eventType, t)
  const sideLabel = mapLedgerSide(row.side, t)
  const noteLabel = mapLedgerDescription(row.description, t)
  const createdAt = row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'

  return (
    <button
      type="button"
      onClick={() => onOpen?.(row)}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border bg-white p-3 text-left min-h-[44px] transition-colors active:bg-slate-50',
        selected ? 'border-brand ring-2 ring-brand/25 shadow-md' : 'border-slate-200 shadow-sm hover:shadow-md',
      )}
      aria-label={getUIText('partnerFinances_ledgerOpenDetails', language)}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{eventLabel}</p>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {showArchiveBadge ? (
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                {t('partnerFinances_ledgerArchiveBadgeShort')}
              </span>
            ) : null}
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{createdAt}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs text-slate-600">
            {t('partnerFinances_ledgerColSide')}: {sideLabel}
          </span>
          <PartnerHostLedgerAmountCell thb={row.amountThb ?? 0} />
        </div>
        {row.bookingId ? (
          <p className="text-xs font-mono text-brand-hover truncate">
            {t('partnerFinances_ledgerColBooking')}: {String(row.bookingId).slice(0, 10)}…
          </p>
        ) : null}
        {noteLabel ? <p className="text-xs text-slate-500 line-clamp-2">{noteLabel}</p> : null}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" aria-hidden />
    </button>
  )
}
