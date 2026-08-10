/**
 * Stage 210.7.1 — Concierge UX polish (strip fences, mapping profile, notify).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-71-concierge-ux-polish.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 210.7.1 — stripMarkdownJsonFences', () => {
  it('strips ```json / ``` fences and keeps inner JSON', async () => {
    const { stripMarkdownJsonFences } = await import(
      '../lib/services/concierge/strip-json-fences.js'
    )

    const fenced = '```json\n{"mappingProfile":"show_property_v1","listings":[]}\n```'
    assert.equal(
      stripMarkdownJsonFences(fenced),
      '{"mappingProfile":"show_property_v1","listings":[]}',
    )

    assert.equal(
      stripMarkdownJsonFences('```markdown\n{"a":1}\n```'),
      '{"a":1}',
    )

    assert.equal(stripMarkdownJsonFences('```\n{"b":2}\n```'), '{"b":2}')

    const plain = '{"listings":[{"externalId":"X"}]}'
    assert.equal(stripMarkdownJsonFences(plain), plain)

    assert.equal(stripMarkdownJsonFences('  ```json\n{}\n```  '), '{}')
  })
})

describe('Stage 210.7.1 — admin import mapping profile + partner notify wiring', () => {
  it('ImportTab wires mapping profile select and fence strip', () => {
    const src = read('components/admin/concierge/ConciergeImportTab.jsx')
    assert.match(src, /stripMarkdownJsonFences/)
    assert.match(src, /concierge-mapping-profile/)
    assert.match(src, /show_property_v1/)
    assert.match(src, /generic_concierge_v1/)
    assert.match(src, /mappingProfileId/)
    assert.match(src, /CONCIERGE_DRIVE_MEDIA_PLAYBOOK/)
  })

  it('existing partner notify + login welcome + checklist', async () => {
    const { hasConciergeWelcomePending, CONCIERGE_WELCOME_PENDING_KEY } = await import(
      '../lib/services/concierge/concierge-partner-notify.service.js'
    )
    assert.equal(hasConciergeWelcomePending({ [CONCIERGE_WELCOME_PENDING_KEY]: { at: 'x' } }), true)
    assert.equal(hasConciergeWelcomePending({}), false)

    const supply = read('lib/services/concierge/concierge-supply.service.js')
    assert.match(supply, /notifyExistingPartnerConciergeIngest/)

    const login = read('app/api/v2/auth/login/route.js')
    assert.match(login, /concierge_welcome_pending/)
    assert.match(login, /concierge_welcome=true/)

    const checklist = read('components/partner/listings/ConciergePartnerChecklist.jsx')
    assert.match(checklist, /concierge-partner-checklist/)
    assert.match(checklist, /conciergeCheckStep1/)

    const i18n = read('lib/translations/slices/partner-ui.js')
    assert.match(i18n, /Проверьте фото и описание/)
    assert.match(i18n, /Отправить на модерацию/)
  })
})
