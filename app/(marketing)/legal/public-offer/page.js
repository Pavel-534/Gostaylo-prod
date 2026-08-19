import { getSiteDisplayName } from '@/lib/site-url'
import PublicOfferLegalContent from '@/components/legal/PublicOfferLegalContent'
import { loadLatestReferralProgramStats } from '@/lib/services/marketing/referral-program-stats.service.js'

export const metadata = {
  title: `Public offer (agency agreement) | ${getSiteDisplayName()}`,
  description:
    'Public offer: platform is intermediary between guest and partner; secured payment; remuneration shown before payment.',
}

function formatAvgEarned(row) {
  const n = Number(row?.avg_earned_thb)
  const count = Number(row?.active_ambassadors_count)
  if (!Number.isFinite(n) || !Number.isFinite(count) || count <= 0) return null
  return `${Math.round(n).toLocaleString('en-US')} THB`
}

export default async function PublicOfferPage() {
  const stats = await loadLatestReferralProgramStats()
  return <PublicOfferLegalContent avgEarnedFromStats={formatAvgEarned(stats)} />
}
