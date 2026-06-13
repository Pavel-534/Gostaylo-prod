'use client'

import { useMemo } from 'react'
import { Banknote, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

function stageIcon(stage) {
  if (stage === 'paid') return CheckCircle2
  if (stage === 'registry_sent') return Banknote
  if (stage === 'rejected' || stage === 'expired' || stage === 'failed') return Clock
  return Loader2
}

function stageTone(stage) {
  if (stage === 'paid') return 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
  if (stage === 'registry_sent') return 'border-brand/25 bg-brand/5 text-brand-hover'
  if (stage === 'rejected' || stage === 'expired' || stage === 'failed')
    return 'border-rose-200 bg-rose-50/80 text-rose-950'
  return 'border-amber-200 bg-amber-50/80 text-amber-950'
}

/**
 * Stage 132.3 — in-app status for latest referral payout pipeline step.
 */
export function ReferralWithdrawalStatusBanner({ walletData, locale = 'ru-RU', className = '' }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  const payout = walletData?.payout || {}
  const timeline = walletData?.referralPayoutTimeline?.latest
  const notice = walletData?.referralWithdrawalNotice
  const requested = payout?.referralWithdrawalStatus === 'withdrawable_referral'

  if (!requested && !timeline?.stage && !notice?.stage) return null

  let stage = timeline?.stage
  let messageKey = stage ? `stage1323_withdrawStage_${stage}` : null
  let ctx = {}

  if (requested && (!stage || stage === 'approved')) {
    stage = 'requested'
    messageKey = 'stage1323_withdrawStage_requested'
  }

  if (!messageKey && notice?.stage) {
    stage = notice.stage
    messageKey = `stage1323_withdrawStage_${stage}`
  }

  if (!messageKey) return null

  const netRub = Number(timeline?.netRub ?? notice?.netRub)
  if (Number.isFinite(netRub) && netRub > 0) {
    ctx = {
      netRub: netRub.toLocaleString(locale, { maximumFractionDigits: 0 }),
    }
    const amountKey = `${messageKey}Amount`
    const amountText = t(amountKey, ctx)
    if (amountText && amountText !== amountKey) {
      messageKey = amountKey
    }
  }

  const Icon = stageIcon(stage)
  const body = t(messageKey, ctx)

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 flex items-start gap-2.5 ${stageTone(stage)} ${className}`}
      role="status"
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <p className="text-xs sm:text-sm leading-relaxed">{body}</p>
    </div>
  )
}

export default ReferralWithdrawalStatusBanner
