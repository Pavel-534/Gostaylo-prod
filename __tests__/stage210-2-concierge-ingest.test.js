/**
 * Stage 210.2 — Concierge Supply Slice 2 (provision + ingest).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-2-concierge-ingest.test.js
 */

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function makeMockDb(handlers) {
  return {
    from(table) {
      const h = handlers[table] || {}
      const state = { table, filters: [], payload: null, op: 'select' }
      const chain = {
        select() {
          state.op = 'select'
          return chain
        },
        insert(payload) {
          state.op = 'insert'
          state.payload = payload
          return chain
        },
        update(payload) {
          state.op = 'update'
          state.payload = payload
          return chain
        },
        delete() {
          state.op = 'delete'
          return chain
        },
        eq(col, val) {
          state.filters.push({ col, val })
          return chain
        },
        limit() {
          return chain
        },
        maybeSingle: async () => {
          if (typeof h.maybeSingle === 'function') return h.maybeSingle(state)
          return { data: null, error: null }
        },
        single: async () => {
          if (typeof h.single === 'function') return h.single(state)
          return { data: null, error: null }
        },
        then(resolve, reject) {
          // await chain (e.g. select().eq().limit(1) or insert without single)
          const run = async () => {
            if (typeof h.execute === 'function') return h.execute(state)
            return { data: [], error: null }
          }
          return run().then(resolve, reject)
        },
      }
      return chain
    },
  }
}

describe('Stage 210.2 — concierge helpers', () => {
  it('filters https images and builds ical sync_settings', async () => {
    const {
      filterHttpsImageUrls,
      buildConciergeSyncSettings,
      validateConciergeListingItem,
      normalizeConciergeEmail,
    } = await import('../lib/services/concierge/concierge-supply.service.js')

    assert.deepEqual(
      filterHttpsImageUrls([
        'https://cdn.example/a.jpg',
        'http://insecure.example/b.jpg',
        'ftp://x',
        'https://cdn.example/c.jpg',
      ]),
      ['https://cdn.example/a.jpg', 'https://cdn.example/c.jpg'],
    )

    assert.equal(buildConciergeSyncSettings(''), null)
    const sync = buildConciergeSyncSettings('https://airbnb.com/calendar/ical/123.ics')
    assert.equal(sync.auto_sync, true)
    assert.equal(sync.sources[0].url, 'https://airbnb.com/calendar/ical/123.ics')
    assert.equal(sync.sources[0].platform, 'other')
    assert.equal(sync.sources[0].enabled, true)

    assert.equal(normalizeConciergeEmail('  A@B.COM '), 'a@b.com')

    const bad = validateConciergeListingItem({ externalId: 'X', title: 'T', basePriceThb: 0 })
    assert.equal(bad.ok, false)

    const good = validateConciergeListingItem({
      externalId: 'JU208',
      title: 'Halo',
      basePriceThb: 3300,
      seasons: [{ startDate: '2026-12-15', endDate: '2027-01-15', priceDaily: 3300 }],
      images: ['https://x/a.jpg'],
    })
    assert.equal(good.ok, true)
    assert.equal(good.value.externalId, 'JU208')
  })
})

describe('Stage 210.2 — provision shadow partner', () => {
  it('reuses existing shadow profile (idempotent)', async () => {
    const { provisionConciergeShadowPartner } = await import(
      '../lib/services/concierge/concierge-supply.service.js'
    )
    const existing = {
      id: 'partner-shadow-1',
      email: 'vasya@example.com',
      role: 'PARTNER',
      is_shadow: true,
    }
    const db = makeMockDb({
      profiles: {
        maybeSingle: async () => ({ data: existing, error: null }),
      },
    })
    const res = await provisionConciergeShadowPartner({
      email: 'Vasya@Example.com',
      db,
    })
    assert.equal(res.ok, true)
    assert.equal(res.reused, true)
    assert.equal(res.profile.id, 'partner-shadow-1')
  })

  it('rejects non-shadow email collision', async () => {
    const { provisionConciergeShadowPartner } = await import(
      '../lib/services/concierge/concierge-supply.service.js'
    )
    const db = makeMockDb({
      profiles: {
        maybeSingle: async () => ({
          data: { id: 'user-1', email: 'real@example.com', is_shadow: false, role: 'PARTNER' },
          error: null,
        }),
      },
    })
    const res = await provisionConciergeShadowPartner({ email: 'real@example.com', db })
    assert.equal(res.ok, false)
    assert.equal(res.code, 'EMAIL_ALREADY_REGISTERED')
    assert.equal(res.status, 409)
  })

  it('creates new shadow PARTNER', async () => {
    const { provisionConciergeShadowPartner } = await import(
      '../lib/services/concierge/concierge-supply.service.js'
    )
    let inserted = null
    const db = makeMockDb({
      profiles: {
        maybeSingle: async () => ({ data: null, error: null }),
        single: async (state) => {
          inserted = state.payload
          return {
            data: {
              id: inserted.id,
              email: inserted.email,
              role: inserted.role,
              is_shadow: inserted.is_shadow,
              first_name: inserted.first_name,
              last_name: inserted.last_name,
              phone: inserted.phone,
              shadow_claimed_at: null,
              created_at: inserted.created_at,
            },
            error: null,
          }
        },
      },
    })
    const res = await provisionConciergeShadowPartner({
      email: 'new-shadow@example.com',
      fullName: 'Vasya Pupkin',
      phone: '+66111',
      db,
    })
    assert.equal(res.ok, true)
    assert.equal(res.reused, false)
    assert.equal(res.status, 201)
    assert.equal(inserted.role, 'PARTNER')
    assert.equal(inserted.is_shadow, true)
    assert.equal(inserted.password_hash, null)
    assert.equal(inserted.first_name, 'Vasya')
    assert.equal(inserted.last_name, 'Pupkin')
  })
})

