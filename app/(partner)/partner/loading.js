import { PartnerDashboardLoadingSkeleton } from '@/components/partner/dashboard/partner-dashboard-widgets'

/** Instant shell while partner route chunks load (PWA / slow mobile networks). */
export default function PartnerRouteLoading() {
  return <PartnerDashboardLoadingSkeleton />
}
