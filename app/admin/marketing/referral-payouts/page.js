'use client';

import { Suspense } from 'react';
import { ReferralPayoutOpsDesk } from '@/components/admin/marketing/ReferralPayoutOpsDesk';

export default function ReferralPayoutOpsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500 p-6">Загрузка пульта выплат…</p>}>
      <ReferralPayoutOpsDesk />
    </Suspense>
  );
}
