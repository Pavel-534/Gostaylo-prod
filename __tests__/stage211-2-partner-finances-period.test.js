/**
 * Stage 211.2 — partner finances period pack.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage211-2-partner-finances-period.test.js
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import {
  filterSettlementDocumentsByPeriod,
  sumPeriodSnapshotTotals,
  sumSettledPayoutsInPeriod,
  utcPeriodBounds,
} from '../lib/services/partner-finances-period-math.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 211.2 — period pack math', () => {
  it('sums booking snapshots without mixing escrow', () => {
    const totals = sumPeriodSnapshotTotals([
      { gross: 10000, fee: 1500, net: 8500 },
      { gross: 2000.555, fee: 200.444, net: 1800.111 },
    ])
    assert.equal(totals.bookingCount, 2)
    assert.equal(totals.totalGrossThb, 12000.56)
    assert.equal(totals.totalCommissionThb, 1700.44)
    assert.equal(totals.totalNetEarnedThb, 10300.11)
  })

  it('counts only PAID/COMPLETED payouts in the UTC period via processed_at', () => {
    const { fromIso, toIso } = utcPeriodBounds('2026-03-01', '2026-03-31')
    const paid = sumSettledPayoutsInPeriod(
      [
        {
          status: 'COMPLETED',
          gross_amount: 5000,
          processed_at: '2026-03-10T12:00:00.000Z',
        },
        {
          status: 'PAID',
          final_amount: 1200,
          created_at: '2026-03-20T00:00:00.000Z',
        },
        {
          status: 'PENDING',
          gross_amount: 9999,
          processed_at: '2026-03-15T00:00:00.000Z',
        },
        {
          status: 'COMPLETED',
          gross_amount: 400,
          processed_at: '2026-04-01T00:00:00.000Z',
        },
      ],
      fromIso,
      toIso,
    )
    assert.equal(paid.payoutCount, 2)
    assert.equal(paid.totalPaidOutThb, 6200)
  })

  it('filters settlement acts by generatedAt', () => {
    const { fromIso, toIso } = utcPeriodBounds('2026-03-01', '2026-03-31')
    const rows = filterSettlementDocumentsByPeriod(
      [
        { id: 'a', generatedAt: '2026-03-05T10:00:00.000Z', documentNo: 'PO-1' },
        { id: 'b', generatedAt: '2026-02-28T23:00:00.000Z', documentNo: 'PO-2' },
      ],
      fromIso,
      toIso,
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0].documentNo, 'PO-1')
  })
})

describe('Stage 211.2 — wiring', () => {
  it('period service uses read-model bookings, payouts table, and settlement-documents SSOT', () => {
    const src = read('lib/services/partner-finances-period.service.js')
    assert.match(src, /buildBookingFinancialSnapshotFromRow/)
    assert.match(src, /loadPartnerFinancesExportBookings/)
    assert.match(src, /listPartnerSettlementDocuments/)
    assert.match(src, /from\('payouts'\)/)
    assert.doesNotMatch(src, /EscrowService/)
  })

  it('lifetime finances-summary still owns escrow buckets', () => {
    const src = read('lib/services/partner-finances-summary.service.js')
    assert.match(src, /EscrowService.getPartnerBalance/)
    assert.match(src, /partner-finances-period.service/)
  })

  it('PDF header/footer consume periodTotals; export route passes the pack', () => {
    const pdf = read('lib/services/partner-finances-pdf.service.js')
    assert.match(pdf, /periodTotals/)
    assert.match(pdf, /Period pack — Gross/)
    assert.match(pdf, /Closing acts/)
    const route = read('app/api/v2/partner/finances-export/route.js')
    assert.match(route, /computePartnerFinancesPeriodPack/)
    assert.match(route, /periodTotals:/)
  })

  it('reports UI has quarter preset, period pack card, and archive-gated documents', () => {
    const card = read('components/partner/finances/PartnerFinancesPdfCard.jsx')
    assert.match(card, /partnerFinances_pdfThisQuarter/)
    const tab = read('components/partner/finances/PartnerFinancesReportsTab.jsx')
    assert.match(tab, /PartnerFinancesPeriodPackCard/)
    assert.match(tab, /PartnerFinancesDocuments/)
    assert.match(tab, /archiveOpen/)
    const pack = read('components/partner/finances/PartnerFinancesPeriodPackCard.jsx')
    assert.match(pack, /fetchPartnerSettlementDocumentDownloadUrl/)
    assert.match(pack, /partnerFinances_periodDocsTitle/)
  })
})
