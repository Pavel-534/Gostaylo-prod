'use client'

import { UserPlus, Clock, BadgeCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const STAGE_META = {
  registered: {
    Icon: UserPlus,
    iconClass: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
  first_booking_pending: {
    Icon: Clock,
    iconClass: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  completed_bonus_paid: {
    Icon: BadgeCheck,
    iconClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
}

function normalizeStage(raw, activityStatus) {
  const s = String(raw || '').toLowerCase()
  if (s === 'first_booking_pending') return 'first_booking_pending'
  if (s === 'completed_bonus_paid') return 'completed_bonus_paid'
  if (s === 'registered') return 'registered'
  const act = String(activityStatus || '').toLowerCase()
  if (act === 'active') return 'completed_bonus_paid'
  return 'registered'
}

/**
 * @param {{ teamMembers?: Array<{ refereeId: string, displayName: string, timelineStage?: string, invitedAt?: string | null }>, t: (key: string, ctx?: object) => string }} props
 */
export function ReferralActivitySection({ teamMembers = [], t }) {
  const rows = Array.isArray(teamMembers) ? teamMembers : []

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t('stage91_activityTitle')}</CardTitle>
        <CardDescription>{t('stage91_activitySubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">{t('stage91_activityEmpty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((m) => {
              const stage = normalizeStage(m?.timelineStage, m?.activityStatus)
              const meta = STAGE_META[stage] || STAGE_META.registered
              const Icon = meta.Icon
              const labelKey =
                stage === 'completed_bonus_paid'
                  ? 'stage91_status_completed'
                  : stage === 'first_booking_pending'
                    ? 'stage91_status_first_booking'
                    : 'stage91_status_registered'
              return (
                <li key={String(m.refereeId)} className="flex items-center gap-3 py-3 first:pt-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${meta.iconClass}`}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{String(m.displayName || '—')}</p>
                    <p className="text-xs text-slate-500">{t(labelKey)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
