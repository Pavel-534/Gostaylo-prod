import { StorefrontAppShell } from '@/components/layout/StorefrontAppShell'
import '@/lib/translations/register-storefront-common-i18n'
import '@/lib/translations/register-errors-i18n'

/** Guest storefront: home, catalog, PDP, checkout, profile, renter hub. */
export default function StorefrontLayout({ children }) {
  return <StorefrontAppShell>{children}</StorefrontAppShell>
}
