'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 132.2 — honest referral welcome for invited hosts before first completed booking.
 */
export function PartnerReferralWelcomeStrip() {
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

  const body = String(t('stage1322_referralWelcomeBody')).replace(/\{name\}/g, ctx.referredBy.displayName)

  return (
    <div className="rounded-xl border border-brand/25 bg-gradient-to-r from-brand/5 via-white to-emerald-50/80 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <UserPlus className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-slate-800 leading-relaxed">{body}</p>
        </div>
        <Button asChild variant="brand" className="shrink-0 w-full sm:w-auto">
          <Link href="/partner/listings/new">{t('stage1322_referralWelcomeCta')}</Link>
        </Button>
      </div>
    </div>
  )
}
