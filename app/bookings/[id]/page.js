import { redirect } from 'next/navigation'

/**
 * Deep link for booking flows (push / external apps).
 * Checkout page loads fresh booking state and enforces access server-side where applicable.
 */
export default async function BookingDeepLinkPage({ params }) {
  const { id } = await params
  if (!id) redirect('/renter/bookings')
  redirect(`/checkout/${encodeURIComponent(id)}`)
}
