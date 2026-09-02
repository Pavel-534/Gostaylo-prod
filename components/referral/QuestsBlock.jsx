'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle } from 'lucide-react'

const GUEST_QUEST_IDS = new Set(['first_invite', 'first_booking'])
const PARTNER_QUEST_IDS = new Set(['three_hosts_30d', 'first_completed_host'])

function QuestRow({ q, t }) {
  const met = q.conditionMet === true || q.status === 'condition_met'
  return (
    <li
      className={cn(
        'flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2',
        met ? 'border-emerald-200/80 bg-emerald-50/40' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {met ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        )}
        <div className="min-w-0">
          <span className={cn('text-sm leading-snug', met ? 'text-slate-500 line-through' : 'text-slate-800')}>
            {t(q.titleKey)}
          </span>
          {met ? <p className="text-[11px] text-emerald-700">{t('leaderQuests_status_met')}</p> : null}
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-emerald-700 tabular-nums">
        {t('leaderQuests_rewardUpTo')}{' '}
        <ReferralLedgerAmount thb={q.rewardThb} className="inline font-semibold" />
      </span>
    </li>
  )
}

/**
 * @param {{
 *   quests: Array<{
 *     id: string,
 *     titleKey: string,
 *     rewardThb: number,
 *     conditionMet?: boolean,
 *     status?: string,
 *   }>,
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function QuestsBlock({ quests = [], t, className }) {
  const rows = Array.isArray(quests) ? quests : []
  if (!rows.length) return null

  const guestQuests = rows.filter((q) => GUEST_QUEST_IDS.has(q.id))
  const partnerQuests = rows.filter((q) => PARTNER_QUEST_IDS.has(q.id))
  const otherQuests = rows.filter((q) => !GUEST_QUEST_IDS.has(q.id) && !PARTNER_QUEST_IDS.has(q.id))

  const renderGroup = (titleKey, items, testId) => {
    if (!items.length) return null
    return (
      <div className="space-y-2" data-testid={testId}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(titleKey)}</p>
        <ul className="space-y-2">
          {items.map((q) => (
            <QuestRow key={q.id} q={q} t={t} />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <Card className={cn('gsl-card', className)} data-testid="leader-quests-block">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('leaderQuests_title')}</CardTitle>
        <CardDescription className="text-xs">{t('leaderQuests_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderGroup('leaderQuests_groupGuests', guestQuests, 'leader-quests-group-guests')}
        {renderGroup('leaderQuests_groupPartners', partnerQuests, 'leader-quests-group-partners')}
        {otherQuests.length ? (
          <ul className="space-y-2">
            {otherQuests.map((q) => (
              <QuestRow key={q.id} q={q} t={t} />
            ))}
          </ul>
        ) : null}
        <p className="text-[11px] leading-relaxed text-slate-500">{t('leaderQuests_disclaimer')}</p>
      </CardContent>
    </Card>
  )
}

export default QuestsBlock
