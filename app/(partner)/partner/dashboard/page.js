'use client'

import dynamic from 'next/dynamic'
import { PartnerDashboardLoadingSkeleton } from '@/components/partner/dashboard/partner-dashboard-widgets'

const PartnerDashboardPageContent = dynamic(
  () => import('@/components/partner/dashboard/PartnerDashboardPageContent'),
  {
    loading: () => <PartnerDashboardLoadingSkeleton />,
  },
)

/** Stage 111.0 — партнёрский дашборд; dynamic import для быстрого first paint на mobile PWA. */
export default function PartnerDashboard() {
  return <PartnerDashboardPageContent />
}