describe('Stage 210.2 — ingest listings', () => {
  it('creates batch + listing draft with concierge flags and seasons', async () => {
    const { ingestConciergeListings, CONCIERGE_IMPORT_PLATFORM } = await import(
      '../lib/services/concierge/concierge-supply.service.js'
    )

    const calls = []
    const db = {
      from(table) {
        const state = { table, filters: {}, payload: null, op: 'select' }
        const chain = {
          select() {
            state.op = 'select'
            return chain
          },
          insert(payload) {
            state.op = 'insert'
            state.payload = payload
            calls.push({ table, op: 'insert', payload })
            return chain
          },
          update(payload) {
            state.op = 'update'
            state.payload = payload
            calls.push({ table, op: 'update', payload })
            return chain
          },
          delete() {
            state.op = 'delete'
            calls.push({ table, op: 'delete' })
            return chain
          },
          eq(col, val) {
            state.filters[col] = val
            return chain
          },
          limit() {
            return chain
          },
          maybeSingle: async () => {
            if (table === 'profiles') {
              return {
                data: { id: 'partner-shadow-1', role: 'PARTNER', is_shadow: true, email: 'a@b.c' },
                error: null,
              }
            }
            return { data: null, error: null }
          },
          single: async () => ({ data: null, error: null }),
          then(resolve, reject) {
            const run = async () => {
              if (table === 'categories' && state.op === 'select') {
                return { data: [{ id: 'cat-stay', slug: 'stay' }], error: null }
              }
              if (table === 'listings' && state.op === 'select') {
                return { data: [], error: null }
              }
              if (table === 'concierge_import_batches' && state.op === 'insert') {
                return { data: null, error: null }
              }
              if (table === 'listings' && state.op === 'insert') {
                return { data: null, error: null }
              }
              if (table === 'seasonal_prices' && state.op === 'delete') {
                return { data: null, error: null }
              }
              if (table === 'seasonal_prices' && state.op === 'insert') {
                return { data: null, error: null }
              }
              if (table === 'concierge_import_batches' && state.op === 'update') {
                return { data: null, error: null }
              }
              return { data: null, error: null }
            }
            return run().then(resolve, reject)
          },
        }
        return chain
      },
    }

    // Stub PricingService via dynamic path already imported inside service — calculateCommission may hit DB;
    // ingest catches and falls back to 0.

    const res = await ingestConciergeListings({
      partnerProfileId: 'partner-shadow-1',
      sourceType: 'pdf',
      sourceLabel: 'Show Property',
      mappingProfile: 'show_property_v1',
      listings: [
        {
          externalId: 'JU208',
          title: 'The Title HALO 1 — JU208',
          description: 'Modern apartment',
          categorySlug: 'stay',
          bedrooms: 1,
          maxGuests: 2,
          basePriceThb: 3300,
          seasons: [
            {
              startDate: '2026-12-15',
              endDate: '2027-01-15',
              priceDaily: 3300,
              priceMonthly: 90000,
              label: '15 Dec-15 Jan',
            },
          ],
          images: ['https://cdn.example/ju208.jpg', 'http://bad.example/x.jpg'],
          icalUrl: 'https://calendar.example/ju208.ics',
        },
      ],
      createdByAdminId: 'admin-1',
      autoRehostMedia: false,
      db,
    })

    assert.equal(res.ok, true, res.error || 'ingest failed')
    assert.ok(res.batchId)
    assert.equal(res.importedListingsCount, 1)
    assert.equal(res.listingIds.length, 1)

    const listingInsert = calls.find((c) => c.table === 'listings' && c.op === 'insert')
    assert.ok(listingInsert, 'listing insert expected')
    const row = listingInsert.payload
    assert.equal(row.status, 'INACTIVE')
    assert.equal(row.import_platform, CONCIERGE_IMPORT_PLATFORM)
    assert.equal(row.import_external_id, 'JU208')
    assert.equal(row.owner_id, 'partner-shadow-1')
    assert.equal(row.metadata.is_draft, true)
    assert.equal(row.metadata.concierge_protected, true)
    assert.equal(row.metadata.concierge_stage, 'imported_draft')
    assert.deepEqual(row.images, ['https://cdn.example/ju208.jpg'])
    assert.equal(row.sync_settings.auto_sync, true)
    assert.equal(row.base_price_thb, 3300)

    const seasonInsert = calls.find((c) => c.table === 'seasonal_prices' && c.op === 'insert')
    assert.ok(seasonInsert, 'seasonal insert expected')
    const seasons = Array.isArray(seasonInsert.payload) ? seasonInsert.payload : [seasonInsert.payload]
    assert.equal(seasons[0].price_daily, 3300)
    assert.equal(seasons[0].price_monthly, 90000)

    const batchFinish = calls.find(
      (c) => c.table === 'concierge_import_batches' && c.op === 'update' && c.payload?.status === 'ingested',
    )
    assert.ok(batchFinish, 'batch should finish as ingested')
  })
})

describe('Stage 210.2 — route wiring', () => {
  it('admin routes and RBAC prefix exist', () => {
    assert.match(read('app/api/v2/admin/concierge/partners/route.js'), /provisionConciergeShadowPartner/)
    assert.match(read('app/api/v2/admin/concierge/ingest/route.js'), /ingestConciergeListings/)
    assert.match(read('lib/admin/admin-api-access.ts'), /\/api\/v2\/admin\/concierge/)
    assert.match(read('lib/services/concierge/concierge-supply.service.js'), /concierge_protected/)
    assert.doesNotMatch(read('lib/services/concierge/concierge-supply.service.js'), /listing_status/)
  })
})
