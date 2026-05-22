'use client'

import { BADGE_PROGRESSION_ORDER } from '@/lib/referral/referral-badges'
import { cn } from '@/lib/utils'
import { Award, HelpCircle, Lock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * @param {{ badgesEarned?: string[], t: (k: string) => string, compact?: boolean }} props
 */
export function ReferralBadgesGrid({ badgesEarned = [], t, compact = false }) {
  const earned = new Set((badgesEarned || []).map((id) => String(id)))
  const all = BADGE_PROGRESSION_ORDER

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
        {all.map((id) => {
          const unlocked = earned.has(id)
          const hint = t(`stage1143_badge_${id}_hint`)
          return (
            <div
              key={id}
              className={cn(
                'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
                unlocked
                  ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                  : 'border-slate-200 bg-slate-50/80 text-slate-500',
              )}
            >
              {unlocked ? (
                <Award className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
              ) : (
                <Lock className="h-4 w-4 shrink-0 mt-0.5 opacity-50" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1">
                  <p className="font-medium leading-snug flex-1">{t(`stage1143_badge_${id}`)}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                        aria-label={t('stage1147_badgeTooltipAria').replace('{badge}', t(`stage1143_badge_${id}`))}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      {hint}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {!compact ? <p className="text-xs mt-0.5 opacity-80">{hint}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
