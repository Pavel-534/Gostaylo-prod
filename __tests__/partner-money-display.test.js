import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatAbsoluteAmountInCurrency,
  formatPayoutRailAmount,
  getCurrencySymbolSafe,
} from '../lib/partner/partner-money-display.js'
import {
  mapLedgerDescription,
  mapLedgerEventType,
  mapLedgerSide,
} from '../lib/partner/ledger-display-labels.js'
import { getCurrencySymbol } from '../lib/currency.js'

describe('partner-money-display', () => {
  it('USDT uses ISO code suffix, not lone tugrik symbol', () => {
    const formatted = formatPayoutRailAmount(78655.04, 'USDT', 'ru')
    assert.match(formatted, /USDT$/)
    assert.doesNotMatch(formatted, /^₮/)
  })

  it('RUB uses ruble symbol prefix', () => {
    const formatted = formatAbsoluteAmountInCurrency(1000, 'RUB', 'ru')
    assert.match(formatted, /^₽/)
  })

  it('getCurrencySymbolSafe matches lib/currency SSOT', () => {
    assert.equal(getCurrencySymbolSafe('USDT'), getCurrencySymbol('USDT'))
    assert.equal(getCurrencySymbolSafe('RUB'), '₽')
  })
})

describe('ledger-display-labels', () => {
  const t = (key) =>
    ({
      partnerLedger_eventBookingPaymentCaptured: 'Оплата брони',
      partnerLedger_sideCredit: 'Зачисление',
      partnerLedger_descPartnerEarnings: 'Доход партнёра',
    })[key] || key

  it('maps known ledger event types', () => {
    assert.equal(mapLedgerEventType('BOOKING_PAYMENT_CAPTURED', t), 'Оплата брони')
  })

  it('maps CREDIT side', () => {
    assert.equal(mapLedgerSide('CREDIT', t), 'Зачисление')
  })

  it('maps Partner earnings description', () => {
    assert.equal(mapLedgerDescription('Partner earnings', t), 'Доход партнёра')
  })
})
