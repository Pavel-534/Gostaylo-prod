'use client'

import { cn } from '@/lib/utils'

/**
 * Stage 202.39 — 3-step onboarding for new referrers (earned ≈ 0, invites &lt; 3).
 *
 * @param {{
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function ReferralNewcomerSteps({ t, className }) {
  const steps = [
    { n: 1, key: 'referralNewcomer_step1' },
    { n: 2, key: 'referralNewcomer_step2' },
    { n: 3, key: 'referralNewcomer_step3' },
  ]

  return (
    <section
      className={cn('rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4', className)}
      data-testid="referral-newcomer-steps"
    >
      <p className="text-sm font-semibold text-slate-900">{t('referralNewcomer_title')}</p>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-3 text-sm text-slate-700">
            <span
              className="flex h-7 w-7 min-h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
              aria-hidden
            >
              {step.n}
            </span>
            <span className="leading-snug pt-0.5">{t(step.key)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ReferralNewcomerSteps
