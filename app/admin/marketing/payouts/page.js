import { redirect } from 'next/navigation';

/** Legacy route → unified Referral Payout Ops Desk (Stage 132.1). */
export default function MarketingPayoutsRedirect({ searchParams }) {
  const params = new URLSearchParams();
  params.set('tab', 'queue');
  if (searchParams?.referralOnly === '1' || searchParams?.referralOnly === 'true') {
    params.set('referralOnly', '1');
  }
  redirect(`/admin/marketing/referral-payouts?${params.toString()}`);
}
