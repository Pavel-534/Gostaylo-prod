import '@/lib/translations/register-order-flow-i18n'
import '@/lib/translations/register-booking-common-i18n'
import '@/lib/translations/register-reviews-i18n'
import { RouteI18nBootstrap } from '@/components/i18n/I18nSliceBootstrap'

/** Renter orders list — order-flow i18n + client bootstrap (Stage 171.35 / 171.38). */
export default function MyBookingsLayout({ children }) {
  return (
    <>
      <RouteI18nBootstrap preset="orderFlow" />
      {children}
    </>
  )
}

