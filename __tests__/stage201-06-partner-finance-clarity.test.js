/**
 * Stage 201.06 — partner finance UX: no escrow double-count; pending-payment SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-06-partner-finance-clarity.test.js
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { PARTNER_PENDING_PAYMENT_BOOKING_STATUSES } from '../lib/booking/status-sets.js'
import { resolvePartnerDashboardInProcessingThb } from '../lib/partner/partner-dashboard-money.js'

const root = process.cwd()

describe('Stage 201.06 — partner finance clarity', () => {
  it('overview in-processing is frozen + thaw hold only (no pendingPayouts)', () => {
    assert.equal(
      resolvePartnerDashboardInProcessingThb({
        frozenBalanceThb: 1013594.68,
        thawHoldBalanceThb: 0,
        pendingPayoutsThb: 1013594.68,
      }),
      1013594.68,
    )
  })

  it('balance.service does not add PAID_ESCROW net to pendingPayouts', () => {
    const src = readFileSync(`${root}/lib/services/escrow/balance.service.js`, 'utf8')
    assert.match(src, /escrowBalance \+= net/)
    assert.doesNotMatch(src, /pendingPayouts \+= net/)
  })

  it('pending-payment SSOT includes checkout window; stats and finances share it', () => {
    assert.equal(PARTNER_PENDING_PAYMENT_BOOKING_STATUSES.has('PENDING'), true)
    assert.equal(PARTNER_PENDING_PAYMENT_BOOKING_STATUSES.has('CONFIRMED'), true)
    assert.equal(PARTNER_PENDING_PAYMENT_BOOKING_STATUSES.has('AWAITING_PAYMENT'), true)
    assert.equal(PARTNER_PENDING_PAYMENT_BOOKING_STATUSES.has('PAID_ESCROW'), false)

    const stats = readFileSync(`${root}/app/api/v2/partner/stats/route.js`, 'utf8')
    const finances = readFileSync(`${root}/lib/services/partner-finances-summary.service.js`, 'utf8')
    assert.match(stats, /PARTNER_PENDING_PAYMENT_BOOKING_STATUSES/)
    assert.match(finances, /PARTNER_PENDING_PAYMENT_BOOKING_STATUSES/)
    assert.doesNotMatch(stats, /pendingStatuses = \['PENDING'\]/)
  })

  it('header wallet CTA: partner → finances; no hosting jargon', () => {
    const header = readFileSync(`${root}/components/wallet/HeaderWalletCompact.jsx`, 'utf8')
    assert.match(header, /\/partner\/finances/)
    assert.match(header, /stage73_walletHeaderFinancesCta/)

    const i18n = readFileSync(`${root}/lib/translations/slices/profile-app-referral.js`, 'utf8')
    assert.match(i18n, /Эскроу по объявлениям/)
    assert.doesNotMatch(i18n, /хостинг/)
    assert.match(i18n, /Перейти в Финансы/)
  })
})
