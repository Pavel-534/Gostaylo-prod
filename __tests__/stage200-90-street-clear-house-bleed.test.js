/**
 * Stage 200.90 — clearing street must not resurrect house number in street field.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-90-street-clear-house-bleed.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Stage 200.90 — street clear vs house bleed', () => {
  it('keeps empty street when metadata.street is "" and address is only house', async () => {
    const {
      resolveWizardStreetDisplay,
      resolveWizardHouseDisplay,
      composeWizardStreetHouseAddress,
    } = await import('@/lib/geo/wizard-street-house-display.js')

    const afterClearStreet = {
      address: '12',
      metadata: { street: '', house_number: '12' },
    }
    assert.equal(resolveWizardStreetDisplay(afterClearStreet), '')
    assert.equal(resolveWizardHouseDisplay(afterClearStreet), '12')

    assert.equal(composeWizardStreetHouseAddress('', '12'), '')
    assert.equal(composeWizardStreetHouseAddress('Славянская', '12'), 'Славянская, 12')
    assert.equal(composeWizardStreetHouseAddress('Славянская', ''), 'Славянская')

    const afterCompose = {
      address: composeWizardStreetHouseAddress('', '12'),
      metadata: { street: '', house_number: '12' },
    }
    assert.equal(afterCompose.address, '')
    assert.equal(resolveWizardStreetDisplay(afterCompose), '')
    assert.equal(resolveWizardHouseDisplay(afterCompose), '12')
  })

  it('legacy address still splits when metadata keys absent', async () => {
    const { resolveWizardStreetDisplay, resolveWizardHouseDisplay } = await import(
      '@/lib/geo/wizard-street-house-display.js'
    )
    const legacy = { address: 'Ленина, 5', metadata: {} }
    assert.equal(resolveWizardStreetDisplay(legacy), 'Ленина')
    assert.equal(resolveWizardHouseDisplay(legacy), '5')
  })
})
