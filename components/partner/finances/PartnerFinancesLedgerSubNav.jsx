'use client'

import { PartnerFinancesPillSubNav } from '@/components/partner/finances/PartnerFinancesPillSubNav'

export const PARTNER_FINANCES_LEDGER_SUB_TAB_IDS = ['ledger', 'bookings']

const SUB_TAB_LABEL_KEYS = {
  ledger: 'partnerFinances_ledgerSubTabLedger',
  bookings: 'partnerFinances_ledgerSubTabBookings',
}

export function PartnerFinancesLedgerSubNav({ t, activeSubTab, onSubTabChange }) {
  const tabs = PARTNER_FINANCES_LEDGER_SUB_TAB_IDS.map((id) => ({
    id,
    label: t(SUB_TAB_LABEL_KEYS[id]),
  }))

  return (
    <PartnerFinancesPillSubNav
      ariaLabel={t('partnerFinances_tabLedger')}
      tabs={tabs}
      activeTab={activeSubTab}
      onTabChange={onSubTabChange}
    />
  )
}
