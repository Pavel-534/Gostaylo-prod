'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Coins, Share2, Sparkles, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isSimpleReferralPublicMode } from '@/lib/compliance/referral-public-mode.js'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

const STEP_ICONS = [Share2, UserPlus, Sparkles, Coins]

/**
 * Stage 202.37 — collapsible host/partner referral lifecycle (Link tab, under HostReferralCard).
 *
 * @param {{
 *   data: object,
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function HostReferralJourney({ data, t, className }) {
  const [open, setOpen] = useState(false)
  const referralPublicSimple = isSimpleReferralPublicMode()
  const estimator = data?.referralEstimator || {}
  const l1Pct = Math.round(
    Number(estimator.mlmLevel1Percent ?? estimator.mlm_level1_percent ?? 70),
  )

  const steps = useMemo(() => {
    const rows = [
      { titleKey: 'hostReferralJourney_step1Title', bodyKey: 'hostReferralJourney_step1Body' },
      { titleKey: 'hostReferralJourney_step2Title', bodyKey: 'hostReferralJourney_step2Body' },
      {
        titleKey: 'hostReferralJourney_step3Title',
        bodyKey: referralPublicSimple
          ? 'hostReferralJourney_step3Body_simple'
          : 'hostReferralJourney_step3Body',
        ctx: referralPublicSimple ? undefined : { l1Pct: String(l1Pct) },
      },
    ]
    if (!referralPublicSimple) {
      rows.push({
        titleKey: 'hostReferralJourney_step4Title',
        bodyKey: 'hostReferralJourney_step4Body',
      })
    }
    return rows
  }, [referralPublicSimple, l1Pct])

  return (
    <section
      className={cn(MOBILE_FLAT_CARD_CLASS, 'overflow-hidden', className)}
      data-testid="host-referral-journey"
    >
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-800"
        aria-expanded={open}
        data-testid="host-referral-journey-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{t('hostReferralJourney_toggle')}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <ol className="space-y-0 border-t border-slate-200/80 px-4 py-4">
          {steps.map((step, idx) => {
            const Icon = STEP_ICONS[idx] || Coins
            const isLast = idx === steps.length - 1
            return (
              <li
                key={step.titleKey}
                className="flex gap-3"
                data-testid={`host-referral-journey-step-${idx + 1}`}
              >
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  {!isLast ? <div className="my-1 w-px flex-1 min-h-[12px] bg-slate-200" aria-hidden /> : null}
                </div>
                <div className={cn('min-w-0 flex-1 space-y-1', !isLast && 'pb-4')}>
                  <p className="text-sm font-medium text-slate-900">{t(step.titleKey)}</p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {t(step.bodyKey, step.ctx)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}

export default HostReferralJourney
