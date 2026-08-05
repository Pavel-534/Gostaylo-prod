/**
 * Stage 199.2 / 200.28 — listing health score + calendar freshness + host SLA helpers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-health-score.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('calculateListingHealthScore', () => {
  it('scores full stay listing at 100 with empty tips', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const r = calculateListingHealthScore({
      wizardProfile: 'stay',
      description: 'x'.repeat(80),
      images: ['a'],
      metadata: {
        amenities: ['wifi', 'ac', 'pool'],
        check_in_time: '15:00',
        house_rules: 'No smoking. Quiet after 22:00.',
      },
    })
    assert.equal(r.score, 100)
    assert.equal(r.mode, 'stay')
    assert.equal(r.tips.length, 0)
    assert.ok(r.parts.every((p) => p.ok))
  })

  it('applies photo / description / amenities / rules weights for stay', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const empty = calculateListingHealthScore({ wizardProfile: 'stay' })
    assert.equal(empty.score, 0)
    assert.equal(empty.tips.length, 4)

    const photosOnly = calculateListingHealthScore({
      wizardProfile: 'stay',
      images: ['1'],
    })
    assert.equal(photosOnly.score, 30)
    assert.equal(photosOnly.tips.some((t) => t.key === 'photos'), false)

    const withDesc = calculateListingHealthScore({
      wizardProfile: 'stay',
      images: ['1'],
      description: 'y'.repeat(80),
    })
    assert.equal(withDesc.score, 50)

    const withAmenities = calculateListingHealthScore({
      wizardProfile: 'stay',
      images: ['1'],
      description: 'y'.repeat(80),
      metadata: { amenities: ['a', 'b', 'c'] },
    })
    assert.equal(withAmenities.score, 70)

    const tipPhotos = empty.tips.find((t) => t.key === 'photos')
    assert.equal(tipPhotos.tipParams.count, 1)
  })

  it('transport mode uses vehicle features + pickup (not house rules)', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const r = calculateListingHealthScore({
      wizardProfile: 'transport',
      description: 'z'.repeat(80),
      images: ['1'],
      metadata: {
        amenities: ['a', 'b', 'c'],
        check_in_instructions: 'Meet at parking lot B near the mall entrance.',
      },
    })
    assert.equal(r.mode, 'transport')
    assert.equal(r.score, 100)
    assert.ok(r.parts.some((p) => p.key === 'features'))
    assert.ok(r.parts.some((p) => p.key === 'pickup'))
    assert.ok(!r.parts.some((p) => p.key === 'rules'))
    assert.ok(!r.parts.some((p) => p.key === 'amenities'))
  })

  it('accepts check-in instructions + checkout as stay rules', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const r = calculateListingHealthScore({
      wizardProfile: 'stay',
      description: 'z'.repeat(80),
      images: ['1'],
      metadata: {
        amenities: ['wifi', 'parking', 'kitchen'],
        check_in_instructions: 'x'.repeat(40),
        check_out_time: '11:00',
      },
    })
    assert.equal(r.score, 100)
  })
})

describe('evaluateCalendarFreshness', () => {
  it('marks stale when last activity older than threshold', async () => {
    const { evaluateCalendarFreshness, CALENDAR_FRESHNESS_STALE_DAYS } = await import(
      '../lib/partner/calendar-freshness.js'
    )
    const nowMs = Date.parse('2026-07-30T12:00:00.000Z')
    const stale = evaluateCalendarFreshness(
      {
        status: 'ACTIVE',
        syncSettings: { last_sync: '2026-07-01T12:00:00.000Z' },
      },
      { nowMs },
    )
    assert.equal(stale.stale, true)
    assert.ok(stale.ageDays >= CALENDAR_FRESHNESS_STALE_DAYS)

    const fresh = evaluateCalendarFreshness(
      {
        status: 'ACTIVE',
        updatedAt: '2026-07-28T12:00:00.000Z',
      },
      { nowMs },
    )
    assert.equal(fresh.stale, false)
  })
})

describe('resolveHostResponseSlaBadge', () => {
  it('formats minutes / fast / fallback', async () => {
    const { resolveHostResponseSlaBadge } = await import('../lib/listing/host-response-sla.js')
    assert.equal(resolveHostResponseSlaBadge(null).i18nKey, 'listingHostSla_fallback')
    assert.equal(
      resolveHostResponseSlaBadge({
        avgInitialResponseMinutes30d: 12,
        initialResponseSampleCount30d: 5,
      }).kind,
      'fast',
    )
    const mid = resolveHostResponseSlaBadge({
      avgInitialResponseMinutes30d: 45,
      initialResponseSampleCount30d: 4,
    })
    assert.equal(mid.kind, 'minutes')
    assert.equal(mid.i18nParams.minutes, 45)
  })
})
