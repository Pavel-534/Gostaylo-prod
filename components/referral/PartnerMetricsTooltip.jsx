'use client'

import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { REFERRAL_GLOSSARY } from '@/lib/referral/partner-metrics-glossary.js'
import { cn } from '@/lib/utils'

/**
 * Stage 202.26 — "?" glossary popover for partner metric axes.
 *
 * @param {{
 *   axis: import('@/lib/referral/partner-metrics-glossary.js').PartnerMetricsAxis,
 *   t: (key: string) => string,
 *   side?: 'top' | 'bottom' | 'left' | 'right',
 *   className?: string,
 *   iconClassName?: string,
 * }} props
 */
export function PartnerMetricsTooltip({
  axis,
  t,
  side = 'top',
  className,
  iconClassName,
}) {
  const entry = REFERRAL_GLOSSARY[axis]
  if (!entry || typeof t !== 'function') return null

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[44px] min-w-[44px] inline-flex items-center justify-center sm:min-h-0 sm:min-w-0',
              className,
            )}
            aria-label={t('referralGlossary_tooltipAria')}
          >
            <HelpCircle className={cn('h-3.5 w-3.5', iconClassName)} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs space-y-1.5 text-xs leading-relaxed">
          <p className="font-semibold text-slate-900">{t(entry.termKey)}</p>
          <p className="text-slate-700">{t(entry.definitionKey)}</p>
          <p className="text-slate-500">{t(entry.exampleKey)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default PartnerMetricsTooltip
