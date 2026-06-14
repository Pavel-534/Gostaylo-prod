'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 143.1 — мост referral → partner supply для PARTNER без объявления.
 * @param {{ language?: string }} props
 */
export function ReferralPartnerSupplyStrip({ language = 'ru' }) {
  const { user } = useAuth()
  const t = useMemo(() => (key) => getUIText(key, language), [language])
  const [loading, setLoading] = useState(true)
  const [hasListing, setHasListing] = useState(true)

  const isPartner = String(user?.role || '').toUpperCase() === 'PARTNER'

  useEffect(() => {
    if (!isPartner) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/partner/onboarding-status', {
          credentials: 'include',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && json?.success && json.data) {
          setHasListing(Boolean(json.data.hasListing))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isPartner])

  if (!isPartner || loading || hasListing) return null

  return (
    <div
      className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 sm:p-5"
      data-testid="referral-partner-supply-strip"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Briefcase className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{t('stage1431_referralPartnerBridgeTitle')}</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-1">
              {t('stage1431_referralPartnerBridgeBody')}
            </p>
          </div>
        </div>
        <Button asChild variant="brand" className="shrink-0 w-full sm:w-auto">
          <Link href="/partner/listings/new">{t('stage1431_referralPartnerBridgeCta')}</Link>
        </Button>
      </div>
    </div>
  )
}
