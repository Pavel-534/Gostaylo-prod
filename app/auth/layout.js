import '@/lib/translations/register-auth-i18n'
import '@/lib/translations/register-storefront-common-i18n'
import '@/lib/translations/register-errors-i18n'
import { RouteI18nBootstrap } from '@/components/i18n/I18nSliceBootstrap'

/** OAuth / legal completion — auth + shared chrome strings (Stage 171.36 / 189 client bootstrap). */
export default function AuthRouteLayout({ children }) {
  return (
    <>
      <RouteI18nBootstrap preset="auth" />
      {children}
    </>
  )
}
