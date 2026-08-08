'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/admin/charts/ChartSkeleton';

const ReferralRoiDashboard = dynamic(
  () => import('@/components/admin/marketing/ReferralRoiDashboard'),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="min-h-[480px]" />,
  },
);

/** Stage 124.11 — Referral ROI & Marketing Intelligence (Phase D). */
export default function MarketingRoiPage() {
  return <ReferralRoiDashboard />;
}
