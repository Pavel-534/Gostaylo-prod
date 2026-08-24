/**
 * Stage 202.8 — home PartnerCTA must open onboarding, not guarded /partner/dashboard.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-8-partner-cta-onboarding.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PARTNER_CABINET_HREF,
  PARTNER_ONBOARDING_HREF,
  isPartnerCabinetRole,
} from '../lib/navigation/partner-onboarding-href.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.8 — PartnerCTA onboarding', () => {
  it('SSOT hrefs point to renter profile, not only cabinet', () => {
    assert.equal(PARTNER_ONBOARDING_HREF, '/renter/profile?becomePartner=1')
    assert.equal(PARTNER_CABINET_HREF, '/partner/dashboard')
    assert.equal(isPartnerCabinetRole('RENTER'), false)
    assert.equal(isPartnerCabinetRole('PARTNER'), true)
  })

  it('PartnerCTA links to onboarding and handles click via auth', () => {
    const src = read('components/home/PartnerCTA.jsx')
    assert.match(src, /PARTNER_ONBOARDING_HREF/)
    assert.match(src, /home-partner-cta/)
    assert.doesNotMatch(src, /href=["']\/partner\/dashboard["']/)
  })

  it('renter profile opens modal from becomePartner query', () => {
    const hook = read('hooks/renter/use-renter-profile-page.js')
    assert.match(hook, /becomePartner/)
    assert.match(hook, /setShowApplicationModal\(true\)/)
  })
})
