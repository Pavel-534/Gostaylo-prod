/**
 * Stage 201.90 — draft card shows Publish when quality checklist is ready.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-90-partner-draft-publish-cta.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePartnerListingCardCta } from '../lib/partner/partner-listing-card-cta.js'
import {
  buildListingPublishQualityChecklist,
  listingPublishQualityProgress,
} from '../lib/partner/listing-quality-gates.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.90 — partner draft publish CTA', () => {
  it('incomplete draft keeps Continue; ready draft promotes Publish', () => {
    assert.deepEqual(
      resolvePartnerListingCardCta({
        status: 'DRAFT',
        isDraftListing: true,
        ready: false,
      }),
      {
        showContinueDraft: true,
        showPublishCta: false,
        showConciergeReviewCta: false,
      },
    )
    assert.deepEqual(
      resolvePartnerListingCardCta({
        status: 'DRAFT',
        isDraftListing: true,
        ready: true,
      }),
      {
        showContinueDraft: false,
        showPublishCta: true,
        showConciergeReviewCta: false,
      },
    )
  })

  it('rejected shows Publish only when checklist is ready', () => {
    assert.equal(
      resolvePartnerListingCardCta({
        status: 'REJECTED',
        ready: false,
      }).showPublishCta,
      false,
    )
    assert.equal(
      resolvePartnerListingCardCta({
        status: 'REJECTED',
        ready: true,
      }).showPublishCta,
      true,
    )
  })

  it('concierge draft keeps review CTA instead of Publish', () => {
    const cta = resolvePartnerListingCardCta({
      status: 'DRAFT',
      isDraftListing: true,
      isConciergeDraft: true,
      ready: true,
    })
    assert.equal(cta.showConciergeReviewCta, true)
    assert.equal(cta.showPublishCta, false)
    assert.equal(cta.showContinueDraft, false)
  })

  it('quality progress skips optional district and counts required items', () => {
    const incomplete = buildListingPublishQualityChecklist({
      title: 'Honda Fit',
      description: 'A'.repeat(40),
      images: ['https://example.com/a.jpg'],
      basePriceThb: 1200,
      categorySlug: 'cars',
      wizardProfile: 'transport',
    })
    const progress = listingPublishQualityProgress(incomplete)
    assert.equal(progress.ok, false)
    assert.ok(progress.total >= 5)
    assert.ok(progress.done < progress.total)
  })

  it('listings page wires helper + ready badge + progress', () => {
    const page = read('app/(partner)/partner/listings/page.js')
    assert.match(page, /resolvePartnerListingCardCta/)
    assert.match(page, /listingPublishQualityProgress/)
    assert.match(page, /partnerListings_readyToPublish/)
    assert.match(page, /listing-ready-badge-/)
    const i18n = read('lib/translations/slices/partner-ui.js')
    assert.match(i18n, /partnerListings_readyToPublish: 'Готово к публикации'/)
    assert.match(i18n, /partnerListings_checklistProgress: '\{done\} из \{total\}'/)
  })
})
