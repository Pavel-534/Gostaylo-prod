'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { UserPlus, Gift, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver'
import { useEffect, useMemo } from 'react'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_INSET_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

const STEPS = [
  { key: 'stage91_loyaltyStep1Title', bodyKey: 'stage91_loyaltyStep1Body', Icon: UserPlus, tone: 'bg-brand' },
  { key: 'stage91_loyaltyStep2Title', bodyKey: 'stage91_loyaltyStep2Body', Icon: Gift, tone: 'bg-emerald-600' },
  { key: 'stage91_loyaltyStep3Title', bodyKey: 'stage91_loyaltyStep3Body', Icon: Share2, tone: 'bg-slate-800' },
]

function isZeroOrPlaceholderDisplay(formatted) {
  const s = String(formatted || '').trim()
  if (!s || s === '…') return true
  return /(?:₽|RUB|\$|€|£|¥|฿)\s*0(?:[.,]0+)?\s*$|^0(?:[.,]0+)?\s*(?:₽|RUB|\$|€|£|¥|฿)?$/i.test(s)
}

/**
 * @param {{ welcomeBonusThb: number, brandDisplayName: string }} props
 */
export function AboutLoyaltyClient({ welcomeBonusThb, brandDisplayName }) {
  const searchParams = useSearchParams()
  const { language, setLanguage } = useI18n()
  const { isAuthenticated } = useAuth()
  const { formatThbAsDisplay, fxReady } = useReferralLedgerDisplay()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  useEffect(() => {
    const raw = searchParams?.get('lang')
    if (raw == null || raw === '') return
    const norm = normalizeUiLocaleCode(raw)
    if (norm && norm !== language) setLanguage(norm)
  }, [searchParams, language, setLanguage])

  const welcomeAmount = formatThbAsDisplay(welcomeBonusThb)
  const showWelcomeAmount =
    Number(welcomeBonusThb) > 0 &&
    !isZeroOrPlaceholderDisplay(welcomeAmount) &&
    (fxReady || String(welcomeAmount).includes('฿'))
  const step2AmountCtx = useMemo(() => ({ welcomeAmount }), [welcomeAmount])

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-hover">{brandDisplayName}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t('stage91_loyaltyPageTitle')}</h1>
          <p className="text-lg text-slate-600 leading-relaxed">{t('stage91_loyaltyPageLead')}</p>
          <p
            className={cn(
              MOBILE_FLAT_INSET_CLASS,
              'text-sm text-slate-600 leading-relaxed max-w-xl mx-auto sm:border-brand/20 sm:bg-brand/10',
            )}
          >
            {t('stage91_loyaltyWithRefHint')}
          </p>
        </header>

        <ol className="space-y-4">
          {STEPS.map((step, idx) => {
            const Icon = step.Icon
            const isStep2 = step.key === 'stage91_loyaltyStep2Title'
            return (
              <li key={step.key}>
                <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'overflow-hidden')}>
                  <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'p-0 sm:p-0')}>
                    <div className="flex gap-4 max-sm:py-2 sm:p-6">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${step.tone}`}
                        aria-hidden
                      >
                        <Icon className="h-6 w-6" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-slate-400 tabular-nums">0{idx + 1}</p>
                        <h2 className="text-lg font-semibold text-slate-900 break-words">{t(step.key)}</h2>
                        <p className="text-sm text-slate-600 leading-relaxed break-words">{t(step.bodyKey)}</p>
                        {isStep2 && showWelcomeAmount ? (
                          <p className="text-sm font-medium text-brand break-words">
                            {t('stage91_loyaltyStep2AmountLine', step2AmountCtx)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild className="bg-brand hover:bg-brand-hover rounded-xl">
            <Link href="/?login=true">{t('stage91_loyaltyCtaRegister')}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl border-slate-300">
            <Link href={isAuthenticated ? '/profile/referral' : '/?login=true'}>{t('stage91_loyaltyCtaInvite')}</Link>
          </Button>
        </div>

        <nav
          className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-500 border-t border-slate-200 pt-6"
          aria-label="Legal"
        >
          <Link href="/terms/" className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800">
            {t('terms')}
          </Link>
          <Link href="/legal/privacy/" className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800">
            {t('privacyPolicy')}
          </Link>
        </nav>

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800">
            ← {t('stage91_loyaltyBackHome')}
          </Link>
        </p>
      </div>
    </div>
  )
}
