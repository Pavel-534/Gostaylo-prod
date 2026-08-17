/**
 * Stage 201.94 — on-site cleaning/deposit stay in listing THB (no header FX).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-94-onsite-fees-thb.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatGuestOnSiteFeeAmount } from '@/lib/booking/guest-price-exclusions.js'
import { listingsPartnerWizardUi } from '@/lib/translations/listings-partner-wizard.js'
import { orderFlowUi } from '@/lib/translations/slices/order-flow.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.94 — on-site fees in listing THB', () => {
  it('formats the partner amount as THB without converting to RUB', () => {
    const line = formatGuestOnSiteFeeAmount(1000, 'ru')
    assert.match(line, /1\s?000 THB/)
    assert.doesNotMatch(line, /₽|RUB/)
  })

  it('guest copy is a plain label + amount (no estimate / may-be-charged hedge)', () => {
    assert.equal(orderFlowUi.ru.orderExcluded_stayCleaning, 'Уборка: {{amount}}')
    assert.equal(orderFlowUi.ru.orderExcluded_stayDeposit, 'Депозит: {{amount}}')
    assert.doesNotMatch(orderFlowUi.ru.orderExcluded_stayCleaning, /ориентир|может оплачиваться/)
    assert.doesNotMatch(orderFlowUi.ru.orderExcluded_stayDeposit, /ориентир|может удерживаться/)
    assert.doesNotMatch(listingsPartnerWizardUi.ru.fieldCleaningFeeThb, /Ориентир/)
  })

  it('PDP and booking widget format exclusions via on-site THB helper, not header FX', () => {
    const pdp = read('components/listing/ListingGuestFeeHints.jsx')
    assert.match(pdp, /formatGuestOnSiteFeeAmount/)
    assert.doesNotMatch(pdp, /formatPrice/)

    const widget = read('components/listing/booking/BookingPriceBreakdown.jsx')
    assert.match(widget, /formatGuestOnSiteFeeAmount/)
    assert.doesNotMatch(widget, /fmt\(hint\.amountThb\)/)
  })
})
