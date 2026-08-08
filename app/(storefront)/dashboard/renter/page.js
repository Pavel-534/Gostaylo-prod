import { redirect } from 'next/navigation'

/**
 * Legacy storefront entry → canonical renter hub.
 * Stage 200.65 — server redirect (no client flash).
 */
export default function DashboardRenterRedirect() {
  redirect('/renter/dashboard')
}
