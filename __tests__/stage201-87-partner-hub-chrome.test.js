/**
 * Stage 201.87 — partner hub chrome: hide duplicate page H1 under AppHeader (md+).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS } from '../lib/ui/partner-section-rhythm.js'

const root = process.cwd()

describe('Stage 201.87 partner hub title chrome', () => {
  it('exports md-hide token', () => {
    assert.equal(PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS, 'md:hidden')
  })

  it('listings / bookings / finances / reviews / promo / dashboard use the token', () => {
    const files = [
      'app/(partner)/partner/listings/page.js',
      'app/(partner)/partner/bookings/page.js',
      'components/partner/finances/PartnerFinancesHeader.jsx',
      'app/(partner)/partner/reviews/page.js',
      'app/(partner)/partner/promo/page.js',
      'components/partner/dashboard/PartnerDashboardPageContent.jsx',
    ]
    for (const rel of files) {
      const src = readFileSync(join(root, rel), 'utf8')
      assert.ok(src.includes('PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS'), `missing in ${rel}`)
    }
  })
})
