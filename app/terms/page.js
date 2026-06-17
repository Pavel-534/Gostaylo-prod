import { getSiteDisplayName } from '@/lib/site-url'
import TermsContent from '@/components/terms/TermsContent'

export const metadata = {
  title: `Terms of Service | ${getSiteDisplayName()}`,
  description: `${getSiteDisplayName()} Terms of Service: platform rules, escrow protection, cancellation, GDPR/PDPA compliance.`,
}

export default function TermsPage() {
  return <TermsContent />
}
