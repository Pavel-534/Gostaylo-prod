'use client'

import { ReferralBonusSavedBanner } from '@/components/referral/ReferralBonusSavedBanner'
import { ReferralVanityWelcomeBanner } from '@/components/referral/ReferralVanityWelcomeBanner'
import { useReferralModalFollowup } from '@/hooks/useReferralModalFollowup'

/**
 * Stage 143 — vanity welcome + bonus saved banner on catalog / PDP (referral funnel exit).
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
    <div className={`space-y-4 ${className}`.trim()}>
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
