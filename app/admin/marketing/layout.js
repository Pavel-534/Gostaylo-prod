'use client';

import { MarketingSubNav } from '@/components/admin/marketing/MarketingSubNav';
import {
  WORKSPACE_SCROLL_STICKY_BLEED_CLASS,
  WORKSPACE_SCROLL_STICKY_CLASS,
} from '@/lib/layout/workspace-shell';
import { cn } from '@/lib/utils';

/** Stage 124.2 — общая оболочка раздела маркетинга. */
export default function MarketingLayout({ children }) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 max-sm:overflow-x-hidden">
      <div
        className={cn(
          WORKSPACE_SCROLL_STICKY_CLASS,
          WORKSPACE_SCROLL_STICKY_BLEED_CLASS,
          'mb-1 border-slate-200/90 bg-brand-surface/98 pb-3 pt-2 backdrop-blur-md',
        )}
      >
        <MarketingSubNav />
      </div>
      {children}
    </div>
  );
}
