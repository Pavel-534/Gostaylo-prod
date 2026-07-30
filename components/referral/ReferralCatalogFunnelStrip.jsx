'use client'

import { ReferralBonusSavedBanner } from '@/components/referral/ReferralBonusSavedBanner'
import { ReferralVanityWelcomeBanner } from '@/components/referral/ReferralVanityWelcomeBanner'
import { useReferralModalFollowup } from '@/hooks/useReferralModalFollowup'
import { cn } from '@/lib/utils'

/**
 * Stage 143 — vanity welcome + bonus saved on catalog / PDP.
 * Stage 200.7 — `hidden has-[>*]:block` so zero layout cost when both banners are null.
 *
 * @param {{ language: string, className?: string, resultsAnchorId?: string }} props
 */
export function ReferralCatalogFunnelStrip({
  language,
  className = '',
  resultsAnchorId = 'listings-results',
}) {
  const { showFollowupBanner } = useReferralModalFollowup()

  return (
    <div className={cn('hidden has-[>*]:block has-[>*]:space-y-3', className)}>
      <ReferralVanityWelcomeBanner language={language} persistSession />
      <ReferralBonusSavedBanner
        language={language}
        autoFromPendingRef
        visible={showFollowupBanner}
        ctaHref="/listings"
        resultsAnchorId={resultsAnchorId}
      />
    </div>
  )
}
