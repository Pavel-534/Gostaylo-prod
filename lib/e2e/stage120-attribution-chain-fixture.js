/**
 * Stage 120.1 — E2E: click → attribution → signup → booking → ledger attribution_id.
 * SSOT: ReferralAttributionService + ReferralGuardService + ReferralPnlService.distribute.
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';
import ReferralGuardService from '@/lib/services/marketing/referral-guard.service';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { supabaseAdmin } from '@/lib/supabase';
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag';
import { STAGE72_REUSE_LISTING_ID } from '@/lib/e2e/test-listing-cleanup';
import { computeInviteTreeFields } from '@/lib/referral/referral-network.js';
import { makeId } from '@/lib/services/marketing/referral-calculation.js';

function makeProfileId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeRefCode(seed) {
  const clean = String(seed)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `AIR-${clean || Math.floor(100000 + Math.random() * 900000)}`;
}

/** Minimal Request-like object for attribution SSOT in Node. */
function buildMockRequest({ clickId, fingerprint, ip = '203.0.113.55' }) {
  const headers = {
    get(name) {
      const n = String(name || '').toLowerCase();
      if (n === 'x-forwarded-for') return ip;
      if (n === 'x-real-ip') return ip;
      if (n === 'user-agent') return 'E2E-Stage120-Attribution/1.0';
      return null;
    },
  };
  return {
    headers,
    cookies: {
      get(name) {
        if (String(name) === 'gostaylo_ref') {
          return { value: encodeURIComponent(String(clickId || '')) };
        }
        return undefined;
      },
    },
  };
}

function buildPricingSnapshotCommission1000() {
  return {
    fee_split_v2: {
      immutable: true,
      guest_service_fee_thb: 1000,
      host_commission_thb: 0,
      guest_service_fee_percent: 10,
      host_commission_percent: 0,
      insurance_reserve_thb: 50,
      insurance_fund_percent: 5,
      platform_gross_revenue_thb: 1000,
    },
  };
}

async function assertAttributionTableReady() {
  const { error } = await supabaseAdmin.from('referral_attributions').select('id').limit(1);
  if (error) {
    throw new Error(
      `E2E_120_REQUIRES_MIGRATION: ${error.message} (apply migrations/stage120_0_referral_attributions.sql)`,
    );
  }
}

const SMOKE_CATEGORY_FALLBACK_ID = 'cat-property';

