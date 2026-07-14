'use client'

import { cn } from '@/lib/utils'

export const PARTNER_FINANCES_PILL_SUB_NAV_CLASS =
  'mb-4 flex w-full overflow-x-auto h-auto gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm scrollbar-thin snap-x snap-proximity scroll-pl-2 scroll-pr-2 [-webkit-overflow-scrolling:touch]'

export const PARTNER_FINANCES_PILL_TRIGGER_CLASS =
  'rounded-lg shrink-0 snap-start scroll-mx-2 min-h-[44px] px-3 text-sm'

/**
 * Shared pill sub-nav for partner finances tabs (Stage 186.2b+).
 * @param {{ id: string, label: string }[]} tabs
 */
export function PartnerFinancesPillSubNav({
  ariaLabel,
  tabs,
  activeTab,
  onTabChange,
  className,
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(PARTNER_FINANCES_PILL_SUB_NAV_CLASS, className)}>
      {tabs.map(({ id, label }) => {
        const isActive = activeTab === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => onTabChange(id)}
            className={cn(
              PARTNER_FINANCES_PILL_TRIGGER_CLASS,
              isActive ? 'bg-brand text-white font-medium' : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
