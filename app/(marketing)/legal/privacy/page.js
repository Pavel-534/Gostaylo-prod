import { getSiteDisplayName } from '@/lib/site-url'
import PrivacyLegalContent from '@/components/legal/PrivacyLegalContent'

export const metadata = {
  title: `Privacy policy (GDPR & FL-152) | ${getSiteDisplayName()}`,
  description:
    'Personal data processing on the platform: purposes and legal bases under GDPR and Russian Federal Law No. 152-FZ.',
}

export default function PrivacyPage() {
  return <PrivacyLegalContent />
}
