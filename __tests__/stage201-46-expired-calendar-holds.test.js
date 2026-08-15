/**
 * Stage 201.47 — expired inquiry/invoice holds must not appear as iCal in the wizard.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-46-expired-calendar-holds.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  BLOCK_DISPLAY_KIND,
  blocksForPartnerIcalImportSummary,
  isCalendarBlockDateRangePast,
  isCalendarBlockExpired,
  partitionPartnerListingBlocks,
} from '../lib/calendar/block-source-display.js'

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.47 — expired calendar holds', () => {
  it('expired holds are not iCal; live iCal stays in ical bucket', () => {
    const now = Date.parse('2026-08-16T00:00:00.000Z')
    const parts = partitionPartnerListingBlocks(
      [
        {
          id: '1',
          source: 'inquiry_hold',
          expires_at: '2026-06-29T00:00:00.000Z',
          reason: 'Inquiry b-41da4900 — soft hold (48h)',
        },
        {
          id: '2',
          source: 'invoice_hold',
          expires_at: '2026-06-28T00:00:00.000Z',
          reason: 'Invoice inv-mqwgcuey-iks1 — payment pending (24h)',
        },
        {
          id: '3',
          source: 'manual',
          reason: 'Owner stay',
        },
        {
          id: '4',
          source: 'https://calendar.airbnb.com/feed.ics',
          reason: 'Airbnb busy',
        },
      ],
      now,
    )
    assert.equal(parts.manual.length, 1)
    assert.equal(parts.ical.length, 1)
    assert.equal(parts.holds.length, 0)
    assert.equal(isCalendarBlockExpired({ expires_at: '2026-06-29T00:00:00.000Z' }, now), true)
    assert.equal(BLOCK_DISPLAY_KIND.INQUIRY_HOLD, 'INQUIRY_HOLD')
  })

  it('import summary hides holds and past iCal nights', () => {
    const now = Date.parse('2026-08-16T00:00:00.000Z')
    const summary = blocksForPartnerIcalImportSummary(
      [
        {
          id: 'hold',
          source: 'invoice_hold',
          expires_at: '2026-08-20T00:00:00.000Z',
          end_date: '2026-08-20',
          reason: 'Invoice inv-live — payment pending (24h)',
        },
        {
          id: 'past',
          source: 'https://calendar.airbnb.com/feed.ics',
          end_date: '2026-07-13',
          reason: 'Airbnb busy',
        },
        {
          id: 'upcoming',
          source: 'https://calendar.airbnb.com/feed.ics',
          end_date: '2026-09-01',
          reason: 'Airbnb busy',
        },
      ],
      { nowMs: now, todayYmd: '2026-08-16' },
    )
    assert.equal(summary.length, 1)
    assert.equal(summary[0].id, 'upcoming')
    assert.equal(isCalendarBlockDateRangePast({ end_date: '2026-07-13' }, '2026-08-16'), true)
  })

  it('wizard and cron use partition + purge, not source !== manual', () => {
    const avail = read('components/availability-calendar.jsx')
    assert.match(avail, /partitionPartnerListingBlocks/)
    assert.doesNotMatch(avail, /source !== 'manual'/)

    const sync = read('components/calendar-sync-manager.jsx')
    assert.match(sync, /blocksForPartnerIcalImportSummary/)
    assert.doesNotMatch(sync, /source !== 'manual'/)

    const drafts = read('app/api/cron/cleanup-drafts/route.js')
    assert.match(drafts, /purgeExpiredCalendarHoldBlocks/)

    const cleanup = read('lib/e2e/cleanup-test-data.service.js')
    assert.match(cleanup, /purgeExpiredCalendarHoldBlocks/)
    assert.match(cleanup, /calendar_blocks/)
  })
})
