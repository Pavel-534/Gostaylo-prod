/**
 * Stage 201.92 — housing property type follows category, not leftover Villa metadata.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-92-housing-property-type.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalizeHousingPropertyTypeSlug,
  resolveListingHousingPropertyTypeSlug,
  applyHousingPropertyTypeFromCategorySlug,
} from '../lib/listing/housing-property-type.js'
import { defaultMetadataForListingServiceType } from '../lib/partner/listing-service-type.js'
import { categoryTranslations } from '../lib/translations/categories.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.92 — housing property type SSOT', () => {
  it('canonicalizes aliases and rejects generic/default', () => {
    assert.equal(canonicalizeHousingPropertyTypeSlug('Villa'), 'villa')
    assert.equal(canonicalizeHousingPropertyTypeSlug('apartments'), 'apartment')
    assert.equal(canonicalizeHousingPropertyTypeSlug('property'), null)
    assert.equal(canonicalizeHousingPropertyTypeSlug(''), null)
  })

  it('apartment category wins over leftover Villa metadata', () => {
    assert.equal(
      resolveListingHousingPropertyTypeSlug({
        categorySlug: 'apartment',
        metadata: { property_type: 'Villa', subcategory: 'Villa' },
      }),
      'apartment',
    )
    assert.equal(
      resolveListingHousingPropertyTypeSlug({
        category: { slug: 'apartments', name: 'Квартиры' },
        metadata: { property_type: 'Villa' },
      }),
      'apartment',
    )
  })

  it('generic property category may use metadata subtype', () => {
    assert.equal(
      resolveListingHousingPropertyTypeSlug({
        categorySlug: 'property',
        metadata: { property_type: 'Villa' },
      }),
      'villa',
    )
  })

  it('stay defaults no longer invent Villa', () => {
    const meta = defaultMetadataForListingServiceType('stay', {})
    assert.equal(meta.property_type, '')
  })

  it('PDP Good-to-know uses housing SSOT (not leftover Villa)', () => {
    const slug = resolveListingHousingPropertyTypeSlug({
      categorySlug: 'apartment',
      metadata: { property_type: 'Villa' },
    })
    assert.equal(slug, 'apartment')
    assert.equal(categoryTranslations.apartment.ru, 'Апартаменты')
    const src = read('lib/listing/listing-good-to-know.js')
    assert.match(src, /resolveListingHousingPropertyTypeSlug/)
    assert.doesNotMatch(src, /meta\.subcategory, meta\.sub_category/)
  })

  it('wizard category pick writes property_type and drops subcategory', () => {
    const next = applyHousingPropertyTypeFromCategorySlug(
      { property_type: 'Villa', subcategory: 'Villa', bedrooms: 1 },
      'apartment',
    )
    assert.equal(next.property_type, 'apartment')
    assert.equal(next.subcategory, undefined)
    assert.equal(next.bedrooms, 1)
  })

  it('code no longer hardcodes Villa as stay default', () => {
    const src = read('lib/partner/listing-service-type.js')
    assert.doesNotMatch(src, /property_type: base\.property_type \|\| 'Villa'/)
    const wizard = read('app/(partner)/partner/listings/new/hooks/useListingWizardActions.js')
    assert.match(wizard, /applyHousingPropertyTypeFromCategorySlug/)
  })
})
