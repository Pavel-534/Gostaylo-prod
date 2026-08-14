/**
 * Stage 199.2 / 200.28 / 201.34 — Listing Health Score widget (partner wizard).
 * Incomplete parts are tappable → jump to the wizard step that needs filling.
 */

'use client'

import { CheckCircle2, Circle, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateListingHealthScore,
  listingHealthInputFromWizardForm,
} from '@/lib/partner/listing-health-score'

function formatTip(t, tip) {
  let label = t(tip.tipKey, tip.tipKey)
  if (tip.tipParams && typeof label === 'string') {
    for (const [k, v] of Object.entries(tip.tipParams)) {
      label = label.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
    }
  }
  return label
}

/**
 * @param {{
 *   formData?: object
 *   t: (key: string, fb?: string) => string
 *   wizardProfile?: string | null
 *   categorySlug?: string
 *   categoryName?: string
 *   className?: string
 *   onGoToStep?: (step: number, partKey: string) => void
 * }} props
 */
export function ListingHealthScoreWidget({
  formData,
  t,
  wizardProfile = null,
  categorySlug = '',
  categoryName = '',
  className,
  onGoToStep,
}) {
  const health = calculateListingHealthScore(
    listingHealthInputFromWizardForm(formData || {}, {
      wizardProfile,
      categorySlug,
      categoryName,
    }),
  )
  const tone =
    health.score >= 80 ? 'emerald' : health.score >= 50 ? 'amber' : 'slate'

  const ring =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/70'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/70'
        : 'border-slate-200 bg-slate-50/80'

  const bar =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-slate-400'

  function go(partOrTip) {
    const step = partOrTip?.wizardStep
    if (!onGoToStep || step == null || partOrTip.ok) return
    onGoToStep(step, partOrTip.key)
  }

  return (
    <div
      className={cn('rounded-2xl border p-3.5 sm:p-4', ring, className)}
      data-testid="listing-health-score"
      data-health-mode={health.mode}
      role="status"
      aria-label={t('listingHealth_title', 'Listing quality')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p className="text-sm font-semibold text-slate-900">
            {t('listingHealth_title', 'Listing quality')}
          </p>
        </div>
        <p
          className="shrink-0 text-sm font-bold tabular-nums text-slate-900"
          data-testid="listing-health-score-value"
        >
          {health.score}
          <span className="font-medium text-slate-500">/{health.maxScore}</span>
        </p>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/80">
        <div
          className={cn('h-full rounded-full transition-all duration-300', bar)}
          style={{ width: `${Math.min(100, Math.max(0, health.score))}%` }}
        />
      </div>

      <ul className="space-y-1">
        {health.parts.map((part) => {
          const canJump = Boolean(onGoToStep && !part.ok && part.wizardStep != null)
          const label = (
            <>
              {t(part.labelKey || `listingHealth_part_${part.key}`, part.key)}
              <span className="ml-1 tabular-nums text-slate-400">+{part.weight}%</span>
            </>
          )

          return (
            <li key={part.key}>
              {canJump ? (
                <button
                  type="button"
                  onClick={() => go(part)}
                  data-testid={`listing-health-part-${part.key}`}
                  className={cn(
                    'flex w-full min-h-[44px] items-start gap-2 rounded-xl px-1.5 py-1.5 text-left text-xs',
                    'font-medium text-brand-hover transition-colors',
                    'hover:bg-brand/5 active:bg-brand/10 touch-manipulation',
                  )}
                >
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1 leading-snug">{label}</span>
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                </button>
              ) : (
                <div
                  className="flex items-start gap-2 px-1.5 py-1.5 text-xs text-slate-700"
                  data-testid={`listing-health-part-${part.key}`}
                >
                  {part.ok ? (
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <span className={cn('leading-snug', part.ok ? 'text-slate-600' : 'font-medium text-slate-800')}>
                    {label}
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {health.tips.length > 0 ? (
        <ul
          className="mt-3 space-y-1 border-t border-slate-200/80 pt-3"
          data-testid="listing-health-tips"
        >
          {health.tips.map((tip) => {
            const canJump = Boolean(onGoToStep && tip.wizardStep != null)
            const text = formatTip(t, tip)
            if (canJump) {
              return (
                <li key={tip.key}>
                  <button
                    type="button"
                    onClick={() => go(tip)}
                    data-testid={`listing-health-tip-${tip.key}`}
                    className={cn(
                      'flex w-full min-h-[44px] items-start gap-1 rounded-xl px-1.5 py-1.5 text-left text-xs',
                      'leading-snug text-brand-hover underline-offset-2 hover:underline',
                      'hover:bg-brand/5 active:bg-brand/10 touch-manipulation',
                    )}
                  >
                    <span className="min-w-0 flex-1">{text}</span>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  </button>
                </li>
              )
            }
            return (
              <li key={tip.key} className="px-1.5 text-xs leading-snug text-slate-600">
                {text}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 border-t border-emerald-200/80 pt-3 text-xs font-medium text-emerald-800">
          {t('listingHealth_allGood', 'Great — this listing looks conversion-ready.')}
        </p>
      )}
    </div>
  )
}
