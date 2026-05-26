'use client'

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatListingQualityChecklistLabel } from '@/lib/partner/listing-quality-gates'

/**
 * @param {{ checklist: { ok: boolean, items: Array<{ code: string, ok: boolean, i18nKey: string, params?: object }> }, t: (key: string, fb?: string) => string, title?: string }} props
 */
export function ListingPublishQualityChecklist({ checklist, t, title }) {
  if (!checklist?.items?.length) return null

  const heading = title || t('listingQuality_checklistTitle', 'Before publishing, complete:')

  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        checklist.ok
          ? 'border-emerald-200 bg-emerald-50/60 text-slate-800'
          : 'border-amber-300 bg-amber-50/80 text-amber-950'
      }`}
      role="status"
    >
      <p className="mb-2 font-semibold">{heading}</p>
      <ul className="space-y-2">
        {checklist.items.map((item) => (
          <li key={item.code} className="flex items-start gap-2">
            {item.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            )}
            <span className={item.ok ? 'text-slate-700' : 'font-medium'}>
              {formatListingQualityChecklistLabel(item, t)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
