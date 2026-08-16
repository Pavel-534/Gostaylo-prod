/**
 * Stage 201.58 — listing wizard: drop desktop breadcrumb toolbar noise; keep steps in chrome.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-58-wizard-toolbar-chrome.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.58 — wizard desktop chrome (no breadcrumb toolbar)', () => {
  it('partner layout skips WORKSPACE_TOOLBAR breadcrumb row on listing wizard', () => {
    const layout = read('app/(partner)/partner/layout.js')
    assert.match(layout, /isImpersonating \|\| !isListingWizardRoute/)
    assert.match(layout, /!isListingWizardRoute \? \(\s*<div className=\{WORKSPACE_TOOLBAR_ROW_CLASS\}/)
    assert.doesNotMatch(layout, /WORKSPACE_MOBILE_TOOLBAR_CLASS/)
  })

  it('compact step bar pins under AppHeader only (no toolbar offset)', () => {
    const layoutConsts = read(
      'app/(partner)/partner/listings/new/components/chrome/listing-wizard-layout.js',
    )
    assert.match(
      layoutConsts,
      /WIZARD_COMPACT_STEP_BAR_POSITION_CLASS\s*=\s*\n?\s*'fixed[^']*top-\[var\(--app-header-height/,
    )
    assert.doesNotMatch(layoutConsts, /\+2\.5rem/)
    assert.doesNotMatch(layoutConsts, /\+3rem/)
  })

  it('wizard header has no Exit ArrowLeft; step subtitle under title', () => {
    const header = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardHeader.jsx',
    )
    assert.doesNotMatch(header, /from 'lucide-react'[\s\S]*ArrowLeft|ArrowLeft[\s\S]*from 'lucide-react'/)
    assert.doesNotMatch(header, /useRouter/)
    assert.doesNotMatch(header, /router\.push\('\/partner\/listings'\)/)
    assert.match(header, /stepSubtitle/)
    assert.match(header, /soft-back/)

    const chrome = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardChrome.jsx',
    )
    assert.match(chrome, /stepSubtitle=\{compactStepLine\}/)
  })
})
