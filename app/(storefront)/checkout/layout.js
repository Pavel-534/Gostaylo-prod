import '@/lib/translations/register-checkout-i18n'
import '@/lib/translations/register-storefront-common-i18n'
import '@/lib/translations/register-booking-common-i18n'
import '@/lib/translations/register-errors-i18n'
import { CheckoutClientShell } from '@/components/checkout/CheckoutClientShell'

/** Checkout — payment + booking + errors i18n; client bootstrap (Stage 171.38). */
export default function CheckoutLayout({ children }) {
  return <CheckoutClientShell>{children}</CheckoutClientShell>
}
