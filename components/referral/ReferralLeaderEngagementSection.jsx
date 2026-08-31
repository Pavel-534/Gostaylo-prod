'use client'

import { useMemo } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { useReferralEngagementQuery } from '@/lib/hooks/use-referral-engagement'
import { LocalLeaderTier } from '@/components/referral/LocalLeaderTier'
import { QuestsBlock } from '@/components/referral/QuestsBlock'
import { TierRoadmap } from '@/components/referral/TierRoadmap'
import { Loader2 } from 'lucide-react'

/**
 * Stage 202.22 — Local Leader tier + quests + roadmap on `/profile/referral`.
 *
 * @param {{ enabled?: boolean, className?: string }} props
 */
export function ReferralLeaderEngagementSection({ enabled = true, className }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { data, isLoading, isError } = useReferralEngagementQuery({ enabled })

  if (!enabled) return null

  if (isLoading && !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600" data-testid="leader-engagement-loading">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        …
      </p>
    )
  }

  if (isError && !data) return null

  const tier = data?.tier
  const quests = data?.quests
  const roadmap = data?.roadmap

  return (
    <section className={className} data-testid="referral-leader-engagement">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LocalLeaderTier
          currentTier={tier?.current}
          nextTier={tier?.next}
          progressPercent={tier?.progressPercent}
          missing={tier?.missing}
          t={t}
        />
        <QuestsBlock quests={quests} t={t} />
        <TierRoadmap items={roadmap} t={t} />
      </div>
    </section>
  )
}

export default ReferralLeaderEngagementSection
