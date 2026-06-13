'use client'

import { useAuth } from '@/contexts/auth-context'
import { useReferralMeQuery } from '@/lib/hooks/use-referral-me'
import { ReferralActivitySection } from '@/components/referral/ReferralActivitySection'
import { ReferralTeamSection } from '@/components/referral/ReferralTeamSection'
import { ReferralTeamAnalyticsCard } from '@/components/referral/ReferralTeamAnalyticsCard'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Stage 133 — tab «Команда» with team analytics SSOT query.
 */
export function ReferralProfileTabTeam({ data: fallbackData, t, locale = 'ru-RU', language = 'ru' }) {
  const { isAuthenticated } = useAuth()
  const { data: queryData, isLoading } = useReferralMeQuery({
    enabled: isAuthenticated,
    includeTeam: true,
    includeTeamAnalytics: true,
    analyticsPeriod: 'month',
    teamLimit: 100,
  })

  const data = queryData ?? fallbackData

  if (isLoading && !data) {
    return (
      <div className="space-y-6 pb-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const displayCurrency = data?.stats?.referralDisplayCurrency || 'THB'
  const midRateRubToThb = data?.sharePitchFx?.midRateRubToThb ?? null

  return (
    <div className="space-y-6 pb-2">
      <ReferralTeamAnalyticsCard
        teamAnalytics={data?.teamAnalytics}
        ambassador={data?.ambassador}
        displayCurrency={displayCurrency}
        midRateRubToThb={midRateRubToThb}
        t={t}
        locale={locale}
      />
      <ReferralActivitySection teamMembers={data?.teamMembers} t={t} />
      <ReferralTeamSection
        members={data?.teamMembers}
        displayCurrency={displayCurrency}
        midRateRubToThb={midRateRubToThb}
        t={t}
        language={language}
        locale={locale}
      />
    </div>
  )
}
