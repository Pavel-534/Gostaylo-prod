import { MarketingAppShell } from '@/components/layout/MarketingAppShell'
import '@/lib/translations/register-storefront-common-i18n'
import '@/lib/translations/register-errors-i18n'

/** Help, legal, about — header + soft-back; i18n mirrors storefront chrome (Stage 201.15). */
export default function MarketingLayout({ children }) {
  return <MarketingAppShell>{children}</MarketingAppShell>
}
