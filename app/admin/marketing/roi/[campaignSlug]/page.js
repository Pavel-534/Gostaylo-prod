import { ReferralCampaignRoiDetail } from '@/components/admin/marketing/ReferralCampaignRoiDetail';

export const metadata = {
  title: 'Кампания — Referral ROI | Admin',
};

/**
 * @param {{ params: { campaignSlug: string } }} props
 */
export default function ReferralCampaignRoiPage({ params }) {
  return <ReferralCampaignRoiDetail campaignSlugParam={params.campaignSlug} />;
}
