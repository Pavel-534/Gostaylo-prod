'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock3, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { formatPartnerPayoutThawDate } from '@/lib/orders/unified-order-card-model'
import { getHostMoneyStage } from '@/lib/booking/host-money-stage'

const TONES = {
  protected: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-white',
  releasing: 'border-sky-200/80 bg-gradient-to-br from-sky-50/85 via-white to-white',
  ready: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-white to-white',
}

function storageKey(bookingId) {
  const id = String(bookingId || '').trim()
  return id ? `host_next_steps_dismissed_${id}` : null
}

function iconForStage(stage) {
  if (stage === 'protected') return CheckCircle2
  if (stage === 'releasing') return Clock3
  return Wallet
}

/**
 * Host-focused money helper (PAID_ESCROW → THAW_HOLD → READY_FOR_PAYOUT).
 */
export function HostBookingNextStepsCard({
  booking = null,
  bookingId = null,
  status = null,
  language = 'ru',
  className,
  compact = false,
  surface = 'my_bookings',
}) {
  const key = storageKey(bookingId || booking?.id)
  const stageMeta = getHostMoneyStage(status, language, booking)
  const stage = stageMeta?.stage || null
  const [dismissedStage, setDismissedStage] = useState(null)

  useEffect(() => {
    if (!key) return
    try {
      setDismissedStage(localStorage.getItem(key))
    } catch {
      setDismissedStage(null)
    }
  }, [key, stage])

  if (!stage || !TONES[stage]) return null
  if (dismissedStage === stage) return null

  const thawDate = formatPartnerPayoutThawDate(booking, language)
  const Icon = iconForStage(stage)
  const isReady = stage === 'ready'
  const messageKey =
    stage === 'protected'
      ? 'hostNextSteps_protected'
      : stage === 'releasing'
        ? 'hostNextSteps_releasing'
        : 'hostNextSteps_ready'
  const message = getUIText(messageKey, language).replace('{{date}}', thawDate)

  function dismiss() {
    setDismissedStage(stage)
    if (!key) return
    try {
      localStorage.setItem(key, stage)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm',
        TONES[stage],
        compact ? 'p-3' : 'p-4',
        className,
      )}
      data-testid="host-booking-next-steps"
      data-surface={surface}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn('font-semibold text-slate-900', compact ? 'text-sm' : 'text-base')}>
            {getUIText('hostNextSteps_title', language)}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          {isReady ? (
            <div className="pt-0.5">
              <Button asChild variant="brand" size="sm">
                <Link href="/partner/finances">{getUIText('hostNextSteps_openFinances', language)}</Link>
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-500 hover:text-slate-700"
            onClick={dismiss}
          >
            {getUIText('hostNextSteps_dismiss', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}

