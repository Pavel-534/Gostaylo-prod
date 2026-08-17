/**
 * Stage 211.3 — partner finances reports UX (period-first, no money formula changes).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage211-3-partner-finances-reports-ux.test.js
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import { formatPartnerFinancesPeriodLabel } from '../lib/partner/partner-finances-period-label.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 211.3 — reports period UX', () => {
  it('formats full month, quarter, and partial ranges without UTC day shift', () => {
    assert.equal(formatPartnerFinancesPeriodLabel('2026-03-01', '2026-03-31', 'ru'), 'Март 2026')
    assert.match(formatPartnerFinancesPeriodLabel('2026-01-01', '2026-03-31', 'ru'), /2026/)
    assert.equal(formatPartnerFinancesPeriodLabel('2026-03-01', '2026-03-17', 'en'), '1–17 Mar 2026')
  })

  it('reports tab drops lifetime portfolio and gates the acts archive', () => {
    const tab = read('components/partner/finances/PartnerFinancesReportsTab.jsx')
    assert.doesNotMatch(tab, /PartnerFinancesPortfolioCards/)
    assert.match(tab, /PartnerFinancesPdfCard/)
    assert.match(tab, /PartnerFinancesPeriodPackCard/)
    assert.match(tab, /archiveOpen/)
    assert.match(tab, /PartnerFinancesDocuments/)

    const overview = read('components/partner/finances/PartnerFinancesOverviewTab.jsx')
    assert.match(overview, /PartnerFinancesPortfolioCards/)
    assert.match(overview, /partnerFinances_sectionPortfolio/)
  })

  it('header CSV and period pack expose selected-period chrome', () => {
    const header = read('components/partner/finances/PartnerFinancesHeader.jsx')
    assert.match(header, /partnerFinances_csvPeriodButton/)
    assert.match(header, /formatPartnerFinancesPeriodLabel/)

    const pack = read('components/partner/finances/PartnerFinancesPeriodPackCard.jsx')
    assert.match(pack, /partner-finances-earned-vs-paid-hint/)
    assert.match(pack, /partner-finances-docs-archive-cta/)
    assert.doesNotMatch(pack, /getPartnerBalance/)
  })
})
