'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 132.0 / 132.2 — actionable payout blockers from `wallet/me.payout.blockerDetails`.
 */
export function ReferralPayoutBlockers({ blockerDetails = [], className = '', compact = false }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const rows = Array.isArray(blockerDetails) ? blockerDetails.filter((r) => r?.code) : []
  if (!rows.length) return null

  function resolveMessage(row) {
    if (row.messageKey) {
      const localized = t(row.messageKey, row.messageCtx || {})
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
              <p className="text-sm text-amber-950 leading-relaxed">{resolveMessage(row)}</p>
              {!compact ? <p className="text-[11px] text-amber-900/60 mt-1 font-mono">{row.code}</p> : null}
            </div>
          </div>
          {row.actionHref && resolveActionLabel(row) ? (
            <Button asChild variant="outline" size="sm" className="shrink-0 border-amber-300 bg-white hover:bg-amber-50">
              <Link href={row.actionHref}>{resolveActionLabel(row)}</Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default ReferralPayoutBlockers
