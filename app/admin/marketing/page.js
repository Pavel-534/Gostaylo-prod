'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/admin/charts/ChartSkeleton';

const MarketingDashboard = dynamic(
  () => import('@/components/admin/marketing/MarketingDashboard'),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="min-h-[480px]" />,
  },
);

/** Stage 124.2 — главный обзор маркетинга и рефералки (точка входа). */
export default function MarketingDashboardPage() {
  return <MarketingDashboard />;
}
