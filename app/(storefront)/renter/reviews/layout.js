import '@/lib/translations/register-renter-reviews-i18n'
import { RouteI18nBootstrap } from '@/components/i18n/I18nSliceBootstrap'

/** Renter post-trip review — client bootstrap (Stage 171.37 / 171.38). */
export default function RenterReviewsLayout({ children }) {
  return (
    <>
      <RouteI18nBootstrap preset="renterReviews" />
      {children}
    </>
  )
}

