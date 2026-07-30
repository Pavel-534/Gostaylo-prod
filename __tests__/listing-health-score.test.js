/**
 * Stage 199.2 — listing health score + calendar freshness + host SLA helpers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-health-score.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('calculateListingHealthScore', () => {
  it('scores full listing at 100 with empty tips', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const r = calculateListingHealthScore({
      description: 'x'.repeat(150),
      images: ['a', 'b', 'c', 'd', 'e'],
      metadata: {
        amenities: ['wifi', 'ac', 'pool'],
        check_in_time: '15:00',
        house_rules: 'No smoking. Quiet after 22:00.',
      },
    })
    assert.equal(r.score, 100)
    assert.equal(r.tips.length, 0)
    assert.ok(r.parts.every((p) => p.ok))
  })

  it('applies photo / description / amenities / rules weights', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const empty = calculateListingHealthScore({})
    assert.equal(empty.score, 0)
    assert.equal(empty.tips.length, 4)

    const photosOnly = calculateListingHealthScore({
      images: ['1', '2', '3', '4', '5'],
    })
    assert.equal(photosOnly.score, 30)
    assert.equal(photosOnly.tips.some((t) => t.key === 'photos'), false)

    const withDesc = calculateListingHealthScore({
      images: ['1', '2', '3', '4', '5'],
      description: 'y'.repeat(150),
    })
    assert.equal(withDesc.score, 50)

    const withAmenities = calculateListingHealthScore({
      images: ['1', '2', '3', '4', '5'],
      description: 'y'.repeat(150),
      metadata: { amenities: ['a', 'b', 'c'] },
    })
    assert.equal(withAmenities.score, 70)

    const tipPhotos = empty.tips.find((t) => t.key === 'photos')
    assert.equal(tipPhotos.tipParams.count, 5)
  })

  it('accepts check-in instructions + checkout as rules', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const r = calculateListingHealthScore({
      description: 'z'.repeat(150),
      images: Array.from({ length: 5 }, (_, i) => String(i)),
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
