/**
 * Stage 210.6 — Concierge mapping profiles + validate-payload.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-6-concierge-mapping.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 210.6 — show_property_v1 validator', () => {
  it('requires high-season price and accepts a valid package', async () => {
    const { showPropertyV1 } = await import(
      '../lib/services/concierge/mapping-profiles/show_property_v1.js'
    )

    const missingHigh = showPropertyV1.normalizeListing({
      externalId: 'JU208',
      title: 'Halo JU208',
      basePriceThb: 3300,
      seasons: [
        {
          startDate: '2026-05-01',
          endDate: '2026-10-31',
          priceDaily: 2500,
          label: 'Low',
          seasonType: 'low',
        },
      ],
    })
    assert.equal(missingHigh.ok, false)
    assert.equal(missingHigh.code, 'MISSING_HIGH_SEASON_PRICE')
    assert.match(missingHigh.error, /высокого сезона/)

    const ok = showPropertyV1.normalizeListing({
      externalId: 'JU208',
      title: 'Halo JU208',
      basePriceThb: 3300,
      geo: { lat: 7.8, lng: 98.3, addressText: 'Kata' },
      seasons: [
        {
          startDate: '2026-12-15',
          endDate: '2027-01-15',
          priceDaily: 4500,
          label: 'High',
          seasonType: 'high',
        },
        {
          startDate: '2026-05-01',
          endDate: '2026-10-31',
          priceDaily: 2500,
          seasonType: 'low',
        },
      ],
      images: ['https://cdn.example/a.jpg'],
    })
    assert.equal(ok.ok, true)
    assert.equal(ok.listing.seasons.length, 2)
    assert.equal(ok.listing.basePriceThb, 3300)

    const pkg = showPropertyV1.validatePackage([
      {
        externalId: 'A1',
        title: 'A',
        basePriceThb: 1000,
        seasons: [
          {
            startDate: '2026-12-01',
            endDate: '2027-01-31',
            priceDaily: 2000,
            seasonType: 'high',
          },
        ],
      },
    ])
    assert.equal(pkg.ok, true)
  })

  it('generic profile converts currency with explicit rate', async () => {
    const { genericConciergeV1 } = await import(
      '../lib/services/concierge/mapping-profiles/generic_concierge_v1.js'
    )
    const res = genericConciergeV1.normalizeListing(
      {
        externalId: 'X1',
        title: 'Unit',
        amount: 100,
        currency: 'USD',
      },
      { rateToThb: { USD: 35 } },
    )
    assert.equal(res.ok, true)
    assert.equal(res.listing.basePriceThb, 3500)
  })
})

describe('Stage 210.6 — validate-payload service + route', () => {
  it('returns valid summary without DB and probes images via mock fetch', async () => {
    const { validateConciergePayload } = await import(
      '../lib/services/concierge/mapping-profiles/validate-payload.service.js'
    )

    const fetchImpl = async (url, init) => {
      assert.match(url, /^https:\/\//)
      return {
        ok: true,
        status: init?.method === 'HEAD' ? 200 : 206,
        headers: {
          get(name) {
            if (name === 'content-type') return 'image/jpeg'
            return null
          },
        },
      }
    }

    const bad = await validateConciergePayload({
      mappingProfile: 'show_property_v1',
      checkImageUrls: false,
      listings: [
        {
          externalId: 'NOHIGH',
          title: 'No high',
          basePriceThb: 1000,
          seasons: [
            {
              startDate: '2026-06-01',
              endDate: '2026-08-01',
              priceDaily: 900,
              seasonType: 'low',
            },
          ],
        },
      ],
    })
    assert.equal(bad.valid, false)
    assert.ok(bad.summary.errors.some((e) => e.code === 'MISSING_HIGH_SEASON_PRICE'))

    const good = await validateConciergePayload({
      mappingProfile: 'show_property_v1',
      checkImageUrls: true,
      fetchImpl,
      listings: [
        {
          externalId: 'JU208',
          title: 'Halo',
          basePriceThb: 3300,
          seasons: [
            {
              startDate: '2026-12-15',
              endDate: '2027-01-15',
              priceDaily: 4500,
              seasonType: 'high',
            },
          ],
          images: ['https://cdn.example/villa.jpg'],
        },
      ],
    })
    assert.equal(good.valid, true)
    assert.equal(good.summary.totalListings, 1)
    assert.equal(good.summary.totalSeasons, 1)
    assert.ok(Array.isArray(good.summary.warnings))
  })

  it('admin validate-payload route is wired', () => {
    const route = read('app/api/v2/admin/concierge/validate-payload/route.js')
    assert.match(route, /validateConciergePayload/)
    assert.match(route, /ADMIN/)
    assert.match(route, /listMappingProfiles/)

    const prompt = read('docs/runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md')
    assert.match(prompt, /show_property_v1/)
    assert.match(prompt, /validate-payload/)
    assert.match(prompt, /ingest/)
  })
})
