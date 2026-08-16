/**
 * Stage 201.59 — Android PWA icons (superseded splash recipe in 201.60; keep lockup guard).
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

describe('Stage 201.59 — Android PWA no lockup-as-icon', () => {
  it('manifest never uses lockup android-splash launcher icons', () => {
    const man = read('app/manifest.js')
    assert.doesNotMatch(man, /icon-android-splash/)
    assert.match(man, /icon-maskable-512x512\.png/)
    assert.match(man, /background_color:\s*['\"]#0c1623['\"]/)

    const staticMan = read('public/manifest.json')
    assert.doesNotMatch(staticMan, /icon-android-splash/)
  })

  it('lockup-as-launcher assets removed; portrait splash kept for native shells', () => {
    assert.equal(exists('public/icons/icon-android-splash-512x512.png'), false)
    assert.equal(exists('public/icons/icon-android-splash-maskable-512x512.png'), false)
    assert.ok(exists('public/icons/icon-maskable-512x512.png'))
    assert.ok(exists('public/splash/android-splash-1080-1920.png'))
    assert.doesNotMatch(read('scripts/build-android-splash-icons.mjs'), /icon-android-splash-\$\{size\}/)
  })
})
