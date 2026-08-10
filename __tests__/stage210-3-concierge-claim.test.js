/**
 * Stage 210.3 — Concierge Supply Slice 3 (claim invite + partner activation).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-3-concierge-claim.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function makeMockDb(handlers) {
  return {
    from(table) {
      const h = handlers[table] || {}
      const state = { table, filters: [], payload: null, op: 'select', nullCols: [], gtFilters: [] }
      const chain = {
        select() {
          // Keep update/insert op when .select() follows (supabase pattern)
          if (state.op !== 'update' && state.op !== 'insert') {
            state.op = 'select'
          }
          return chain
        },
        insert(payload) {
          state.op = 'insert'
          state.payload = payload
          return chain
        },
        update(payload) {
          state.op = 'update'
          state.payload = payload
          return chain
        },
        eq(col, val) {
          state.filters.push({ col, val })
          return chain
        },
        is(col, val) {
          state.nullCols.push({ col, val })
          return chain
        },
        gt(col, val) {
          state.gtFilters.push({ col, val })
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return chain
        },
        maybeSingle: async () => {
          if (typeof h.maybeSingle === 'function') return h.maybeSingle(state)
          return { data: null, error: null }
        },
        then(resolve, reject) {
          const run = async () => {
            if (typeof h.execute === 'function') return h.execute(state)
            return { data: [], error: null }
          }
          return run().then(resolve, reject)
        },
      }
      return chain
    },
  }
}

describe('Stage 210.3 — token hash SSOT', () => {
  it('hashClaimToken is SHA-256 hex of raw token', async () => {
    const { hashClaimToken, generateClaimRawToken } = await import(
      '../lib/services/concierge/concierge-claim.service.js'
    )
    const raw = 'test-claim-token-abc'
    const expected = crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
    assert.equal(hashClaimToken(raw), expected)
    assert.equal(hashClaimToken(raw).length, 64)
    const generated = generateClaimRawToken()
    assert.ok(generated.length >= 32)
    assert.notEqual(hashClaimToken(generated), generated)
  })
})

describe('Stage 210.3 — RU geo OTP gate + activation', () => {
  it('blocks Russia claim without verified phone OTP', async () => {
    const { claimPartnerAccount, hashClaimToken } = await import(
      '../lib/services/concierge/concierge-claim.service.js'
    )
    const raw = 'ru-gate-token'
    const tokenHash = hashClaimToken(raw)
    const partnerId = 'partner-shadow-1'

    const db = makeMockDb({
      partner_claim_invites: {
        maybeSingle: async (state) => {
          if (state.op === 'select') {
            return {
              data: {
                id: 'invite-1',
                token_hash: tokenHash,
                email: 'shadow@example.com',
                partner_profile_id: partnerId,
                claimed_at: null,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                metadata: {},
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        execute: async () => ({ data: null, error: null }),
      },
      profiles: {
        maybeSingle: async (state) => {
          const idEq = state.filters.find((f) => f.col === 'id')
          const emailEq = state.filters.find((f) => f.col === 'email')
          if (idEq?.val === partnerId) {
            return {
              data: {
                id: partnerId,
                email: 'shadow@example.com',
                role: 'PARTNER',
                is_shadow: true,
                is_verified: false,
              },
              error: null,
            }
          }
          if (emailEq) {
            return {
              data: { id: partnerId, is_shadow: true },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      },
    })

    const denied = await claimPartnerAccount({
      token: raw,
      password: 'SecurePass1',
      isRussia: true,
      db,
      verifyOtpFn: async () => ({
        ok: false,
        code: 'PHONE_OTP_REQUIRED',
        error: 'Phone OTP required for Russia',
      }),
    })
    assert.equal(denied.ok, false)
    assert.equal(denied.code, 'PHONE_OTP_REQUIRED')
    assert.equal(denied.status, 400)
  })

  it('activates shadow partner outside RU without OTP', async () => {
    const { claimPartnerAccount, hashClaimToken } = await import(
      '../lib/services/concierge/concierge-claim.service.js'
    )
    const raw = 'ok-claim-token'
    const tokenHash = hashClaimToken(raw)
    const partnerId = 'partner-shadow-2'
    let profileUpdate = null
    let inviteUpdate = null

    const db = makeMockDb({
      partner_claim_invites: {
        maybeSingle: async (state) => {
          if (state.op === 'select') {
            return {
              data: {
                id: 'invite-2',
                token_hash: tokenHash,
                email: 'newpartner@example.com',
                partner_profile_id: partnerId,
                claimed_at: null,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                metadata: { stage: '210.3' },
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        execute: async (state) => {
          if (state.op === 'update') {
            inviteUpdate = state.payload
            return { data: null, error: null }
          }
          return { data: null, error: null }
        },
      },
      profiles: {
        maybeSingle: async (state) => {
          if (state.op === 'update') {
            profileUpdate = state.payload
            assert.equal(profileUpdate.is_shadow, false)
            assert.ok(profileUpdate.shadow_claimed_at)
            assert.ok(profileUpdate.password_hash)
            assert.equal(profileUpdate.is_verified, undefined)
            return {
              data: {
                id: partnerId,
                email: 'newpartner@example.com',
                role: 'PARTNER',
                first_name: 'New',
                last_name: 'Partner',
                phone: null,
                avatar: null,
                referral_code: 'AIR-TEST',
                is_verified: false,
                preferred_currency: 'THB',
                preferred_payout_currency: 'THB',
                telegram_id: null,
                telegram_username: null,
                terms_accepted: false,
                terms_accepted_at: null,
                legal_terms_accepted_at: null,
                is_shadow: false,
                shadow_claimed_at: profileUpdate.shadow_claimed_at,
              },
              error: null,
            }
          }
          const idEq = state.filters.find((f) => f.col === 'id')
          const emailEq = state.filters.find((f) => f.col === 'email')
          if (idEq?.val === partnerId) {
            return {
              data: {
                id: partnerId,
                email: 'newpartner@example.com',
                role: 'PARTNER',
                is_shadow: true,
                is_verified: false,
              },
              error: null,
            }
          }
          if (emailEq) {
            return { data: { id: partnerId, is_shadow: true }, error: null }
          }
          return { data: null, error: null }
        },
      },
    })

    const ok = await claimPartnerAccount({
      token: raw,
      password: 'SecurePass1',
      isRussia: false,
      db,
    })
    assert.equal(ok.ok, true)
    assert.equal(ok.profileId, partnerId)
    assert.equal(ok.redirectTo, '/partner/listings?concierge_welcome=true')
    assert.equal(ok.profile.is_verified, false)
    assert.ok(profileUpdate)
    assert.ok(inviteUpdate?.claimed_at)
    assert.equal(inviteUpdate.claimed_by_profile_id, partnerId)
  })

  it('RU success path after OTP verify sets phone and clears shadow', async () => {
    const { claimPartnerAccount, hashClaimToken } = await import(
      '../lib/services/concierge/concierge-claim.service.js'
    )
    const raw = 'ru-ok-token'
    const tokenHash = hashClaimToken(raw)
    const partnerId = 'partner-shadow-ru'

    const db = makeMockDb({
      partner_claim_invites: {
        maybeSingle: async (state) => {
          if (state.op === 'select') {
            return {
              data: {
                id: 'invite-ru',
                token_hash: tokenHash,
                email: 'ru@example.com',
                partner_profile_id: partnerId,
                claimed_at: null,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                metadata: {},
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        execute: async () => ({ data: null, error: null }),
      },
      profiles: {
        maybeSingle: async (state) => {
          if (state.op === 'update') {
            assert.equal(state.payload.phone, '+79001234567')
            assert.equal(state.payload.is_shadow, false)
            assert.equal(state.payload.is_verified, undefined)
            return {
              data: {
                id: partnerId,
                email: 'ru@example.com',
                role: 'PARTNER',
                first_name: null,
                last_name: null,
                phone: '+79001234567',
                avatar: null,
                referral_code: null,
                is_verified: false,
                preferred_currency: 'THB',
                preferred_payout_currency: 'THB',
                telegram_id: null,
                telegram_username: null,
                terms_accepted: false,
                terms_accepted_at: null,
                legal_terms_accepted_at: null,
                is_shadow: false,
                shadow_claimed_at: state.payload.shadow_claimed_at,
              },
              error: null,
            }
          }
          const idEq = state.filters.find((f) => f.col === 'id')
          if (idEq?.val === partnerId) {
            return {
              data: {
                id: partnerId,
                email: 'ru@example.com',
                role: 'PARTNER',
                is_shadow: true,
                is_verified: false,
              },
              error: null,
            }
          }
          return { data: { id: partnerId, is_shadow: true }, error: null }
        },
      },
    })

    const ok = await claimPartnerAccount({
      token: raw,
      password: 'SecurePass1',
      phone: '+79001234567',
      phoneOtpCode: '123456',
      phoneChallengeId: 'otp-1',
      isRussia: true,
      db,
      verifyOtpFn: async () => ({ ok: true, phoneE164: '+79001234567' }),
    })
    assert.equal(ok.ok, true)
    assert.equal(ok.profile.phone, '+79001234567')
    assert.equal(ok.profile.is_verified, false)
  })
})

describe('Stage 210.3 — route wiring', () => {
  it('admin claim-invites and public claim-partner routes exist', () => {
    const admin = read('app/api/v2/admin/concierge/claim-invites/route.js')
    assert.match(admin, /createPartnerClaimInvite/)
    assert.match(admin, /ADMIN/)

    const pub = read('app/api/v2/auth/claim-partner/route.js')
    assert.match(pub, /claimPartnerAccount/)
    assert.match(pub, /isRussia/)
    assert.match(pub, /attachGostayloSessionCookie/)

    const access = read('lib/admin/admin-api-access.ts')
    assert.match(access, /\/api\/v2\/admin\/concierge/)

    const login = read('app/api/v2/auth/login/route.js')
    assert.match(login, /shadow_claimed_at/)
    assert.match(login, /claimedConciergePartner/)
  })
})
