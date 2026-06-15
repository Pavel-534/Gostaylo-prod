'use client'

import Link from 'next/link'
import { Gavel, MessageCircle, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { languageToNumberLocale } from '@/lib/currency.js'
import { cn } from '@/lib/utils'

function stripClass(tier) {
  switch (tier) {
    case 'calm':
      return 'border-emerald-200/90 bg-emerald-50/80 text-emerald-900'
    case 'warning':
      return 'border-orange-200 bg-orange-50 text-orange-950'
    case 'critical':
      return 'border-red-400 bg-red-50 text-red-900 animate-pulse'
    case 'mediation':
      return 'border-brand/30 bg-brand/5 text-brand-navy'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-800'
  }
}

function statusLabel(status, language) {
  const key = `booking.dispute_status_${String(status || '').toLowerCase()}`
  const t = getUIText(key, language)
  return t !== key ? t : String(status || '—')
}

function formatThb(n, language) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString(languageToNumberLocale(language), { maximumFractionDigits: 0 })}`
}

function resolveAmountLine(dispute, { isHosting, language }) {
  if (isHosting) {
    const hold = dispute?.partnerHoldThb ?? dispute?.partner_hold_thb
    if (Number(hold) > 0) return formatThb(hold, language)
    if (Number(dispute?.amountThb) > 0) return formatThb(dispute.amountThb, language)
    return null
  }
  if (dispute?.guestDisplayLabel) return dispute.guestDisplayLabel
  if (Number(dispute?.guestDisplayAmount) > 0 && dispute?.guestDisplayCurrency) {
    const n = Number(dispute.guestDisplayAmount)
    const cur = String(dispute.guestDisplayCurrency)
    const sym = cur === 'RUB' ? '₽' : cur === 'USD' ? '$' : cur === 'THB' ? '฿' : `${cur} `
    return `${sym}${n.toLocaleString(languageToNumberLocale(language), { maximumFractionDigits: cur === 'USD' ? 2 : 0 })}`
  }
  if (Number(dispute?.amountThb) > 0) return formatThb(dispute.amountThb, language)
  return null
}

/**
 * Информационный блок спора на карточке брони (гость / партнёр) и в чат-сайдбаре.
 */
export default function DisputeStatusWidget({
  dispute,
  language = 'ru',
  conversationId = null,
  slaCountdown = null,
  mediationCountdown = null,
  /** Stage 147 — already inside chat thread */
  hideChatLink = false,
  /** Stage 147 — compact sidebar variant */
  compact = false,
  /** Stage 147 — partner sees THB hold; guest sees payment currency */
  isHosting = false,
}) {
  if (!dispute?.id) return null

  const status = String(dispute.status || '').toUpperCase()
  const chatHref =
    !hideChatLink && conversationId ? `/messages/${encodeURIComponent(conversationId)}` : null
  const showSla =
    ['OPEN', 'IN_REVIEW'].includes(status) && slaCountdown && (slaCountdown.expired || slaCountdown.timeLabel)
  const showMediation =
    status === 'PENDING_MEDIATION' && mediationCountdown && (mediationCountdown.expired || mediationCountdown.timeLabel)

  let timerTier = 'neutral'
  let timerText = null
  if (showSla) {
    timerTier = slaCountdown.tier
    timerText = slaCountdown.expired
      ? getUIText('booking.sla_awaiting_admin', language)
      : getUIText('booking.sla_remaining', language).replace('{time}', slaCountdown.timeLabel)
  } else if (showMediation) {
    timerTier = 'mediation'
    timerText = mediationCountdown.expired
      ? getUIText('booking.dispute_mediation_ready', language)
      : getUIText('booking.dispute_mediation_wait', language).replace('{time}', mediationCountdown.timeLabel)
  }

  const reason =
    dispute.resolutionReason ||
    dispute.description ||
    (dispute.reasonCode ? String(dispute.reasonCode).replace(/_/g, ' ') : null)

  const amountLine = resolveAmountLine(dispute, { isHosting, language })

  return (
    <div
      className={cn(
        'rounded-2xl border border-amber-200/80 bg-amber-50/50 space-y-2',
        compact ? 'p-2.5' : 'p-3',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Gavel
          className={cn('shrink-0 text-amber-900 mt-0.5', compact ? 'h-4 w-4' : 'h-5 w-5')}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('font-semibold text-slate-900', compact ? 'text-xs' : 'text-sm')}>
              {getUIText('booking.dispute_widget_title', language)}
            </p>
            <span className="text-xs font-mono uppercase tracking-wide bg-white border border-amber-200 rounded-md px-1.5 py-0.5 text-amber-950">
              {statusLabel(status, language)}
            </span>
            {dispute.freezePayment ? (
              <span className="text-[10px] uppercase text-amber-800 font-medium">
                {getUIText('booking.dispute_frozen', language)}
              </span>
            ) : null}
          </div>
          {amountLine ? (
            <p className={cn('text-slate-700', compact ? 'text-[11px]' : 'text-xs')}>
              {getUIText('booking.dispute_amount_label', language)}:{' '}
              <span className="font-semibold tabular-nums">{amountLine}</span>
            </p>
          ) : null}
          {reason && !compact ? (
            <p className="text-xs text-slate-600 break-words line-clamp-3">{reason}</p>
          ) : null}
        </div>
      </div>

      {timerText ? (
        <div
          className={cn(
            'rounded-xl border font-medium flex items-center gap-2',
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
            stripClass(timerTier),
          )}
        >
          <Timer className="h-4 w-4 shrink-0" aria-hidden />
          <span>{timerText}</span>
        </div>
      ) : null}

      {chatHref ? (
        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto rounded-xl border-brand/30 text-brand-hover">
          <Link href={chatHref}>
            <MessageCircle className="h-4 w-4 mr-2" aria-hidden />
            {getUIText('booking.dispute_open_chat', language)}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
