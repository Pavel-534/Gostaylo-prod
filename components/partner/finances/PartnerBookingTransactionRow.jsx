'use client'

import { ChevronRight, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
import { PartnerBookingIncomeKindBadge } from '@/components/partner/finances/PartnerBookingIncomeKindBadge'
import { PartnerBookingPayoutPreviewLine } from '@/components/partner/finances/PartnerBookingPayoutPreviewLine'
import { resolveBookingStatusBadge } from '@/components/partner/finances/partner-finances-shared'
import { getHostMoneyStage } from '@/lib/booking/host-money-stage'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

function BookingStatusInline({ booking, t, language }) {
  const st = resolveBookingStatusBadge(booking, { t })
  const moneyStage = getHostMoneyStage(st.uiStatus, language, booking)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={`text-xs ${st.badgeClass}`} title={moneyStage?.eta || st.dbStatus}>
        {st.label}
      </Badge>
      {moneyStage?.eta ? (
        <span className="text-xs text-slate-600 leading-snug">{moneyStage.eta}</span>
      ) : null}
    </div>
  )
}

/**
 * Tap-friendly booking transaction card for mobile (< md) — Stage 186.2c.
 */
export function PartnerBookingTransactionRow({
  booking,
  row,
  language = 'ru',
  t,
  hasPayoutProfile,
  payoutPreviewBatchLoading,
  selected = false,
  onOpenSnapshot,
}) {
  const canOpen = !!booking.financial_snapshot && !!onOpenSnapshot
  const openLabel = getUIText('partnerFinances_rowOpenDetails', language)

  const inner = (
    <>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start gap-2 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 break-words min-w-0 flex-1 leading-snug">
            {row.listingTitle}
          </h4>
          <PartnerBookingIncomeKindBadge
            categorySlug={booking.financial_snapshot?.category_slug}
            t={t}
          />
        </div>
        <BookingStatusInline booking={booking} t={t} language={language} />
        <p className="text-xs text-slate-600 break-words">
          {t('guest')}: {row.guestName}
        </p>
        <p className="text-xs text-slate-500">{row.dateRange}</p>
        <div className="grid grid-cols-1 gap-1.5 text-xs pt-1 border-t border-slate-200">
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-500 shrink-0">{t('partnerFinances_colMobileGross')}</span>
            <span className="tabular-nums text-right break-all">
              <PartnerHostLedgerAmount thb={row.gross} />
            </span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-500 shrink-0">{t('partnerFinances_colMobileBankFee')}</span>
            <span className="tabular-nums text-red-700 text-right break-all">
              −<PartnerHostLedgerAmount thb={row.fee} />
            </span>
          </div>
          <div className="flex justify-between gap-2 font-semibold min-w-0">
            <span className="text-slate-700 shrink-0">{t('partnerFinances_colMobileFinal')}</span>
            <span className="tabular-nums text-emerald-800 text-right break-all">
              <PartnerHostLedgerAmount thb={row.net} />
            </span>
          </div>
        </div>
        {hasPayoutProfile ? (
          <PartnerBookingPayoutPreviewLine
            t={t}
            preview={row.payoutPreview}
            loading={payoutPreviewBatchLoading}
          />
        ) : null}
        {canOpen ? (
          <p className="text-xs text-brand-hover flex items-center gap-1 pt-0.5">
            <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {openLabel}
          </p>
        ) : null}
      </div>
      {canOpen ? (
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" aria-hidden />
      ) : null}
    </>
  )

  if (!canOpen) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm text-sm min-w-0">
        {inner}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpenSnapshot(booking)}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border bg-white p-3 text-left min-h-[44px] transition-colors active:bg-slate-50',
        selected ? 'border-brand ring-2 ring-brand/25 shadow-md' : 'border-slate-200 shadow-sm hover:shadow-md',
      )}
      aria-label={openLabel}
    >
      {inner}
    </button>
  )
}
