/**
 * Stage 200.21 P1a — Draft hygiene, resume draft banner, category picker i18n.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-21-listing-wizard-p1.test.js
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.21 — wizard draft storage listingId', () => {
  /** @type {Map<string, string>} */
  let store

  before(() => {
    store = new Map()
    globalThis.window = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => {
          store.set(k, String(v))
        },
        removeItem: (k) => {
          store.delete(k)
        },
      },
    }
  })

  after(() => {
    delete globalThis.window
  })

  it('persists and restores listingId (v2)', async () => {
    store.clear()
    const { saveWizardDraft, readWizardDraft, clearWizardDraft } = await import(
      '../lib/partner/wizard-draft-storage.js'
    )
    clearWizardDraft()
    saveWizardDraft(
      {
        title: 'Test villa',
        description: '',
        categoryId: '1',
        listingServiceType: 'stay',
        metadata: {},
      },
      2,
      'lst-demo-1',
    )
    const draft = readWizardDraft()
    assert.ok(draft)
    assert.equal(draft.listingId, 'lst-demo-1')
    assert.equal(draft.currentStep, 2)
    assert.equal(draft.formData.categoryId, '1')
  })

  it('still reads legacy v1 envelopes without listingId', async () => {
    store.clear()
    const { WIZARD_DRAFT_KEY, readWizardDraft } = await import(
      '../lib/partner/wizard-draft-storage.js'
    )
    store.set(
      WIZARD_DRAFT_KEY,
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        currentStep: 1,
        formData: {
          title: 'Legacy',
          categoryId: '2',
          listingServiceType: 'transport',
          metadata: {},
        },
      }),
    )
    const draft = readWizardDraft()
    assert.ok(draft)
    assert.equal(draft.listingId, null)
    assert.equal(draft.formData.title, 'Legacy')
  })
})

describe('Stage 200.21 P1a — draft hygiene & category i18n', () => {
  it('wizard shows resume Continue vs Create new banner', () => {
    const page = read('app/(partner)/partner/listings/new/components/ListingWizardPageInner.jsx')
    assert.match(page, /WizardResumeDraftBanner/)
    assert.match(page, /showResumeDraftBanner/)
    assert.match(page, /startFreshWizard/)
    const banner = read(
      'app/(partner)/partner/listings/new/components/chrome/WizardResumeDraftBanner.jsx',
    )
    assert.match(banner, /wizard-resume-draft-banner/)
    assert.match(banner, /wizardResumeDraftPrompt/)
    assert.match(banner, /wizard-resume-create-new-btn/)
    const state = read('app/(partner)/partner/listings/new/hooks/useListingWizardState.js')
    assert.match(state, /startFreshWizard/)
    assert.match(state, /clearWizardDraft/)
  })

  it('category picker uses getUIText (no hardcoded RU/EN)', () => {
    const src = read('components/partner/PartnerCategoryPickerTwoStep.jsx')
    assert.match(src, /getUIText\('partnerWizard_categoryBackToVerticals'/)
    assert.match(src, /getUIText\('partnerWizard_categoryChooseType'/)
    assert.doesNotMatch(src, /Назад к разделам/)
    assert.doesNotMatch(src, /Choose type →/)
  })

  it('category PATCH failure shows toast', () => {
    const actions = read('app/(partner)/partner/listings/new/hooks/useListingWizardActions.js')
    assert.match(actions, /partnerWizard_categoryUpdateFailed/)
    assert.match(actions, /toast\.error/)
  })

  it('POST partner listings forces INACTIVE when is_draft', () => {
    const src = read('app/api/v2/partner/listings/route.js')
    assert.match(src, /metadata\?\.is_draft === true/)
    assert.match(src, /'INACTIVE'/)
  })

  it('list cards expose Continue draft CTA', () => {
    const actions = read('components/partner/listings/PartnerListingCardActions.jsx')
    assert.match(actions, /showContinueDraft/)
    assert.match(actions, /partnerListings_continueDraft/)
    const page = read('app/(partner)/partner/listings/page.js')
    assert.match(page, /partnerListings_resumeDraftsBanner/)
    assert.match(page, /showContinueDraft=\{isDraftListing\}/)
  })
})
