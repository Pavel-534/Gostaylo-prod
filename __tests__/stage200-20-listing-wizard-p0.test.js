/**
 * Stage 200.20 — Listing wizard P0 UX (locales + draft-after-category).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-20-listing-wizard-p0.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.20 — mergeDescriptionTranslationsForSave (no silent copy-fill)', () => {
  it('writes only the UI language and preserves existing AI locales', async () => {
    const { mergeDescriptionTranslationsForSave } = await import(
      '../lib/partner/listing-description-i18n.js'
    )

    const onlyRu = mergeDescriptionTranslationsForSave(
      { description: 'Русский текст', metadata: {} },
      'ru',
    )
    assert.equal(onlyRu.ru, 'Русский текст')
    assert.equal(onlyRu.en, undefined)
    assert.equal(onlyRu.zh, undefined)
    assert.equal(onlyRu.th, undefined)

    const withPrev = mergeDescriptionTranslationsForSave(
      {
        description: 'Updated EN',
        metadata: {
          description_translations: {
            ru: 'RU AI',
            en: 'EN AI',
            zh: 'ZH AI',
            th: 'TH AI',
          },
        },
      },
      'en',
    )
    assert.equal(withPrev.en, 'Updated EN')
    assert.equal(withPrev.ru, 'RU AI')
    assert.equal(withPrev.zh, 'ZH AI')
    assert.equal(withPrev.th, 'TH AI')
  })

  it('does not copy ru↔en or fill zh/th from en', async () => {
    const src = read('lib/partner/listing-description-i18n.js')
    assert.doesNotMatch(src, /dt\.en = dt\.ru/)
    assert.doesNotMatch(src, /dt\.zh = dt\.en/)
    assert.doesNotMatch(src, /dt\.th = dt\.en/)
  })
})

describe('Stage 200.20 — draft after category', () => {
  it('shouldCreateWizardDraftOnCategory requires category and no existing id', async () => {
    const { shouldCreateWizardDraftOnCategory } = await import(
      '../lib/partner/ensure-wizard-draft-listing.js'
    )

    assert.equal(shouldCreateWizardDraftOnCategory({ categoryId: '1', existingListingId: null }), true)
    assert.equal(shouldCreateWizardDraftOnCategory({ categoryId: '1', existingListingId: '' }), true)
    assert.equal(
      shouldCreateWizardDraftOnCategory({ categoryId: '1', existingListingId: 'lst-abc' }),
      false,
    )
    assert.equal(shouldCreateWizardDraftOnCategory({ categoryId: '', existingListingId: null }), false)
    assert.equal(shouldCreateWizardDraftOnCategory({}), false)
  })

  it('wizard actions create draft on category select (wire check)', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/useListingWizardActions.js')
    assert.match(src, /shouldCreateWizardDraftOnCategory/)
    assert.match(src, /resolveOrCreateWizardDraft/)
    assert.match(src, /silentCategoryToast/)
  })
})
