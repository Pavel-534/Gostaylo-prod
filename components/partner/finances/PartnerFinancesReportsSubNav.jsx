'use client'

import { PartnerFinancesPillSubNav } from '@/components/partner/finances/PartnerFinancesPillSubNav'

export const PARTNER_FINANCES_REPORTS_SUB_TAB_IDS = ['statements', 'payouts', 'help']

const SUB_TAB_LABEL_KEYS = {
  statements: 'partnerFinances_reportsSubTabStatements',
  payouts: 'partnerFinances_reportsSubTabPayouts',
  help: 'partnerFinances_reportsSubTabHelp',
}

/** Sub-tabs inside «Отчёты и акты» (Stage 186.2c). */
export function PartnerFinancesReportsSubNav({ t, activeSubTab, onSubTabChange }) {
  const tabs = PARTNER_FINANCES_REPORTS_SUB_TAB_IDS.map((id) => ({
    id,
    label: t(SUB_TAB_LABEL_KEYS[id]),
  }))

  return (
    <PartnerFinancesPillSubNav
      ariaLabel={t('partnerFinances_tabReports')}
      tabs={tabs}
      activeTab={activeSubTab}
      onTabChange={onSubTabChange}
    />
  )
}
