import '@/lib/translations/register-order-flow-i18n'
import { RouteI18nBootstrap } from '@/components/i18n/I18nSliceBootstrap'

/** Booking deep links — order-flow i18n + client bootstrap (Stage 171.35 / 171.38). */
export default function BookingsLayout({ children }) {
  return (
    <>
      <RouteI18nBootstrap preset="orderFlow" />
      {children}
    </>
  )
}

