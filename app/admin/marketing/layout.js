'use client';

import { MarketingSubNav } from '@/components/admin/marketing/MarketingSubNav';

export default function MarketingLayout({ children }) {
  return (
    <div className="space-y-5">
      <MarketingSubNav />
      {children}
    </div>
  );
}
