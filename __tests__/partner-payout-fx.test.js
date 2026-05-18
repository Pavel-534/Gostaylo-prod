import { describe, it, expect } from '@jest/globals'
import {
  convertThbToPayoutCurrency,
  resolvePayoutCurrency,
  getRubPayoutSpreadPct,
} from '@/lib/partner/partner-payout-fx.js'

describe('partner-payout-fx', () => {
  it('resolvePayoutCurrency detects RUB and USDT rails', () => {
    expect(resolvePayoutCurrency('pm-bank-ru', { channel: 'BANK', currency: 'RUB' })).toBe('RUB')
    expect(resolvePayoutCurrency('pm-usdt-trc20', { channel: 'CRYPTO', currency: 'USDT' })).toBe(
      'USDT',
    )
  })

  it('RUB conversion applies platform spread (partner receives less RUB)', async () => {
    const rawMap = { THB: 1, RUB: 2.5 }
    const thb = 10000
    const fx = await convertThbToPayoutCurrency(thb, 'RUB', 'pm-bank-ru', { rawRateMap: rawMap })
    const mid = thb / 2.5
    const spread = getRubPayoutSpreadPct()
    expect(fx.midAmountInPayoutCurrency).toBeCloseTo(mid, 2)
    expect(fx.amountInPayoutCurrency).toBeCloseTo(mid * (1 - spread / 100), 2)
    expect(fx.amountInPayoutCurrency).toBeLessThan(mid)
  })

  it('USDT conversion uses clean mid rate', async () => {
    const rawMap = { THB: 1, USDT: 35 }
    const fx = await convertThbToPayoutCurrency(3500, 'USDT', 'pm-usdt-trc20', { rawRateMap: rawMap })
    expect(fx.amountInPayoutCurrency).toBe(100)
    expect(fx.spreadPct).toBe(0)
  })
})
