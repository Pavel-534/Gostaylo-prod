'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Lock, Sparkles, Wrench } from 'lucide-react'

function statusLabel(status, t) {
  if (status === 'locked') return t('leaderRoadmap_status_locked')
  if (status === 'in_progress') return t('leaderRoadmap_status_in_progress')
  return t('leaderRoadmap_status_coming_soon')
}

function lockTooltipForItem(item, t) {
  if (item?.id === 'squad_quests') return t('leaderRoadmap_squadQuestsLockTooltip')
  if (item?.status === 'locked') return t('leaderRoadmap_lockedTooltip')
  return null
}

function StatusIcon({ status }) {
  if (status === 'locked') return <Lock className="h-4 w-4 text-slate-500" aria-hidden />
  if (status === 'in_progress') return <Wrench className="h-4 w-4 text-amber-600" aria-hidden />
  return <Sparkles className="h-4 w-4 text-brand" aria-hidden />
}

/**
 * @param {{
 *   items: Array<{ id: string, i18nKey: string, descKey: string, status: string }>,
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function TierRoadmap({ items = [], t, className }) {
  const rows = Array.isArray(items) ? items : []
  if (!rows.length) return null

  return (
    <Card className={cn('gsl-card', className)} data-testid="leader-roadmap">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('leaderRoadmap_title')}</CardTitle>
        <CardDescription className="text-xs">{t('leaderRoadmap_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {rows.map((item) => {
            const lockHint = lockTooltipForItem(item, t)
            const rowTitle = (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">{t(item.i18nKey)}</p>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {statusLabel(item.status, t)}
                </Badge>
              </div>
            )

            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"
                data-testid={`leader-roadmap-item-${item.id}`}
              >
                <div
                  className="flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white"
                  aria-hidden
                >
                  <StatusIcon status={item.status} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {lockHint ? (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
                            data-testid={`leader-roadmap-lock-${item.id}`}
                            aria-label={lockHint}
                          >
                            {rowTitle}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-lg"
                        >
                          {lockHint}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    rowTitle
                  )}
                  <p className="text-xs leading-relaxed text-slate-600">{t(item.descKey)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

export default TierRoadmap
