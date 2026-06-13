/**
 * Stage 133 — deterministic ambassador + team for Playwright visual snapshots.
 * SSOT: fixed IDs, amounts, RUB display currency (dual FX in UI).
 */
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { STAGE72_REUSE_LISTING_ID } from '@/lib/e2e/test-listing-cleanup'

export const REF133_VISUAL = {
  ambassadorId: 'usr-e2e-ref133-visual',
  refereePartnerId: 'usr-e2e-ref133-ref-a',
  refereeRenterId: 'usr-e2e-ref133-ref-b',
  email: 'e2e-ref133-visual@smoke.invalid',
  password: 'e2e-ref133-visual-pass',
  refCode: 'E2E-REF133',
}

const TAG = `${E2E_TEST_DATA_TAG} [E2E_REF133_VISUAL]`
const PASSWORD = REF133_VISUAL.password
const BOOKING_PARTNER = 'bk-e2e-ref133-host-a'
const BOOKING_RENTER = 'bk-e2e-ref133-guest-b'
const LEDGER_PARTNER = 'rfl-e2e-ref133-a'
const LEDGER_RENTER = 'rfl-e2e-ref133-b'
const REL_PARTNER = 'rr-e2e-ref133-a'
const REL_RENTER = 'rr-e2e-ref133-b'
const CODE_ID = 'rc-e2e-ref133-visual'

/** Fixed THB amounts for stable screenshots. */
const AMT_PARTNER = 250
const AMT_RENTER = 150.5

async function ensureRubRate() {
  const rate = Number(process.env.SMOKE_MIR_RUB_PER_THB) || 2.8
  const { error } = await supabaseAdmin.from('exchange_rates').upsert(
    {
      currency_code: 'RUB',
      rate_to_thb: rate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'currency_code' },
  )
  if (error) throw new Error(`exchange_rates RUB: ${error.message}`)
  return rate
}

async function purgeFixtureRows() {
  const ids = [
    REF133_VISUAL.ambassadorId,
    REF133_VISUAL.refereePartnerId,
    REF133_VISUAL.refereeRenterId,
  ]
  const bookingIds = [BOOKING_PARTNER, BOOKING_RENTER]
  const ledgerIds = [LEDGER_PARTNER, LEDGER_RENTER]

  await supabaseAdmin.from('referral_ledger').delete().in('id', ledgerIds)
  await supabaseAdmin.from('referral_relations').delete().in('id', [REL_PARTNER, REL_RENTER])
  await supabaseAdmin.from('bookings').delete().in('id', bookingIds)
  await supabaseAdmin.from('referral_codes').delete().eq('id', CODE_ID)
  for (const uid of ids) {
    await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', uid)
    await supabaseAdmin.from('user_wallets').delete().eq('user_id', uid)
  }
  await supabaseAdmin.from('profiles').delete().in('id', ids)
}

async function insertBooking({ id, partnerId, renterId, tag }) {
  const checkIn = new Date()
  checkIn.setUTCDate(checkIn.getUTCDate() + 45)
  const checkOut = new Date(checkIn)
  checkOut.setUTCDate(checkOut.getUTCDate() + 2)
  const { error } = await supabaseAdmin.from('bookings').insert({
    id,
    listing_id: STAGE72_REUSE_LISTING_ID,
    renter_id: renterId,
    partner_id: partnerId,
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: 5000,
    currency: 'THB',
    price_paid: 5500,
    exchange_rate: 1,
    commission_thb: 500,
    commission_rate: 10,
    applied_commission_rate: 10,
    partner_earnings_thb: 4500,
    guest_name: 'E2E Ref133 Visual',
    guest_phone: '0000000133',
    guests_count: 1,
    special_requests: tag,
    pricing_snapshot: { fee_split_v2: { platform_gross_revenue_thb: 500 } },
    metadata: { e2e_fixture: 'ref133_visual' },
  })
  if (error) throw new Error(error.message || 'BOOKING_INSERT_FAILED')
}

/**
 * @returns {Promise<{ email: string, password: string, ambassadorId: string, rubRateToThb: number }>}
 */
