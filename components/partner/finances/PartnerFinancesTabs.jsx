'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, LayoutDashboard, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PARTNER_FINANCES_TAB_IDS = ['overview', 'ledger', 'reports']

const TAB_ICONS = {
  overview: LayoutDashboard,
  ledger: ScrollText,
  reports: FileText,
}

const TAB_LABEL_KEYS = {
  overview: 'partnerFinances_tabOverview',
  ledger: 'partnerFinances_tabLedger',
  reports: 'partnerFinances_tabReports',
}

const TAB_TRIGGER_CLASS =
  'rounded-lg shrink-0 snap-start scroll-mx-2 min-h-[44px] px-3 gap-1.5 data-[state=active]:bg-brand data-[state=active]:text-white'

const TABS_LIST_CLASS =
  'mb-4 flex w-full overflow-x-auto h-auto gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm scrollbar-thin snap-x snap-proximity scroll-pl-2 scroll-pr-2 [-webkit-overflow-scrolling:touch]'

/** Horizontal tab nav for partner finances (Stage 186.1). Use inside `<Tabs>`. */
export function PartnerFinancesTabNav({ t, documentsCount = null }) {
  return (
    <TabsList className={TABS_LIST_CLASS}>
      {PARTNER_FINANCES_TAB_IDS.map((tab) => {
        const Icon = TAB_ICONS[tab]
        return (
          <TabsTrigger key={tab} value={tab} className={cn(TAB_TRIGGER_CLASS, 'text-sm')}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t(TAB_LABEL_KEYS[tab])}
            {tab === 'reports' && documentsCount != null && documentsCount > 0 ? (
              <span className="ml-0.5 tabular-nums rounded-full bg-brand/15 px-1.5 text-xs text-brand">
                {documentsCount}
              </span>
            ) : null}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}

export function partnerFinancesTabLabelKey(tabId) {
  return TAB_LABEL_KEYS[tabId] || TAB_LABEL_KEYS.overview
}
