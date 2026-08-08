'use client'

/**
 * Stage 200.75 — checkout segment error boundary.
 */

import { AppErrorBoundaryView } from '@/components/product/AppErrorBoundaryView'

export default function CheckoutError({ error, reset }) {
  return (
    <AppErrorBoundaryView
      error={error}
      reset={reset}
      logLabel="[Checkout Error]"
      bodyKey="checkoutSegmentError_body"
      secondaryHref="/my-bookings"
      secondaryLabelKey="checkout_escapeBookingDetails"
    />
  )
}
