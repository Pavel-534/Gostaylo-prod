/**
 * Stage 199.2 — PDP response SLA line next to host card.
 */

'use client'

import { Clock, Zap } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { resolveHostResponseSlaBadge } from '@/lib/listing/host-response-sla'
import { isUnresolvedI18nKey } from '@/lib/i18n/is-unresolved-i18n-key'

/**
 * @param {{
 *   trust?: object | null
 *   language?: string
 *   className?: string
 * }} props
 */
export function HostResponseSlaBadge({ trust = null, language = 'ru', className }) {
  const badge = resolveHostResponseSlaBadge(trust)
  if (!badge) return null

  let label = getUIText(badge.i18nKey, language)
  if (badge.i18nParams && typeof label === 'string') {
    for (const [k, v] of Object.entries(badge.i18nParams)) {
      label = label.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
    }
  }
  if (isUnresolvedI18nKey(label, badge.i18nKey)) return null

  const Icon = badge.kind === 'fast' ? Zap : Clock

  return (
    <p
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-slate-600',
        className,
      )}
      data-testid="listing-host-response-sla"
      data-sla-kind={badge.kind}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          badge.kind === 'fast' ? 'text-amber-500' : 'text-brand',
        )}
        aria-hidden
      />
      <span className="min-w-0 leading-snug">{label}</span>
    </p>
  )
}
