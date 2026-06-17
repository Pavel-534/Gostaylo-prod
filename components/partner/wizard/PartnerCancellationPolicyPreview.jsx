'use client'

import { ShieldCheck } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import {
  getHostCancellationScenarios,
  getNormalizedWizardCancellationPolicy,
} from '@/lib/wizard/host-cancellation-preview'

/**
 * Host wizard — what guest cancellation means for partner earnings.
 */
export function PartnerCancellationPolicyPreview({ policy, language = 'ru' }) {
  const normalized = getNormalizedWizardCancellationPolicy(policy)
  const guestCopyKey = `listingCancellation_${normalized}`
  const scenarios = getHostCancellationScenarios(normalized)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-brand mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            {getUIText('wizardCancelPreview_title', language)}
          </p>
          <p className="text-xs leading-relaxed text-slate-600">
            {getUIText(guestCopyKey, language)}
          </p>
        </div>
      </div>
      <ul className="space-y-2 border-t border-slate-200/80 pt-3">
        {scenarios.map((row) => (
          <li
            key={row.timingKey}
            className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <span>
              {getUIText('wizardCancelPreview_hostScenario', language)
                .replace('{{timing}}', getUIText(row.timingKey, language))
                .replace('{{hostPct}}', String(row.hostKeepPercent))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
