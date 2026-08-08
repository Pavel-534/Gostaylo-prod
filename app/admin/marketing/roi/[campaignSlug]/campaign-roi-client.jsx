'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/admin/charts/ChartSkeleton'

const ReferralCampaignRoiDetail = dynamic(
  () =>
    import('@/components/admin/marketing/ReferralCampaignRoiDetail').then((m) => ({
      default: m.ReferralCampaignRoiDetail,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="min-h-[480px]" />,
  },
)

/**
 * @param {{ campaignSlugParam: string }} props
 */
export default function CampaignRoiClient({ campaignSlugParam }) {
  return <ReferralCampaignRoiDetail campaignSlugParam={campaignSlugParam} />
}
