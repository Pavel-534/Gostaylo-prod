import { describe, expect, it } from '@jest/globals'
import {
  convertAmountThbWithMap,
} from '@/lib/finance/currency-converter-shared.js'
import {
  normalizeThbPerUnitRate,
  thbPerRubFromRubPerThb,
} from '@/lib/finance/thb-per-unit-rate.js'
import { formatPrice } from '@/lib/currency.js'

describe('thb-per-unit-rate RUB inversion guard', () => {
  it('normalizes inverted RUB/THB stored as rate_to_thb', () => {
    expect(normalizeThbPerUnitRate('RUB', 2.8)).toBeCloseTo(1 / 2.8, 6)
    expect(normalizeThbPerUnitRate('RUB', 0.357)).toBeCloseTo(0.357, 6)
  })

  it('converts 575 THB to ~1260+ RUB at mid rate (not ~216)', () => {
    const thbPerRub = thbPerRubFromRubPerThb(2.2)
    const rub = convertAmountThbWithMap(575, 'RUB', { RUB: thbPerRub })
    expect(rub).toBeGreaterThan(1200)
    expect(rub).toBeLessThan(1400)
  })

  it('repairs legacy inverted RUB row in rateMap', () => {
    const rub = convertAmountThbWithMap(575, 'RUB', { RUB: 2.8 })
    expect(rub).toBeGreaterThan(1200)
  })

  it('formatPrice matches convertAmountThbWithMap for RUB', () => {
    const rates = { RUB: 2.8 }
    const formatted = formatPrice(575, 'RUB', rates, 'ru')
    expect(formatted).toMatch(/₽1[\s\u00a0]?[23]\d{2}/)
  })
})
