/**
 * Stage 211.1 — partner finances CSV/PDF export SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage211-1-partner-finances-export.test.js
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import {
  PARTNER_FINANCES_CSV_HEADERS,
  parsePartnerFinancesExportParams,
  partnerFinancesExportAxisColumn,
  joinPartnerFinancesCsv,
  buildPartnerFinancesExportFilename,
} from '../lib/services/partner-finances-export-format.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 211.1 — export params', () => {
  it('defaults format=csv and axis=created; maps checkout to check_out', () => {
    const parsed = parsePartnerFinancesExportParams({
      from: '2026-03-01',
      to: '2026-03-31',
    })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.format, 'csv')
    assert.equal(parsed.axis, 'created')
    assert.equal(partnerFinancesExportAxisColumn('created'), 'created_at')
    assert.equal(partnerFinancesExportAxisColumn('checkout'), 'check_out')
  })

  it('rejects invalid range, format, axis, and ranges over 366 days', () => {
    assert.equal(parsePartnerFinancesExportParams({ from: 'bad', to: '2026-01-02' }).error, 'INVALID_DATE_RANGE')
    assert.equal(
      parsePartnerFinancesExportParams({ from: '2026-01-02', to: '2026-01-01' }).error,
      'INVALID_DATE_RANGE',
    )
    assert.equal(
      parsePartnerFinancesExportParams({
        from: '2025-01-01',
        to: '2026-01-03',
        format: 'csv',
      }).error,
      'RANGE_TOO_LARGE',
    )
    assert.equal(
      parsePartnerFinancesExportParams({ from: '2026-01-01', to: '2026-01-02', format: 'xlsx' }).error,
      'INVALID_FORMAT',
    )
    assert.equal(
      parsePartnerFinancesExportParams({ from: '2026-01-01', to: '2026-01-02', axis: 'paid' }).error,
      'INVALID_AXIS',
    )
  })
})

describe('Stage 211.1 — CSV format', () => {
  it('prefixes UTF-8 BOM, required headers, and Excel-safe quoting', () => {
    const csv = joinPartnerFinancesCsv([
      ['bk-1', 'Villa, Rawai', '2026-03-10', '2026-03-20', '2026-03-25', '10000.00', '1500.00', '8500.00', 'PAID_ESCROW'],
    ])
    assert.equal(csv.startsWith('\uFEFF'), true)
    const lines = csv.replace(/^\uFEFF/, '').split('\n')
    assert.equal(lines[0], PARTNER_FINANCES_CSV_HEADERS.join(','))
    assert.equal(
      lines[1],
      'bk-1,"Villa, Rawai",2026-03-10,2026-03-20,2026-03-25,10000.00,1500.00,8500.00,PAID_ESCROW',
    )
  })

  it('filename uses site brand slug and finances-statement template', () => {
    const name = buildPartnerFinancesExportFilename({
      fromYmd: '2026-03-01',
      toYmd: '2026-03-31',
      format: 'csv',
    })
    assert.match(name, /finances-statement-2026-03-01-2026-03-31\.csv$/)
    assert.equal(name.includes('gostaylo'), false)
  })
})

describe('Stage 211.1 — wiring', () => {
  it('CSV renderer maps bookings through read-model gross/fee/net', () => {
    const src = read('lib/services/partner-finances-export.service.js')
    assert.match(src, /buildBookingFinancialSnapshotFromRow/)
    assert.match(src, /joinPartnerFinancesCsv/)
    assert.match(src, /snap\.gross/)
    assert.match(src, /snap\.fee/)
    assert.match(src, /snap\.net/)
    const formatSrc = read('lib/services/partner-finances-export-format.js')
    assert.match(formatSrc, /checkout' \? 'check_out'/)
  })

  it('API route is partner-gated and serves csv/pdf', () => {
    const src = read('app/api/v2/partner/finances-export/route.js')
    assert.match(src, /verifyPartnerAccess/)
    assert.match(src, /renderPartnerFinancialStatementCsv/)
    assert.match(src, /renderPartnerFinancialStatementPdf/)
    assert.match(src, /Content-Disposition/)
  })

  it('legacy PDF route stays as created_at alias on the shared loader', () => {
    const src = read('app/api/v2/partner/finances-statement-pdf/route.js')
    assert.match(src, /loadPartnerFinancesExportBookings/)
    assert.match(src, /axis: 'created'/)
  })

  it('hook downloads via finances-export and does not build a client CSV blob', () => {
    const hook = read('hooks/usePartnerFinances.js')
    assert.match(hook, /fetchPartnerFinancesExport/)
    assert.doesNotMatch(hook, /new Blob\(/)
    assert.doesNotMatch(hook, /gostaylo-finances/)
    assert.doesNotMatch(hook, /gostaylo-financial-statement/)
  })

  it('reports card exposes date axis toggle; header CSV is server-driven', () => {
    const card = read('components/partner/finances/PartnerFinancesPdfCard.jsx')
    assert.match(card, /partner-finances-export-axis/)
    assert.match(card, /partnerFinances_exportAxisCreated/)
    assert.match(card, /partnerFinances_exportAxisCheckout/)
    const header = read('components/partner/finances/PartnerFinancesHeader.jsx')
    assert.doesNotMatch(header, /bookingsLength/)
  })
})
