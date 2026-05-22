'use client'

import { useI18n } from '@/contexts/i18n-context'
import { ReferralActivitySection } from '@/components/referral/ReferralActivitySection'
import { ReferralTeamSection } from '@/components/referral/ReferralTeamSection'

export function ReferralProfileTabTeam({ data, t }) {
  const { language } = useI18n()
  return (
    <div className="space-y-6">
      <ReferralActivitySection teamMembers={data?.teamMembers} t={t} />
      <ReferralTeamSection members={data?.teamMembers} t={t} language={language} />
    </div>
  )
}
