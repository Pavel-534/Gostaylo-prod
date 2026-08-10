/**
 * Stage 210.7 — Concierge admin UI + journal APIs.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-7-concierge-admin-ui.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 210.7 — /admin/concierge page wiring', () => {
  it('renders import + batches tabs and validation form hooks', () => {
    const page = read('app/admin/concierge/page.js')
    assert.match(page, /admin-concierge-page/)
    assert.match(page, /ConciergeImportTab/)
    assert.match(page, /ConciergeBatchesTab/)
    assert.match(page, /Импорт объектов/)
    assert.match(page, /Журнал батчей/)

    const importTab = read('components/admin/concierge/ConciergeImportTab.jsx')
    assert.match(importTab, /concierge-json-input/)
    assert.match(importTab, /validateConciergePayloadClient/)
    assert.match(importTab, /500/)
    assert.match(importTab, /concierge-validation-verdict/)
    assert.match(importTab, /Выполнить Ingest и создать Claim-инвайт/)
    assert.match(importTab, /без Claim/)

    const batches = read('components/admin/concierge/ConciergeBatchesTab.jsx')
    assert.match(batches, /fetchConciergeBatches/)
    assert.match(batches, /Claim URL/)
    assert.match(batches, /Просмотреть объекты|Объекты/)

    const menu = read('lib/admin/admin-menu.ts')
    assert.match(menu, /\/admin\/concierge/)
    assert.match(menu, /Concierge Supply/)
  })

  it('exposes batches / partner-search / prompt admin APIs', () => {
    assert.match(read('app/api/v2/admin/concierge/batches/route.js'), /listConciergeImportBatches/)
    assert.match(
      read('app/api/v2/admin/concierge/batches/[id]/route.js'),
      /listConciergeBatchListings/,
    )
    assert.match(
      read('app/api/v2/admin/concierge/partner-search/route.js'),
      /searchConciergePartnerProfiles/,
    )
    assert.match(read('app/api/v2/admin/concierge/prompt/route.js'), /CONCIERGE_AI_EXTRACTOR_PROMPT_COPY/)

    const validate = read('app/api/v2/admin/concierge/validate-payload/route.js')
    assert.match(validate, /listings: result\.listings/)
  })

  it('parse + validate helpers stay product-safe (no fee hardcodes in UI client)', () => {
    const client = read('lib/admin/concierge-admin-api-client.js')
    assert.doesNotMatch(client, /0\.15|15%|35\.5/)
    assert.match(client, /validate-payload/)
    assert.match(client, /claim-invites/)

    const prompt = read('lib/services/concierge/ai-extractor-prompt-text.js')
    assert.match(prompt, /Do not invent fees/)
    assert.match(prompt, /show_property_v1/)
  })
})

describe('Stage 210.7 — admin service unit (mock db)', () => {
  it('serializes batch journal from mock rows', async () => {
    const { listConciergeImportBatches } = await import(
      '../lib/services/concierge/concierge-admin.service.js'
    )

    const batches = [
      {
        id: 'batch-1',
        partner_profile_id: 'p1',
        source_type: 'pdf',
        source_label: 'Show Property',
        mapping_profile: 'show_property_v1',
        status: 'ingested',
        created_at: '2026-08-10T00:00:00.000Z',
        created_by_admin_id: 'a1',
        metadata: {},
      },
    ]

    const db = {
      from(table) {
        if (table === 'concierge_import_batches') {
          return {
            select() {
              return {
                order() {
                  return {
                    range: async () => ({ data: batches, error: null, count: 1 }),
                  }
                },
              }
            },
          }
        }
        if (table === 'profiles') {
          return {
            select() {
              return {
                in: async () => ({
                  data: [
                    {
                      id: 'p1',
                      email: 'partner@example.com',
                      first_name: 'Ann',
                      last_name: null,
                      is_shadow: true,
                      shadow_claimed_at: null,
                      role: 'PARTNER',
                    },
                  ],
                  error: null,
                }),
              }
            },
          }
        }
        if (table === 'listings') {
          return {
            select() {
              return {
                in: async () => ({
                  data: [
                    { id: 'l1', concierge_batch_id: 'batch-1' },
                    { id: 'l2', concierge_batch_id: 'batch-1' },
                  ],
                  error: null,
                }),
              }
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    }

    const result = await listConciergeImportBatches({ page: 1, limit: 20, db })
    assert.equal(result.ok, true)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].listingsCount, 2)
    assert.equal(result.items[0].claimEligible, true)
    assert.equal(result.items[0].partner.email, 'partner@example.com')
  })
})
