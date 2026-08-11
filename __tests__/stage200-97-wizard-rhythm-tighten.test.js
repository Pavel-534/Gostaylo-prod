/**
 * Stage 200.97 — Tighter wizard bottom clearance + clearer mint dividers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-97-wizard-rhythm-tighten.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.97 — tighten wizard void + mint dividers', () => {
  it('content pb is tight; scrollport has no padding-bottom override', () => {
    const layout = read(
      'app/(partner)/partner/listings/new/components/chrome/listing-wizard-layout.js',
    )
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_HEIGHT = '5rem'/)
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_CONTENT_GAP = '0\.5rem'/)
    assert.match(layout, /pb-\[calc\(5rem\+0\.5rem\+env\(safe-area-inset-bottom\)\)\]/)
    assert.doesNotMatch(layout, /env\(safe-area-inset-bottom,/)

    const css = read('app/globals.css')
    assert.match(css, /scroll-padding-bottom:\s*calc\(5rem \+ 0\.5rem/)
    // Must not reintroduce layout padding-bottom on the scrollport (double void).
    assert.doesNotMatch(
      css,
      /@media \(max-width:\s*639px\)[\s\S]{0,200}data-listing-wizard-scroll[\s\S]{0,200}padding-bottom:/,
    )
    assert.doesNotMatch(
      css,
      /\[data-workspace-scroll\]\[data-listing-wizard-scroll\]\s*\{[^}]*[^s-]padding-bottom:/,
    )
  })

  it('PartnerSectionDivider is 2px mint at higher opacity, tighter wrap', () => {
    const rhythm = read('lib/ui/partner-section-rhythm.js')
    assert.match(rhythm, /h-0\.5/)
    assert.match(rhythm, /brand-mint\/40/)
    assert.match(rhythm, /dark:bg-brand-mint\/55/)
    assert.match(rhythm, /PARTNER_SECTION_DIVIDER_WRAP_CLASS = 'py-3 sm:py-4'/)
    assert.doesNotMatch(rhythm, /brand-mint\/20/)
  })

  it('wizard step root spacing is tighter on mobile', () => {
    const step = read('app/(partner)/partner/listings/new/components/wizard-step-layout.js')
    assert.match(step, /WIZARD_STEP_ROOT_CLASS = 'space-y-4 sm:space-y-6'/)
  })
})
