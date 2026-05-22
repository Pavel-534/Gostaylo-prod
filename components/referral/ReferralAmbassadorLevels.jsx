'use client'

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { HelpCircle } from 'lucide-react'

function levelTooltipKey(level) {
  const n = Number(level)
  if (n === 1) return 'stage1147_levelTooltip1'
  if (n === 2) return 'stage1147_levelTooltip2'
  if (n === 3) return 'stage1147_levelTooltip3'
  return 'stage1147_levelTooltipGeneric'
}

/**
 * Stage 114.3 / 114.7 — прогресс Ambassador Level 1–3 (из tiers SSOT).
 * @param {{ levels?: Array<{ level: number, name: string, minPartnersInvited: number, unlocked?: boolean, isCurrent?: boolean }>, directPartnersInvited?: number, t: (k: string) => string }} props
 */
export function ReferralAmbassadorLevels({ levels = [], directPartnersInvited = 0, t }) {
  const rows = Array.isArray(levels) ? levels : []
  if (!rows.length) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">{t('stage1143_ambassadorLevelsTitle')}</p>
        {rows.map((row) => {
          const min = Math.max(0, Number(row.minPartnersInvited) || 0)
          const progress =
            directPartnersInvited >= min
              ? 100
              : min > 0
                ? Math.min(100, Math.round((directPartnersInvited / min) * 100))
                : 0
          const tipKey = levelTooltipKey(row.level)
          return (
            <div
              key={row.level ?? row.id ?? row.name}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                row.isCurrent ? 'border-[#006666]/40 bg-teal-50/80' : 'border-slate-200 bg-white',
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                <span className="font-medium text-slate-900 inline-flex items-center gap-1 min-w-0">
                  <span className="truncate">
                    {t('stage1143_ambassadorLevelLabel').replace('{n}', String(row.level))} — {row.name}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                        aria-label={t('stage1147_levelTooltipAria')}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      {t(tipKey)}
                    </TooltipContent>
                  </Tooltip>
                </span>
                <div className="flex items-center gap-2">
                  {row.isCurrent ? (
                    <Badge variant="outline" className="border-[#006666]/50 text-[#006666] text-[10px]">
                      {t('stage1143_levelCurrent')}
                    </Badge>
                  ) : row.unlocked ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {t('stage1143_levelUnlocked')}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-slate-500 tabular-nums">
                    {directPartnersInvited}/{min}
                  </span>
                </div>
              </div>
              <Progress value={progress} className="h-2 mt-2" />
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
