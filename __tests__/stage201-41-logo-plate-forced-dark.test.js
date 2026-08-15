/**
 * Stage 201.41 — header logo plate resists forced dark; brand mark on white chip.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-41-logo-plate-forced-dark.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.41 — logo plate forced-dark proof', () => {
  it('AirentoLogo defaults to plate + brand mark (not auto swap)', () => {
    const src = read('components/brand/airento-logo.jsx')
    assert.match(src, /al-logo-plate/)
    assert.match(src, /usePlate \? 'brand'/)
    assert.match(src, /plate \?\? tone !== 'dark'/)
    assert.match(src, /tone === 'dark' \? 'onDark'/)
  })

  it('globals define light-only plate; layout opts out of auto dark', () => {
    const css = read('app/globals.css')
    assert.match(css, /\.al-logo-plate/)
    assert.match(css, /color-scheme:\s*light only/)
    assert.match(css, /forced-color-adjust:\s*none/)

    const layout = read('app/layout.js')
    assert.match(layout, /color-scheme:light only/)
  })

  it('brand book shows light mark on dark sample', () => {
    const page = read('app/(marketing)/brand/page.js')
    assert.match(page, /airento-mark-light\.svg/)
  })
})
