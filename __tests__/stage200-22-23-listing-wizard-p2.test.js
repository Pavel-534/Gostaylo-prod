/**
 * Stage 200.22 / 200.23 — draft cleanup policy + soft publish gates + AI translate mode.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-22-23-listing-wizard-p2.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.22 — draft cleanup policy', () => {
  it('tiers empty orphans at 7d and contentful at 30d', async () => {
    const {
      isEmptyWizardOrphanDraft,
      shouldDeleteExpiredDraft,
      draftCleanupCandidateCutoffIso,
      resolveDraftCleanupTtlDays,
    } = await import('../lib/partner/draft-cleanup-policy.js')

    const now = Date.parse('2026-08-04T12:00:00.000Z')
    const orphan = {
      title: 'Draft',
      description: 'short',
      images: [],
      metadata: { is_draft: true, wizard_upload: true },
      updated_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
    }
    const contentful = {
      title: 'Beach villa with pool',
      description: 'A'.repeat(80),
      images: ['https://example.com/a.jpg'],
      metadata: { is_draft: 'true' },
      updated_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    }

    assert.equal(isEmptyWizardOrphanDraft(orphan), true)
    assert.equal(isEmptyWizardOrphanDraft(contentful), false)
    assert.equal(shouldDeleteExpiredDraft(orphan, { nowMs: now }), true)
    assert.equal(shouldDeleteExpiredDraft(contentful, { nowMs: now }), false)
    assert.equal(
      shouldDeleteExpiredDraft(
        { ...contentful, updated_at: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString() },
        { nowMs: now },
      ),
      true,
    )

    const ttl = resolveDraftCleanupTtlDays({})
    assert.equal(ttl.emptyDays, 7)
    assert.equal(ttl.contentfulDays, 30)
    const cutoff = draftCleanupCandidateCutoffIso({ nowMs: now })
    assert.equal(cutoff, new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString())
  })

  it('ADR-210 skips Concierge-protected drafts from GC', async () => {
    const { shouldDeleteExpiredDraft, isConciergeProtectedDraft } = await import(
      '../lib/partner/draft-cleanup-policy.js'
    )
    const now = Date.parse('2026-08-04T12:00:00.000Z')
    const stale = {
      title: 'Halo JU208',
      description: 'A'.repeat(80),
      images: ['https://example.com/a.jpg'],
      metadata: { is_draft: true },
      updated_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
    }
    assert.equal(shouldDeleteExpiredDraft(stale, { nowMs: now }), true)
    assert.equal(
      isConciergeProtectedDraft({
        ...stale,
        metadata: { is_draft: true, concierge_protected: true },
      }),
      true,
    )
    assert.equal(
      shouldDeleteExpiredDraft(
        { ...stale, metadata: { is_draft: true, concierge_protected: true } },
        { nowMs: now },
      ),
      false,
    )
    assert.equal(
      shouldDeleteExpiredDraft(
        { ...stale, import_platform: 'concierge_pdf' },
        { nowMs: now },
      ),
      false,
    )
    assert.equal(
      shouldDeleteExpiredDraft({ ...stale, import_platform: 'airbnb' }, { nowMs: now }),
      true,
    )
  })

  it('cron route wires SSOT policy', () => {
    const src = read('app/api/cron/cleanup-drafts/route.js')
    assert.match(src, /shouldDeleteExpiredDraft/)
    assert.match(src, /draftCleanupCandidateCutoffIso/)
    assert.match(src, /isListingDraftMetadata/)
    assert.match(src, /import_platform/)
  })
})

describe('Stage 200.23 — soft publish + AI translate', () => {
  it('soft quality accepts 1 photo / 40 desc; full still stricter', async () => {
    const {
      validateListingSoftPublishQuality,
      validateListingPublishQuality,
      LISTING_SOFT_MIN_PHOTOS,
      LISTING_SOFT_MIN_DESCRIPTION,
    } = await import('../lib/partner/listing-quality-gates.js')

    assert.equal(LISTING_SOFT_MIN_PHOTOS, 1)
    assert.equal(LISTING_SOFT_MIN_DESCRIPTION, 40)

    const softInput = {
      title: 'Villa',
      description: 'X'.repeat(40),
      images: ['https://example.com/1.jpg'],
      district: 'Patong',
      basePriceThb: 1500,
      categorySlug: 'apartments',
      wizardProfile: 'stay',
      metadata: {},
    }
    const soft = validateListingSoftPublishQuality(softInput)
    assert.equal(soft.ok, true)
    const full = validateListingPublishQuality(softInput)
    assert.equal(full.ok, false)
  })

  it('wizard step Next uses soft minima', async () => {
    const { computeWizardCanProceed } = await import(
      '../app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js'
    )
    const form = {
      listingServiceType: 'stay',
      categoryId: 'cat-1',
      title: 'Ok villa',
      description: 'Y'.repeat(40),
      country: 'TH',
      city: 'phuket-city',
      district: 'Kata',
      latitude: 7.89,
      longitude: 98.39,
      images: ['https://example.com/a.jpg'],
      basePriceThb: '100',
      metadata: { city_label: 'Phuket' },
    }
    assert.equal(computeWizardCanProceed(1, form, true, {}), true)
    assert.equal(computeWizardCanProceed(3, form, true, {}), true)
    assert.equal(computeWizardCanProceed(5, form, true, {}), true)
  })

  it('PATCH + generate-description + UI wire softPublish / translate', () => {
    const patch = read('app/api/v2/partner/listings/[id]/route.js')
    assert.match(patch, /validateListingSoftPublishQuality/)
    assert.match(patch, /softPublish/)
    assert.match(patch, /quality_incomplete/)

    const gen = read('app/api/v2/partner/listings/generate-description/route.js')
    assert.match(gen, /mode === 'translate'/)
    assert.match(gen, /TRANSLATE_SOURCE_TOO_SHORT/)

    const save = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.match(save, /softPublishListing/)
    assert.match(save, /softPublish:\s*soft/)

    const actions = read('app/(partner)/partner/listings/new/hooks/useListingWizardActions.js')
    assert.match(actions, /handleAiTranslateDescription/)
    assert.match(actions, /mode:\s*'translate'/)

    const step = read('app/(partner)/partner/listings/new/components/StepGeneralInfo.jsx')
    assert.match(step, /wizard-ai-translate-btn/)

    const stepActions = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardStepActions.jsx',
    )
    assert.match(stepActions, /wizard-soft-publish-btn/)
    assert.match(stepActions, /canSoftPublish/)
  })
})
