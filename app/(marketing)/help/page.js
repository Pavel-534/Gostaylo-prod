import { getSiteDisplayName } from '@/lib/site-url'
import HelpContent from '@/components/help/HelpContent'

export const metadata = {
  title: `Help Center | ${getSiteDisplayName()}`,
  description: 'FAQ, protected payments, cancellation, and support contacts.',
}

export default function HelpPage() {
  return <HelpContent />
}
