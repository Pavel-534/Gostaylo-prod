'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { hasPendingReferralClient } from '@/contexts/auth/auth-referral-handler'

/**
 * Stage 139.1 — follow-up after auth modal dismiss or when pending ref exists (catalog/PDP next stage).
 *
 * @param {{
 *   language: string
 *   ctaHref?: string
 *   visible?: boolean
 *   ambassadorUserId?: string | null
 *   autoFromPendingRef?: boolean
 *   className?: string
 * }} props
 */
export function ReferralBonusSavedBanner({
  language,
  ctaHref = '/listings',
  visible = false,
  ambassadorUserId = null,
  autoFromPendingRef = false,
  className = '',
}) {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  const isSelf =
    !!currentUser?.id &&
    !!ambassadorUserId &&
    String(currentUser.id).toLowerCase() === String(ambassadorUserId).toLowerCase()

  const hasPendingRef = autoFromPendingRef && hasPendingReferralClient()
  const shouldShow = !isSelf && !currentUser?.id && (visible || hasPendingRef)

  if (!shouldShow) return null

  return (
    <Card
      className={`rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand/10 to-white shadow-md ${className}`.trim()}
    >
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15">
            <Gift className="h-5 w-5 text-brand" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{t('stage139_followupTitle')}</p>
            <p className="text-sm text-slate-600 mt-0.5">{t('stage139_followupBody')}</p>
          </div>
        </div>
        <Button
          variant="brand"
          size="lg"
          className="w-full shrink-0 sm:w-auto min-h-12 font-semibold"
          onClick={() => router.push(ctaHref)}
        >
          <Search className="h-4 w-4 mr-2" />
          {t('stage139_followupCta')}
        </Button>
      </CardContent>
    </Card>
  )
}
