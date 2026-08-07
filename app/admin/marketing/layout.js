'use client';

import { MarketingSubNav } from '@/components/admin/marketing/MarketingSubNav';

/** Stage 124.2 — общая оболочка раздела маркетинга. */
export default function MarketingLayout({ children }) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 max-sm:overflow-x-hidden">
      <div className="sticky app-sticky-below-header z-20 -mx-1 border-b border-slate-200/60 bg-brand-surface/95 pb-3 pt-0 backdrop-blur-md max-sm:border-slate-100">
        <MarketingSubNav />
      </div>
      {children}
    </div>
  );
}
