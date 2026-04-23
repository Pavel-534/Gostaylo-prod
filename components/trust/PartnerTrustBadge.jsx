'use client'

import { Award, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function buildTooltipDescription(trust, language) {
  const tip = trust?.tooltip
  const parts = []

  if (tip && (Number.isFinite(tip.cleanStayPercent12m) || (tip.completedStays12m ?? 0) > 0)) {
    const cancels = tip.cancellations12m ?? 0
    const pct = Number.isFinite(tip.cleanStayPercent12m) ? String(tip.cleanStayPercent12m) : '—'
    parts.push(
      getUIText('partnerTrust_tooltipStats', language)
        .replace(/\{\{cancels\}\}/g, String(cancels))
        .replace(/\{\{pct\}\}/g, pct),
    )
  } else {
    parts.push(getUIText('partnerTrust_tooltipGeneric', language))
  }

  if (
    tip?.avgResponseMinutes30d != null &&
    Number.isFinite(tip.avgResponseMinutes30d) &&
    (tip.responseSampleCount30d ?? 0) >= 3
  ) {
    const mins = Math.max(1, Math.ceil(Number(tip.avgResponseMinutes30d)))
    parts.push(
      getUIText('partnerTrust_tooltipResponseSpeed', language).replace(/\{\{mins\}\}/g, String(mins)),
    )
  }

  if (trust?.reliabilityPercent != null && Number.isFinite(trust.reliabilityPercent)) {
    parts.push(
      getUIText('partnerTrust_tooltipScoreAppend', language).replace(
        /\{\{percent\}\}/g,
        String(trust.reliabilityPercent),
      ),
    )
  }

  return parts.filter(Boolean).join('\n\n')
}

/**
 * @param {object} props
 * @param {object | null} props.trust
 * @param {string} [props.language]
 * @param {boolean} [props.compact]
 * @param {boolean} [props.showVerifiedCompanion]
 * @param {boolean} [props.withTooltip] — default true; set false if nested in another tooltip
 */
export function PartnerTrustBadge({
  trust,
  language = 'ru',
  compact = false,
  showVerifiedCompanion = false,
  withTooltip = true,
}) {
  if (!trust) return null

  const { tier, reliabilityPercent, topPartner } = trust
  const isNew = tier === 'NEW' && (reliabilityPercent == null || Number.isNaN(reliabilityPercent))
  const isStrong = tier === 'STRONG'

  const innerNew = (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'mt-0.5' : 'mt-1')}>
      <span className="text-xs text-slate-500">{getUIText('partnerTrust_newPartner', language)}</span>
      {showVerifiedCompanion ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded px-1.5 py-0 font-medium">
          <ShieldCheck className="h-3 w-3" />
          {getUIText('partnerTrust_verified', language)}
        </span>
      ) : null}
    </div>
  )

  const innerMain = (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'mt-0.5' : 'mt-1')}>
      {(topPartner || tier === 'TOP') && (
        <Badge
          className="gap-0.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-semibold text-[10px] sm:text-xs px-1.5 py-0 h-5 sm:h-6"
          title={getUIText('partnerTrust_topPartnerHint', language)}
        >
          <Award className="h-3 w-3 shrink-0" />
          {getUIText('partnerTrust_topPartner', language)}
        </Badge>
      )}
      {isStrong && tier !== 'TOP' && !topPartner ? (
        <Badge
          variant="secondary"
          className="gap-0.5 bg-teal-50 text-teal-900 border-teal-200 font-medium text-[10px] sm:text-xs px-1.5 py-0 h-5 sm:h-6"
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          {getUIText('partnerTrust_reliableHost', language)}
        </Badge>
      ) : null}
      {reliabilityPercent != null && Number.isFinite(reliabilityPercent) ? (
        <span className="text-xs font-medium text-slate-700 tabular-nums">
          {getUIText('partnerTrust_percentReliability', language).replace(/\{\{percent\}\}/g, String(reliabilityPercent))}
        </span>
      ) : null}
      {showVerifiedCompanion ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded px-1.5 py-0 font-medium">
          <ShieldCheck className="h-3 w-3" />
          {getUIText('partnerTrust_verified', language)}
        </span>
      ) : null}
    </div>
  )

  if (!withTooltip) {
    return isNew ? innerNew : innerMain
  }

  const wrap = (node) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={cn('inline-flex max-w-full cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal-500')}
          >
            {node}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[300px] bg-slate-900 text-slate-50 border border-slate-700 px-3 py-2 text-left"
        >
          <p className="text-xs leading-relaxed whitespace-pre-line">{buildTooltipDescription(trust, language)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return isNew ? wrap(innerNew) : wrap(innerMain)
}
