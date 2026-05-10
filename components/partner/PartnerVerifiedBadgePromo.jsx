'use client'

/**
 * Stage 88.0 — промо верификации платформы (**`profiles.is_verified`**): «Verified» на карте/в каталоге.
 * Данные: **`GET /api/v2/auth/me`** (тот же контур, что настройки кабинета).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

/**
 * @param {{ language?: string }} props
 */
export function PartnerVerifiedBadgePromo({ language = 'ru' }) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || !data.success || !data.user) {
          setShow(false)
          return
        }
        const u = data.user
        const verified =
          u.is_verified === true ||
          u.isVerified === true ||
          String(u.verification_status || '').toUpperCase() === 'VERIFIED'
        setShow(!verified)
      } catch {
        if (!cancelled) setShow(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading || !show) return null

  return (
    <Card className="border border-teal-200/80 bg-gradient-to-r from-teal-50 via-white to-emerald-50/90 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {getUIText('partnerVerifiedPromo_title', language)}
            </p>
            <p className="text-xs leading-snug text-slate-600 sm:text-sm">
              {getUIText('partnerVerifiedPromo_body', language)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button asChild size="sm" className="bg-teal-600 text-white hover:bg-teal-700">
            <Link href="/partner/settings?tab=verification">{getUIText('partnerVerifiedPromo_cta', language)}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/help">{getUIText('partnerVerifiedPromo_help', language)}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
