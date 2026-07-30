/**
 * Stage 199.2 — Listing Health Score widget (partner wizard).
 */

'use client'

import { CheckCircle2, Circle, Sparkles } from 'lucide-react'
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
 *   className?: string
 * }} props
 */
export function ListingHealthScoreWidget({ formData, t, className }) {
  const health = calculateListingHealthScore(listingHealthInputFromWizardForm(formData || {}))
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

  return (
    <div
      className={cn('rounded-2xl border p-3.5 sm:p-4', ring, className)}
      data-testid="listing-health-score"
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

      <ul className="space-y-1.5">
        {health.parts.map((part) => (
          <li key={part.key} className="flex items-start gap-2 text-xs text-slate-700">
            {part.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            )}
            <span className={part.ok ? 'text-slate-600' : 'font-medium text-slate-800'}>
              {t(`listingHealth_part_${part.key}`, part.key)}
              <span className="ml-1 tabular-nums text-slate-400">+{part.weight}%</span>
            </span>
          </li>
        ))}
      </ul>

      {health.tips.length > 0 ? (
        <ul
          className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-3"
          data-testid="listing-health-tips"
        >
          {health.tips.map((tip) => (
            <li key={tip.key} className="text-xs leading-snug text-slate-600">
              {formatTip(t, tip)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-emerald-200/80 pt-3 text-xs font-medium text-emerald-800">
          {t('listingHealth_allGood', 'Great — this listing looks conversion-ready.')}
        </p>
      )}
    </div>
  )
}
