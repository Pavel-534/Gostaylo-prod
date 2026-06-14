'use client'

import { useMemo } from 'react'
import { Banknote, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

function stageIcon(stage) {
  if (stage === 'paid') return CheckCircle2
  if (stage === 'registry_sent') return Banknote
  if (stage === 'rejected' || stage === 'expired') return Info
  if (stage === 'failed') return XCircle
  return Loader2
}

function stageTone(stage) {
  if (stage === 'paid') return 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
  if (stage === 'registry_sent') return 'border-brand/25 bg-brand/5 text-brand-hover'
  if (stage === 'rejected' || stage === 'expired')
    return 'border-slate-200 bg-slate-50/90 text-slate-800'
  if (stage === 'failed') return 'border-rose-200 bg-rose-50/80 text-rose-950'
  return 'border-amber-200 bg-amber-50/80 text-amber-950'
}

/**
 * Stage 132.3 / 136 — in-app status for latest referral payout pipeline step.
 */
export function ReferralWithdrawalStatusBanner({
  walletData,
  locale = 'ru-RU',
  className = '',
  onRetry = null,
  retryLoading = false,
}) {
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
  const rejectReason =
    stage === 'rejected' && notice?.reason ? String(notice.reason).trim() : ''
  const showRetry =
    typeof onRetry === 'function' && (stage === 'rejected' || stage === 'expired') && !requested

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 flex items-start gap-2.5 ${stageTone(stage)} ${className}`}
      role="status"
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs sm:text-sm leading-relaxed">{body}</p>
        {rejectReason ? (
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('stage137_withdrawRejectReason', { reason: rejectReason }) !== 'stage137_withdrawRejectReason'
              ? t('stage137_withdrawRejectReason', { reason: rejectReason })
              : `Причина: ${rejectReason}`}
          </p>
        ) : null}
        {showRetry ? (
          <button
            type="button"
            onClick={() => void onRetry()}
            disabled={retryLoading}
            className="text-xs sm:text-sm font-medium text-brand hover:text-brand-hover underline underline-offset-2 disabled:opacity-50"
          >
            {retryLoading ? t('stage1323_withdrawRetryLoading') : t('stage1323_withdrawRetryCta')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default ReferralWithdrawalStatusBanner
