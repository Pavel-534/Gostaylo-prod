/**
 * Stage 201.59 — fix Android PWA icons/splash (revert 201.55 lockup-as-icon).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-59-android-pwa-splash-icons.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

describe('Stage 201.59 — Android PWA splash uses dark mark, not lockup', () => {
  it('manifest: dark mark any + light maskable; no android-splash lockup icons', () => {
    const man = read('app/manifest.js')
    assert.match(man, /icon-dark-512x512\.png/)
    assert.match(man, /purpose:\s*['\"]any['\"]/)
    assert.match(man, /icon-maskable-512x512\.png/)
    assert.match(man, /purpose:\s*['\"]maskable['\"]/)
    assert.doesNotMatch(man, /icon-android-splash/)
    assert.match(man, /background_color:\s*['\"]#0c1623['\"]/)

    const staticMan = read('public/manifest.json')
    assert.match(staticMan, /icon-dark-512x512\.png/)
    assert.doesNotMatch(staticMan, /icon-android-splash/)
  })

  it('lockup-as-launcher assets removed; dark mark + portrait splash exist', () => {
    assert.equal(exists('public/icons/icon-android-splash-512x512.png'), false)
    assert.equal(exists('public/icons/icon-android-splash-maskable-512x512.png'), false)
    assert.ok(exists('public/icons/icon-dark-512x512.png'))
    assert.ok(exists('public/icons/icon-maskable-512x512.png'))
    assert.ok(exists('public/splash/android-splash-1080-1920.png'))

    const script = read('scripts/build-android-splash-icons.mjs')
    assert.match(script, /airento-mark\.svg/)
    assert.match(script, /icon-dark-/)
    assert.doesNotMatch(script, /icon-android-splash-\$\{size\}/)
  })
})
