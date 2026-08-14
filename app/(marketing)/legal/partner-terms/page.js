import { getSiteDisplayName } from '@/lib/site-url'
import PartnerTermsLegalContent from '@/components/legal/PartnerTermsLegalContent'

export const metadata = {
  title: `Partner (host) terms | ${getSiteDisplayName()}`,
  description:
    'Listing and cooperation terms: payouts, KYC, liability for the object, moderation.',
}

export default function PartnerTermsPage() {
  return <PartnerTermsLegalContent />
}
