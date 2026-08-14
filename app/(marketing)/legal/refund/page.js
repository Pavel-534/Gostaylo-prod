import { getSiteDisplayName } from '@/lib/site-url'
import RefundLegalContent from '@/components/legal/RefundLegalContent'

export const metadata = {
  title: `Refund and cancellation policy | ${getSiteDisplayName()}`,
  description:
    'Secured payment release rules: 100% refund if Partner fails to deliver; Guest cancellation per listing rules.',
}

export default function RefundPage() {
  return <RefundLegalContent />
}
