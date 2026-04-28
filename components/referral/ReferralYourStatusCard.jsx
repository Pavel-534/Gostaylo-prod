'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, Medal, Smartphone } from 'lucide-react'
import { BADGE_PROGRESSION_ORDER } from '@/lib/referral/referral-badges'
import { cn } from '@/lib/utils'
import { getSiteDisplayName } from '@/lib/site-url'

const MEDAL_ROW_CN = {
  fast_start: 'border-amber-300 bg-amber-50 text-amber-950',
  network_builder: 'border-teal-300 bg-teal-50 text-teal-950',
  top10_monthly: 'border-violet-300 bg-violet-50 text-violet-950',
}

/**
 * Единая карточка «Ваш статус»: прогресс по tier (SSOT `tierProgressPercent`) + медали за бейджи.
 */
export function ReferralYourStatusCard({
  t,
  locale,
  ambassador,
  badgesEarned = [],
  statusSubtitle,
  brandName = '',
  displayName = '',
  /** Подсказка SSOT (бат / конвертация) — Stage 76.1 */
  ledgerFootnote = '',
}) {
  const amb = ambassador
  const shareCardRef = useRef(null)
  const [shareBusy, setShareBusy] = useState(false)

  const earned = Array.isArray(badgesEarned) ? badgesEarned.map((id) => String(id)) : []
  const orderedMedals = BADGE_PROGRESSION_ORDER.filter((id) => earned.includes(id))

  const brandChip = useMemo(() => {
    const b = String(brandName || '').trim()
    return b || getSiteDisplayName()
  }, [brandName])

  const heroName = String(displayName || '').trim() || 'Ambassador'

  const handleShareSuccess = useCallback(async () => {
    if (!shareCardRef.current || typeof window === 'undefined') return
    setShareBusy(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#f0fdfa',
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `gostaylo-status-${Date.now()}.png`
      a.click()
    } catch (e) {
      console.warn('[ReferralYourStatusCard] share export:', e?.message || e)
    } finally {
      setShareBusy(false)
    }
  }, [])

  if (!amb) return null

  return (
    <>
      <div
        ref={shareCardRef}
        className="fixed left-[-9999px] top-0 z-0 flex h-[640px] w-[360px] flex-col overflow-hidden rounded-none bg-gradient-to-b from-teal-50 via-white to-amber-50/90 text-slate-900 shadow-none"
        aria-hidden
      >
        <div className="pointer-events-none flex flex-1 flex-col px-6 pt-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white shadow-sm">
            A
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">{brandChip}</p>
          <p className="mt-6 px-1 text-[17px] font-bold leading-snug text-slate-900">{heroName}</p>
          <p className="mt-2 text-[13px] font-medium text-slate-700">
            {amb.currentTier?.name || t('stage73_tierFallbackBeginner')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 px-2">
            {orderedMedals.length ? (
              orderedMedals.map((id) => (
                <span
                  key={id}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-950"
                >
                  {t(`stage74_badge_${id}`)}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-slate-500">{t('stage752_noMedalsYet')}</span>
            )}
          </div>
          <p className="mt-auto pb-10 pt-8 text-[11px] leading-relaxed text-slate-500">{t('stage753_statusShareFooter')}</p>
        </div>
      </div>

      <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Medal className="h-5 w-5 shrink-0 text-teal-600" aria-hidden />
                {t('stage752_yourStatusTitle')}
              </CardTitle>
              {statusSubtitle ? <CardDescription>{statusSubtitle}</CardDescription> : null}
              {ledgerFootnote ? (
                <CardDescription className="text-[11px] leading-snug">{ledgerFootnote}</CardDescription>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-teal-300 bg-white/90 text-teal-900 hover:bg-teal-50"
              disabled={shareBusy}
              onClick={() => void handleShareSuccess()}
            >
              {shareBusy ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin shrink-0" aria-hidden />
              ) : (
                <Smartphone className="h-4 w-4 mr-1.5 shrink-0" aria-hidden />
              )}
              {t('stage753_shareSuccessButton')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t('stage73_ambassadorProgressCaption')}</p>
            <Progress value={Number(amb.tierProgressPercent || 0)} className="h-2" />
            {amb.nextTier?.name ? (
              <p className="text-sm font-medium leading-snug text-emerald-900">
                {t('stage73_ambassadorBenefitNext')
                  .replace('{tier}', String(amb.nextTier.name))
                  .replace(
                    '{pct}',
                    String(Math.round(Number(amb.nextTier.payoutRatio ?? 0) * 100) / 100),
                  )}
              </p>
            ) : null}
            <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
              <span>
                {t('referralStage726_ambassadorTier')}:{' '}
                <strong>{amb.currentTier?.name || t('stage73_tierFallbackBeginner')}</strong>
              </span>
              <span aria-hidden>·</span>
              <span>
                {t('referralStage726_ambassadorPartners')}:{' '}
                {Number(amb.directPartnersInvited || 0).toLocaleString(locale)}
              </span>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-xs underline underline-offset-2 text-indigo-700"
                      aria-label={t('referralStage726_payoutHow')}
                    >
                      {t('referralStage726_payoutHow')}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('referralStage726_payoutTooltipDynamic').replace(
                      '{pct}',
                      String(Math.round(Number(amb.currentTier?.payoutRatio ?? 0) * 100) / 100),
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="space-y-2 border-t border-teal-100 pt-3">
            <p className="text-xs font-medium text-slate-700">{t('stage752_medalsCaption')}</p>
            {orderedMedals.length ? (
              <div className="flex flex-wrap gap-2">
                {orderedMedals.map((id) => (
                  <Badge
                    key={id}
                    variant="outline"
                    className={cn(
                      'text-xs font-semibold border',
                      MEDAL_ROW_CN[id] || 'border-slate-200 bg-slate-50 text-slate-800',
                    )}
                  >
                    {t(`stage74_badge_${id}`)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-snug">{t('stage752_noMedalsYet')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
