'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'

function isRuPayoutSetupHref(href) {
  const h = String(href || '')
  return h.includes('action=payout-setup') || h.includes('#ru-payout-profile')
}

function focusRuPayoutProfile() {
  if (typeof document === 'undefined') return false
  const el = document.getElementById('ru-payout-profile')
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const input = el.querySelector?.('input,button,[href]')
  if (input && typeof input.focus === 'function') {
    try {
      input.focus({ preventScroll: true })
    } catch {
      input.focus()
    }
  }
  return true
}

/**
 * Stage 132.0 / 132.2 — actionable payout blockers from `wallet/me.payout.blockerDetails`.
 * Stage 131.A5.D — RU setup CTA scrolls to form on-wallet instead of bouncing to top.
 */
export function ReferralPayoutBlockers({ blockerDetails = [], className = '', compact = false }) {
  const router = useRouter()
  const pathname = usePathname()
  const { language } = useI18n()
  const { formatMinPayoutThreshold } = useReferralLedgerDisplay()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const rows = Array.isArray(blockerDetails) ? blockerDetails.filter((r) => r?.code) : []
  if (!rows.length) return null

  function resolveMessage(row) {
    const ctx = row.messageCtx && typeof row.messageCtx === 'object' ? row.messageCtx : {}
    if (row.messageKey === 'stage1322_blockerBelowMin' || row.code === 'BELOW_MIN_PAYOUT') {
      const minThb = Number(ctx.minPayoutThb ?? ctx.minThb ?? 1000)
      return t('stage1322_blockerBelowMin', { minAmount: formatMinPayoutThreshold(minThb) })
    }
    if (row.messageKey) {
      const localized = t(row.messageKey, ctx)
      if (localized && localized !== row.messageKey) return localized
    }
    return row.messageRu || ''
  }

  function resolveActionLabel(row) {
    if (row.actionLabelKey) {
      const localized = t(row.actionLabelKey)
      if (localized && localized !== row.actionLabelKey) return localized
    }
    return row.actionLabel || ''
  }

  function handleRuSetupClick(e, href) {
    if (!isRuPayoutSetupHref(href)) return
    const onWallet = String(pathname || '').startsWith('/profile/wallet')
    if (onWallet && focusRuPayoutProfile()) {
      e.preventDefault()
      return
    }
    if (onWallet) {
      e.preventDefault()
      // Form may mount on next paint after forceShowProfile — retry briefly.
      window.setTimeout(() => {
        if (!focusRuPayoutProfile()) {
          router.replace('/profile/wallet?action=payout-setup')
        }
      }, 80)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {!compact ? <p className="text-sm font-medium text-slate-800">{t('stage1322_blockersTitle')}</p> : null}
      {rows.map((row) => (
        <div
          key={row.code}
          className="rounded-xl border border-amber-200/90 bg-amber-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
        >
          <div className="flex gap-3 min-w-0">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm text-amber-950 leading-relaxed break-words">{resolveMessage(row)}</p>
            </div>
          </div>
          {row.actionHref && resolveActionLabel(row) ? (
            <Button asChild variant="outline" size="sm" className="shrink-0 border-amber-300 bg-white hover:bg-amber-50 min-h-[44px]">
              <Link href={row.actionHref} onClick={(e) => handleRuSetupClick(e, row.actionHref)}>
                {resolveActionLabel(row)}
              </Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default ReferralPayoutBlockers
