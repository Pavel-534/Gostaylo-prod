'use client'

import { LayoutDashboard, ScrollText, FileText } from 'lucide-react'
import { PartnerFinancesPillSubNav } from '@/components/partner/finances/PartnerFinancesPillSubNav'

export const PARTNER_FINANCES_TAB_IDS = ['overview', 'ledger', 'reports']

const TAB_LABEL_KEYS = {
  overview: 'partnerFinances_tabOverview',
  ledger: 'partnerFinances_tabLedger',
  reports: 'partnerFinances_tabReports',
}

/** Horizontal scrollable tab nav for partner finances (Stage 186.1 / 185.2). */
export function PartnerFinancesTabNav({ t, documentsCount = null, activeTab, onTabChange }) {
  const tabs = PARTNER_FINANCES_TAB_IDS.map((tab) => {
    let label = t(TAB_LABEL_KEYS[tab])
    if (tab === 'reports' && documentsCount != null && documentsCount > 0) {
      label = `${label} (${documentsCount})`
    }
    return { id: tab, label }
  })

  return (
    <PartnerFinancesPillSubNav
      ariaLabel={t('partnerFinances_tabsAria')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  )
}

export function partnerFinancesTabLabelKey(tabId) {
  return TAB_LABEL_KEYS[tabId] || TAB_LABEL_KEYS.overview
}

/** @deprecated Icons kept for tests/docs; nav is text-only pill scroll. */
export const PARTNER_FINANCES_TAB_ICONS = {
  overview: LayoutDashboard,
  ledger: ScrollText,
  reports: FileText,
}
