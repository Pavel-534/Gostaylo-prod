'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Inline tips when wizard Next is disabled (Stage 200.28).
 * @param {{
 *   blockers: Array<{ i18nKey: string, params?: Record<string, string|number> }>
 *   t: (key: string, fb?: string) => string
 *   tr?: (key: string, vars?: Record<string, string|number>) => string
 *   className?: string
 * }} props
 */
export function WizardStepBlockersHint({ blockers, t, tr, className }) {
  if (!Array.isArray(blockers) || blockers.length === 0) return null

  const format = (item) => {
    if (typeof tr === 'function') {
      return tr(item.i18nKey, item.params || {})
    }
    let label = t(item.i18nKey, item.i18nKey)
    if (item.params && typeof label === 'string') {
      for (const [k, v] of Object.entries(item.params)) {
        label = label.split(`{{${k}}}`).join(String(v))
      }
    }
    return label
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950',
        className,
      )}
      role="status"
      data-testid="wizard-step-blockers"
    >
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('wizardBlocker_titleHint', 'Чтобы продолжить:')}
      </p>
      <ul className="space-y-1">
        {blockers.map((b) => (
          <li key={b.i18nKey + JSON.stringify(b.params || {})}>{format(b)}</li>
        ))}
      </ul>
    </div>
  )
}