/** @param {string | undefined | null} [preferredId] */
async function resolveSmokeCategoryId(preferredId) {
  const trimmed = String(preferredId || '').trim();
  if (trimmed) return trimmed;

  const { data: catRow, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (catErr) throw new Error(`E2E_120_CATEGORY_READ: ${catErr.message}`);
  if (catRow?.id) return catRow.id;

  const { error: upsertErr } = await supabaseAdmin.from('categories').upsert(
    {
      id: SMOKE_CATEGORY_FALLBACK_ID,
      name: 'Property',
      slug: 'property',
      icon: 'Home',
      order: 1,
      is_active: true,
    },
    { onConflict: 'id' },
  );
  if (upsertErr) throw new Error(`E2E_120_CATEGORY_SEED: ${upsertErr.message}`);
  return SMOKE_CATEGORY_FALLBACK_ID;
}

/**
 * @param {{ categoryId?: string }} [options]
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function runStage120AttributionChainFixture(options = {}) {
  if (!supabaseAdmin) throw new Error('SUPABASE_NOT_CONFIGURED');
  await assertAttributionTableReady();

  const tag = `${E2E_TEST_DATA_TAG} stage120-attribution`;
  const fingerprint = `e2e-fp-120-${Date.now().toString(36)}`;
  const utmSource = 'e2e_newsletter';
  const utmMedium = 'email';
  const utmCampaign = 'stage120_chain';

  const referrerId = makeProfileId('user-s120-ref');
  const refereeId = makeProfileId('user-s120-new');
  const referrerEmail = `s120-ref-${Date.now()}@test.gostaylo.invalid`;
  const refereeEmail = `s120-new-${Date.now()}@test.gostaylo.invalid`;
  const referrerCode = makeRefCode(referrerId);
  const bcryptHash = bcrypt.hashSync('e2e-stage120-pass', 10);
  // Unique IP per run — fixed 203.0.113.120 hits DAILY_CONVERT_LIMIT_PER_IP (12) after repeated smokes.
  const mockIp = `203.0.113.${100 + (Date.now() % 155)}`;

  const { error: refProfErr } = await supabaseAdmin.from('profiles').insert({
    id: referrerId,
    email: referrerEmail,
    password_hash: bcryptHash,
    role: 'RENTER',
    referral_code: referrerCode,
    first_name: 'Referrer120',
    language: 'ru',
    preferred_currency: 'THB',
    is_verified: true,
  });
  if (refProfErr) throw new Error(`referrer profile: ${refProfErr.message}`);

  await supabaseAdmin.from('referral_codes').upsert(
    {
      id: makeId('rfc'),
      user_id: referrerId,
      code: referrerCode,
      is_active: true,
      metadata: { e2e: tag, source: 'stage120_fixture' },
    },
    { onConflict: 'user_id' },
  );

  const trackReq = buildMockRequest({ clickId: '', fingerprint, ip: mockIp });
  const track = await ReferralAttributionService.recordClick({
    request: trackReq,
    code: referrerCode,
    landingPath: '/?ref=' + referrerCode,
    utmSource,
    utmMedium,
    utmCampaign,
    fingerprint,
  });
  if (!track.success) {
    throw new Error(`E2E_120_TRACK: ${track.error || 'track failed'}`);
  }
  const clickId = track.data.clickId;
  const winningAttributionId = track.data.attributionId;

  const { data: attrRows, error: attrReadErr } = await supabaseAdmin
    .from('referral_attributions')
    .select('id, click_id, touch_type, status, device_hash, utm_source, utm_medium, utm_campaign, referrer_id')
    .in('click_id', [clickId, track.data.firstClickId].filter(Boolean));
  if (attrReadErr) throw new Error(`E2E_120_ATTR_READ: ${attrReadErr.message}`);
  if (!attrRows?.length) throw new Error('E2E_120_NO_ATTRIBUTION_ROWS');

  const lastRow = attrRows.find((r) => r.touch_type === 'last');
  if (!lastRow) throw new Error('E2E_120_MISSING_LAST_TOUCH');
  if (lastRow.status !== 'clicked') throw new Error(`E2E_120_LAST_STATUS: ${lastRow.status}`);
  if (!lastRow.device_hash) throw new Error('E2E_120_MISSING_DEVICE_HASH');
  if (lastRow.utm_source !== utmSource || lastRow.utm_medium !== utmMedium) {
    throw new Error('E2E_120_UTM_MISMATCH');
  }
  if (String(lastRow.referrer_id) !== referrerId) {
    throw new Error('E2E_120_REFERRER_MISMATCH_ON_ATTR');
  }

  const signupReq = buildMockRequest({ clickId, fingerprint, ip: mockIp });
  const convertGate = await ReferralAttributionService.assertConvertAllowed({
    request: signupReq,
    fingerprint,
  });
  if (!convertGate.allowed) {
    throw new Error(`E2E_120_CONVERT_GATE: ${convertGate.error}`);
  }

  const resolved = await ReferralAttributionService.resolveCodeForSignup({
    request: signupReq,
    fingerprint,
  });
  if (!resolved?.code || normalizeCode(resolved.code) !== normalizeCode(referrerCode)) {
    throw new Error(
      `E2E_120_RESOLVE_CODE: expected ${referrerCode}, got ${resolved?.code || 'null'}`,
    );
  }

  const guard = await ReferralGuardService.validateActivation({
    code: resolved.code,
    candidateEmail: refereeEmail,
    request: signupReq,
    fingerprint,
  });
  if (!guard.success) throw new Error(`E2E_120_GUARD: ${guard.error}`);

  const { error: refErr } = await supabaseAdmin.from('profiles').insert({
    id: refereeId,
    email: refereeEmail,
    password_hash: bcryptHash,
    role: 'RENTER',
    referral_code: makeRefCode(refereeId),
    referred_by: referrerCode,
    first_name: 'Referee120',
    language: 'ru',
    preferred_currency: 'THB',
    is_verified: true,
  });
  if (refErr) throw new Error(`referee profile: ${refErr.message}`);

  const already = await ReferralAttributionService.refereeAlreadyReferred(refereeId);
  if (already) throw new Error('E2E_120_REFEREE_ALREADY_REFERRED_UNEXPECTED');

  const tree = await computeInviteTreeFields(supabaseAdmin, referrerId);
  const nowIso = new Date().toISOString();
  const { error: relErr } = await supabaseAdmin.from('referral_relations').insert({
    id: makeId('rfr'),
    referrer_id: referrerId,
    referee_id: refereeId,
    referred_at: nowIso,
    created_at: nowIso,
    network_depth: tree.network_depth,
    ancestor_path: tree.ancestor_path,
    metadata: {
      referral_code: referrerCode,
      trigger: 'e2e_stage120_register',
      attribution_id: winningAttributionId,
      e2e: tag,
    },
  });
  if (relErr) throw new Error(`E2E_120_RELATION: ${relErr.message}`);

  const marked = await ReferralAttributionService.markConvertedOnSignup({
    profileId: refereeId,
    request: signupReq,
    fingerprint,
  });
  if (!marked.ok) throw new Error(`E2E_120_MARK_CONVERTED: ${marked.reason}`);

  const { data: convertedAttrs } = await supabaseAdmin
    .from('referral_attributions')
    .select('id, status, converted_profile_id, touch_type')
    .eq('converted_profile_id', refereeId);
  if (!convertedAttrs?.length || convertedAttrs.some((r) => r.status !== 'converted')) {
    throw new Error('E2E_120_ATTR_NOT_CONVERTED');
  }
  const firstTouch = convertedAttrs.find((r) => r.touch_type === 'first');
  const lastTouch = convertedAttrs.find((r) => r.touch_type === 'last');
  if (!firstTouch || !lastTouch) {
    throw new Error('E2E_120_MISSING_FIRST_OR_LAST_AFTER_SIGNUP');
  }

  const categoryId = await resolveSmokeCategoryId(options.categoryId);

  const listingId = STAGE72_REUSE_LISTING_ID;
  await supabaseAdmin.from('listings').upsert(
    {
      id: listingId,
      owner_id: referrerId,
      category_id: categoryId,
      status: 'ACTIVE',
      title: `${tag} listing`,
      description: tag,
      district: 'Patong',
      base_price_thb: 10000,
      commission_rate: 10,
      images: [],
      available: true,
      instant_booking: true,
      max_capacity: 2,
      metadata: { e2e_fixture: 'stage120-attribution' },
    },
    { onConflict: 'id' },
  );

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 45);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);
  const snap = buildPricingSnapshotCommission1000();
  const bookingId = randomUUID();

  const { error: bookingInsErr } = await supabaseAdmin.from('bookings').insert({
    id: bookingId,
    listing_id: listingId,
    renter_id: refereeId,
    partner_id: referrerId,
    status: 'PENDING',
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: 10000,
    currency: 'THB',
    price_paid: 11000,
    exchange_rate: 1,
    commission_thb: 1000,
    commission_rate: 0,
    applied_commission_rate: 0,
    partner_earnings_thb: 9000,
    guest_name: 'E2E Referee120',
    guest_phone: '0000000120',
    guest_email: refereeEmail,
    guests_count: 1,
    special_requests: tag,
    pricing_snapshot: snap,
    metadata: { e2e_fixture: 'stage120-attribution' },
  });
  if (bookingInsErr) throw new Error(`E2E_120_BOOKING_INSERT: ${bookingInsErr.message}`);

  const attributionIdFromAttach = await ReferralAttributionService.attachBooking({
    bookingId,
    renterId: refereeId,
  });
  if (!attributionIdFromAttach) {
    throw new Error('E2E_120_ATTACH_BOOKING_RETURNED_NULL');
  }

  const { data: bookingAfterAttach } = await supabaseAdmin
    .from('bookings')
    .select('id, metadata')
    .eq('id', bookingId)
    .maybeSingle();
  await supabaseAdmin
    .from('bookings')
    .update({
      status: 'COMPLETED',
      metadata: {
        ...(bookingAfterAttach?.metadata && typeof bookingAfterAttach.metadata === 'object'
          ? bookingAfterAttach.metadata
          : {}),
        referral_attribution_id: attributionIdFromAttach,
      },
    })
    .eq('id', bookingId);

  const metaAttrId = attributionIdFromAttach;

  const { data: attrBooking } = await supabaseAdmin
    .from('referral_attributions')
    .select('id, booking_id')
    .eq('id', metaAttrId)
    .maybeSingle();
  if (String(attrBooking?.booking_id || '') !== bookingId) {
    throw new Error('E2E_120_ATTRIBUTION_BOOKING_ID_MISMATCH');
  }

  const dist = await ReferralPnlService.distribute(bookingId, { trigger: 'e2e_stage120_completed' });
  if (dist.success === false && !dist.skipped) {
    throw new Error(`E2E_120_DISTRIBUTE: ${dist.error || 'failed'}`);
  }
  if (
    dist.skipped &&
    dist.reason !== 'ALREADY_EARNED' &&
    dist.reason !== 'REWARD_RULE_MIN_BOOKING_BLOCK'
  ) {
    throw new Error(`E2E_120_DISTRIBUTE_SKIPPED: ${dist.reason}`);
  }

  if (dist.skipped && dist.reason === 'REWARD_RULE_MIN_BOOKING_BLOCK') {
    return {
      success: true,
      data: {
        tag,
        clickId,
        attributionId: metaAttrId,
        referrerId,
        refereeId,
        bookingId,
        ledgerRowCount: 0,
        distribute: { skipped: dist.skipped, reason: dist.reason },
        touches: { first: firstTouch.id, last: lastTouch.id },
      },
    };
  }

  const ledgerRows = await fetchReferralLedgerRowsWithBackoff(bookingId);
  if (!ledgerRows.length) {
    throw new Error('E2E_120_NO_LEDGER_ROWS');
  }
  for (const row of ledgerRows) {
    const aid = row?.metadata?.attribution_id;
    if (!aid) {
      throw new Error(`E2E_120_LEDGER_MISSING_ATTRIBUTION_ID: ledger ${row.id}`);
    }
    if (String(aid) !== String(metaAttrId)) {
      throw new Error(`E2E_120_LEDGER_ATTRIBUTION_MISMATCH: ${aid} vs ${metaAttrId}`);
    }
  }

  return {
    success: true,
    data: {
      tag,
      clickId,
      attributionId: metaAttrId,
      referrerId,
      refereeId,
      bookingId,
      ledgerRowCount: ledgerRows.length,
      distribute: { skipped: dist.skipped, reason: dist.reason },
      touches: { first: firstTouch.id, last: lastTouch.id },
    },
  };
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

/**
 * Stage 127.1 — poll referral_ledger after distribute (async DB visibility).
 * @param {string} bookingId
 * @returns {Promise<object[]>}
 */
async function fetchReferralLedgerRowsWithBackoff(bookingId) {
  let delayMs = 500;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: ledgerRows, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, status, metadata, amount_thb, type')
      .eq('booking_id', bookingId)
      .in('status', ['pending', 'earned', 'earned_held']);
    if (error) throw new Error(`E2E_120_LEDGER_READ: ${error.message}`);
    if (ledgerRows?.length) return ledgerRows;
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  return [];
}
