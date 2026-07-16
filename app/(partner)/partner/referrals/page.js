import { redirect } from 'next/navigation'

/** Stage 114.1 — legacy `/partner/referrals` → ambassador hub. */
export default function PartnerReferralsRedirectPage() {
  redirect('/profile/referral')
}
