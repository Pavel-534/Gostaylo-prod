import { getSiteDisplayName } from '@/lib/site-url'
import PublicOfferLegalContent from '@/components/legal/PublicOfferLegalContent'

export const metadata = {
  title: `Public offer (agency agreement) | ${getSiteDisplayName()}`,
  description:
    'Public offer: platform is intermediary between guest and partner; secured payment; remuneration shown before payment.',
}

export default function PublicOfferPage() {
  return <PublicOfferLegalContent />
}