export async function createReferralDashboardVisualFixture() {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }

  const rubRateToThb = await ensureRubRate()
  await purgeFixtureRows()

  const ts = new Date().toISOString()
  const hash = bcrypt.hashSync(PASSWORD, 8)
  const earnedAt = new Date().toISOString()

  const { error: profErr } = await supabaseAdmin.from('profiles').insert([
    {
      id: REF133_VISUAL.ambassadorId,
      email: REF133_VISUAL.email,
      password_hash: hash,
      role: 'PARTNER',
      first_name: 'E2E',
      last_name: 'Ambassador',
      referral_code: REF133_VISUAL.refCode,
      referral_display_currency: 'RUB',
      terms_accepted: true,
      terms_accepted_at: ts,
      partner_terms_accepted_at: ts,
      is_verified: true,
      verification_status: 'VERIFIED',
      language: 'ru',
      metadata: { e2e_fixture: 'ref133_visual' },
    },
    {
      id: REF133_VISUAL.refereePartnerId,
      email: `${REF133_VISUAL.refereePartnerId}@smoke.invalid`,
      password_hash: hash,
      role: 'PARTNER',
      first_name: 'Алексей',
      last_name: 'Хост',
      referral_code: 'E2E-REF133A',
      referral_display_currency: 'THB',
      terms_accepted: true,
      terms_accepted_at: ts,
      partner_terms_accepted_at: ts,
      is_verified: true,
      language: 'ru',
      metadata: { e2e_fixture: 'ref133_visual' },
    },
    {
      id: REF133_VISUAL.refereeRenterId,
      email: `${REF133_VISUAL.refereeRenterId}@smoke.invalid`,
      password_hash: hash,
      role: 'RENTER',
      first_name: 'Мария',
      last_name: 'Гость',
      referral_code: 'E2E-REF133B',
      referral_display_currency: 'THB',
      terms_accepted: true,
      terms_accepted_at: ts,
      is_verified: true,
      language: 'ru',
      metadata: { e2e_fixture: 'ref133_visual' },
    },
  ])
  if (profErr) throw new Error(profErr.message || 'PROFILES_INSERT_FAILED')

  const { error: codeErr } = await supabaseAdmin.from('referral_codes').insert({
    id: CODE_ID,
    user_id: REF133_VISUAL.ambassadorId,
    code: REF133_VISUAL.refCode,
    is_active: true,
    metadata: { e2e_fixture: 'ref133_visual' },
  })
  if (codeErr) throw new Error(codeErr.message || 'REFERRAL_CODE_INSERT_FAILED')

  const referredAt = new Date(Date.now() - 14 * 86400000).toISOString()
  const { error: relErr } = await supabaseAdmin.from('referral_relations').insert([
    {
      id: REL_PARTNER,
      referrer_id: REF133_VISUAL.ambassadorId,
      referee_id: REF133_VISUAL.refereePartnerId,
      referral_code_id: CODE_ID,
      referred_at: referredAt,
      network_depth: 1,
      ancestor_path: [REF133_VISUAL.ambassadorId],
      metadata: { e2e_fixture: 'ref133_visual' },
    },
    {
      id: REL_RENTER,
      referrer_id: REF133_VISUAL.ambassadorId,
      referee_id: REF133_VISUAL.refereeRenterId,
      referral_code_id: CODE_ID,
      referred_at: referredAt,
      network_depth: 1,
      ancestor_path: [REF133_VISUAL.ambassadorId],
      metadata: { e2e_fixture: 'ref133_visual' },
    },
  ])
  if (relErr) throw new Error(relErr.message || 'RELATIONS_INSERT_FAILED')

  await insertBooking({
    id: BOOKING_PARTNER,
    partnerId: REF133_VISUAL.refereePartnerId,
    renterId: REF133_VISUAL.refereeRenterId,
    tag: `${TAG} host`,
  })
  await insertBooking({
    id: BOOKING_RENTER,
    partnerId: REF133_VISUAL.ambassadorId,
    renterId: REF133_VISUAL.refereeRenterId,
    tag: `${TAG} guest`,
  })

  const { error: ledgerErr } = await supabaseAdmin.from('referral_ledger').insert([
    {
      id: LEDGER_PARTNER,
      booking_id: BOOKING_PARTNER,
      referrer_id: REF133_VISUAL.ambassadorId,
      referee_id: REF133_VISUAL.refereePartnerId,
      amount_thb: AMT_PARTNER,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 1,
      status: 'earned',
      earned_at: earnedAt,
      metadata: { e2e_fixture: 'ref133_visual' },
    },
    {
      id: LEDGER_RENTER,
      booking_id: BOOKING_RENTER,
      referrer_id: REF133_VISUAL.ambassadorId,
      referee_id: REF133_VISUAL.refereeRenterId,
      amount_thb: AMT_RENTER,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 1,
      status: 'earned',
      earned_at: earnedAt,
      metadata: { e2e_fixture: 'ref133_visual' },
    },
  ])
  if (ledgerErr) throw new Error(ledgerErr.message || 'LEDGER_INSERT_FAILED')

  return {
    email: REF133_VISUAL.email,
    password: PASSWORD,
    ambassadorId: REF133_VISUAL.ambassadorId,
    rubRateToThb,
  }
}
