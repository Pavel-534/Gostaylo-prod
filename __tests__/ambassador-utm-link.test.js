import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAmbassadorUtmLink,
  formatAmbassadorLinkCaption,
  formatAmbassadorShareLink,
  stripAmbassadorTrackingParams,
} from '../lib/referral/ambassador-utm-link.js'

describe('ambassador-utm-link Stage 200.10', () => {
  const tagged =
    'https://airento.ru/u/user-mmhsxted-zon?utm_source=telegram&utm_medium=referral&utm_campaign=AIR-TEST'

  it('strips utm_* while keeping path', () => {
    assert.equal(stripAmbassadorTrackingParams(tagged), 'https://airento.ru/u/user-mmhsxted-zon')
  })

  it('formats clean share link and caption', () => {
    assert.equal(formatAmbassadorShareLink(tagged), 'https://airento.ru/u/user-mmhsxted-zon')
    assert.equal(formatAmbassadorLinkCaption(tagged), 'airento.ru/u/user-mmhsxted-zon')
  })

  it('rebuilds tagged link from clean base', () => {
    const clean = formatAmbassadorShareLink(tagged)
    assert.equal(
      buildAmbassadorUtmLink(clean, { channel: 'instagram', campaign: 'AIR-TEST' }),
      'https://airento.ru/u/user-mmhsxted-zon?utm_source=instagram&utm_medium=referral&utm_campaign=AIR-TEST',
    )
  })
})
