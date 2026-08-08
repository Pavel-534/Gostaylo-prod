import CampaignRoiClient from './campaign-roi-client';

export const metadata = {
  title: 'Кампания — Referral ROI | Admin',
};

/**
 * @param {{ params: { campaignSlug: string } }} props
 */
export default function ReferralCampaignRoiPage({ params }) {
  return <CampaignRoiClient campaignSlugParam={params.campaignSlug} />;
}
