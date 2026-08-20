/**
 * Stage 131.A5.E — referral OG uses PWA splash mark, not Partner hero text.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a5-e-referral-og.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 131.A5.E — referral OG preview', () => {
  it('centers PWA splash mark and avoids Partner hero fallback', () => {
    const src = read('app/(storefront)/u/[id]/opengraph-image.js')
    assert.match(src, /icon-splash-512x512\.png/)
    assert.match(src, /stage1322_ogInviteGeneric/)
    assert.doesNotMatch(src, /displayName = 'Partner'/)
    assert.match(src, /WhatsApp|square-crop|center/i)
  })

  it('metadata cache-busts og image URL', () => {
    assert.match(read('app/(storefront)/u/[id]/layout.js'), /opengraph-image\?v=/)
    assert.match(read('app/(storefront)/go/[vanity]/layout.js'), /opengraph-image\?v=/)
  })

  it('i18n has generic invite line for OG', () => {
    const i18n = read('lib/translations/slices/profile-app-referral.js')
    assert.match(i18n, /stage1322_ogInviteGeneric/)
    assert.match(i18n, /Присоединяйся к команде \{brand\}/)
  })
})
