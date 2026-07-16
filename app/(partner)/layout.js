import { PartnerRouteShell } from '@/components/layout/PartnerRouteShell'
import '@/lib/translations/register-partner-i18n-slice'
import '@/lib/translations/register-order-flow-i18n'
import '@/lib/translations/register-errors-i18n'

/** Partner dashboard — unread badge without global Chat Realtime. */
export default function PartnerRouteGroupLayout({ children }) {
  return <PartnerRouteShell>{children}</PartnerRouteShell>
}
