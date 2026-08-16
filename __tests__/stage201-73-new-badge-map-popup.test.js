/**
 * Stage 201.73 — NEW partner trust pill copy + reputation gate smoke.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeReliabilityFromCounts } from '../lib/services/reputation/formula.js'
import { partnerShellUi } from '../lib/translations/slices/partner-shell.js'

describe('Stage 201.73 partner NEW badge', () => {
  it('tier NEW until first completed stay / negative signal', () => {
    const fresh = computeReliabilityFromCounts({
      completedTotal: 0,
      weightedDisputedUnits: 0,
      penaltyPointsSumWeighted: 0,
      penaltyCountWeighted: 0,
      partnerDeclinedWeighted: 0,
      partnerCancelWeighted: 0,
    })
    assert.equal(fresh.tier, 'NEW')
    assert.equal(fresh.reliabilityPercent, null)

    const afterStay = computeReliabilityFromCounts({
      completedTotal: 1,
      weightedDisputedUnits: 0,
      penaltyPointsSumWeighted: 0,
      penaltyCountWeighted: 0,
      partnerDeclinedWeighted: 0,
      partnerCancelWeighted: 0,
    })
    assert.notEqual(afterStay.tier, 'NEW')
    assert.ok(Number.isFinite(afterStay.reliabilityPercent))
  })

  it('i18n NEW label is short marketplace cue (not long platform copy)', () => {
    assert.equal(partnerShellUi.ru.partnerTrust_newPartner, 'Новый')
    assert.equal(partnerShellUi.en.partnerTrust_newPartner, 'New')
    assert.ok(String(partnerShellUi.ru.partnerTrust_newPartnerHint || '').length > 20)
  })
})
