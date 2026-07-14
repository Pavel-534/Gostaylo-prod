import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyReferralPitchTemplate,
  formatWelcomeBonusDisplayAmount,
  resolveWelcomeBonusThb,
} from '../lib/referral/referral-share-pitch-tokens.js'

describe('referral-share-pitch-tokens (Stage 179.3)', () => {
  it('resolveWelcomeBonusThb falls back to 500', () => {
    assert.equal(resolveWelcomeBonusThb(0), 500)
    assert.equal(resolveWelcomeBonusThb(null), 500)
    assert.equal(resolveWelcomeBonusThb(750), 750)
  })

  it('formatWelcomeBonusDisplayAmount uses retail rateMap per currency', () => {
    const rates = { THB: 1, RUB: 0.4, USD: 35 }
    assert.equal(formatWelcomeBonusDisplayAmount(500, 'THB', rates, 'ru'), '500 THB')
    assert.equal(formatWelcomeBonusDisplayAmount(500, 'RUB', rates, 'ru'), '₽1\u00a0250')
    assert.equal(formatWelcomeBonusDisplayAmount(500, 'USD', rates, 'en'), '$14.29')
  })

  it('applyReferralPitchTemplate substitutes welcomeAmount without RUB/THB pair', () => {
    const out = applyReferralPitchTemplate('До {welcomeAmount} в {brand}: {link}', {
      welcomeAmount: '₽1\u00a0250',
      brand: 'Airento',
      link: 'https://example.com/u/x',
    })
    assert.match(out, /₽1\u00a0250/)
    assert.doesNotMatch(out, /THB/)
    assert.match(out, /Airento/)
  })
})
