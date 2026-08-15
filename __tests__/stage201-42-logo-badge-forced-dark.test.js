/**
 * Stage 201.42 — header logo: baked SVG badge (no CSS plate layers); forced-dark proof.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-42-logo-badge-forced-dark.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.42 — logo badge forced-dark proof', () => {
  it('badge SVG paints white chip inside the image', () => {
    const badge = read('public/brand/airento-mark-badge.svg')
    assert.match(badge, /fill="#ffffff"/)
    assert.match(badge, /rx="28"/)
    assert.match(badge, /tealGrad/)
  })

  it('AirentoLogo uses badge tone; AppHeader has no CSS logo plate/shadow stack', () => {
    const logo = read('components/brand/airento-logo.jsx')
    assert.match(logo, /markTone = tone === 'dark' \? 'onDark' : 'badge'/)
    assert.doesNotMatch(logo, /al-logo-plate/)

    const mark = read('components/brand/airento-mark.jsx')
    assert.match(mark, /airento-mark-badge\.svg/)

    const header = read('components/app-header/AppHeader.jsx')
    assert.doesNotMatch(header, /bg-white\/75/)
    assert.doesNotMatch(header, /shadow-\[0_10px_26px/)
  })

  it('globals dropped CSS .al-logo-plate', () => {
    const css = read('app/globals.css')
    assert.doesNotMatch(css, /\.al-logo-plate/)
  })
})
