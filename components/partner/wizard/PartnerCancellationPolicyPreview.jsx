'use client'

import { ShieldCheck } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import {
  getHostCancellationScenarios,
  getNormalizedWizardCancellationPolicy,
} from '@/lib/wizard/host-cancellation-preview'
import { cn } from '@/lib/utils'
import { WIZARD_MOBILE_FLAT_INSET_CLASS } from '@/lib/ui/mobile-flat-canvas'

/**
 * Host wizard — what guest cancellation means for partner earnings.
 */
export function PartnerCancellationPolicyPreview({ policy, language = 'ru' }) {
  const normalized = getNormalizedWizardCancellationPolicy(policy)
  const guestCopyKey = `listingCancellation_${normalized}`
  const scenarios = getHostCancellationScenarios(normalized)

  return (
    <div className={cn(WIZARD_MOBILE_FLAT_INSET_CLASS, 'sm:bg-slate-50/90')}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            {getUIText('wizardCancelPreview_title', language)}
          </p>
          <p className="text-xs leading-relaxed text-slate-600">
            {getUIText(guestCopyKey, language)}
          </p>
        </div>
      </div>
      <ul className="space-y-2 border-t border-slate-200/80 pt-3 max-sm:border-slate-100">
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
