'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 132.2 Sprint 3 — compact mentor context on listing creation wizard.
 */
export function PartnerReferralWizardBanner({ className = '' }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const [ctx, setCtx] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/partner/referral-context', { cache: 'no-store' })
        if (!res.ok) return
        const j = await res.json().catch(() => ({}))
        if (!cancelled && j?.success) setCtx(j.data || null)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null
  if (!ctx?.directReferrerId || ctx?.hostActivationCompleted) return null
  if (!ctx?.referredBy?.displayName) return null

  const body = String(t('stage1322_wizardBannerBody')).replace(/\{name\}/g, ctx.referredBy.displayName)

  return (
    <div
      className={`rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5 sm:px-4 sm:py-3 ${className}`}
      role="note"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Sparkles className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
