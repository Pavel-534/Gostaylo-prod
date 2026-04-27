/**
 * Stage 72.4 E2E — воспроизводит симуляцию из scripts/simulate-stage72-4-marketing-cashflow.mjs:
 * 5 профилей (A→B→C,D от C), листинг C, две брони COMPLETED (D реферал, E органика).
 * Вызывает ReferralPnlService.distribute и distributeHostPartnerActivation по порядку.
 *
 * Требует Supabase + RPC adjust_marketing_promo_pot + миграции wallet/referral.
 */

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag';

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

/** @returns {Promise<{ snapshot: Record<string, unknown>|null }>} */
async function loadGeneralSnapshot() {
  const { data, error } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle();
  if (error) throw new Error(error.message || 'SETTINGS_READ_FAILED');
  if (!data || data.value == null) {
    throw new Error(
      'E2E_STAGE72_REQUIRES_SYSTEM_SETTINGS: добавьте строку system_settings key=general (см. сиды / админку).',
    );
  }
  const v = data.value;
  const snapshot = typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : {};
  return { snapshot };
}

async function persistGeneral(generalObj) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: 'general',
      value: generalObj,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw new Error(error.message || 'SETTINGS_WRITE_FAILED');
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

/**
 * Запуск сценария.
 * @returns {Promise<object>}
 */
export async function runStage72ReferralCashflowFixture() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  let settingsBackup = null;
  const tag = `${E2E_TEST_DATA_TAG} stage72-cashflow`;

  try {
    const loaded = await loadGeneralSnapshot();
    settingsBackup = loaded.snapshot;

    /** Явные snake+camel — в прод-объекте часто живут оба (`getReferralSettings` читает snake первым). */
    const patched = {
      ...settingsBackup,
      /** Максимум по коду — 95% (`SAFETY_LOCK_MAX_SHARE`); 100 игнорируется. */
      referral_reinvestment_percent: 95,
      referralReinvestmentPercent: 95,
      referral_split_ratio: 0.5,
      referralSplitRatio: 0.5,
      acquiring_fee_percent: 15,
      acquiringFeePercent: 15,
      operational_reserve_percent: 15,
      operationalReservePercent: 15,
      payout_to_internal_ratio: 70,
      payoutToInternalRatio: 70,
      partner_activation_bonus: 500,
      partnerActivationBonus: 500,
      mlm_level1_percent: 70,
      mlmLevel1Percent: 70,
      mlm_level2_percent: 30,
      mlmLevel2Percent: 30,
      organic_to_promo_pot_percent: 15,
      organicToPromoPotPercent: 15,
      marketing_promo_pot: 500,
      marketingPromoPot: 500,
      promo_turbo_mode_enabled: false,
      promoTurboModeEnabled: false,
      promo_boost_per_booking: 0,
      promoBoostPerBooking: 0,
      referral_boost_allocation_rule: 'split_50_50',
      referralBoostAllocationRule: 'split_50_50',
    };

    await persistGeneral(patched);

    const bcryptHash = bcrypt.hashSync('e2e-stage72-pass-1', 10);

    const idA = makeProfileId('user-s72-a');
    const idB = makeProfileId('user-s72-b');
    const idC = makeProfileId('user-s72-c');
    const idD = makeProfileId('user-s72-d');
    const idE = makeProfileId('user-s72-e');

    const emailA = `s72-${Date.now()}-a@test.gostaylo.invalid`;
    const emailB = `s72-${Date.now()}-b@test.gostaylo.invalid`;
    const emailC = `s72-${Date.now()}-c@test.gostaylo.invalid`;
    const emailD = `s72-${Date.now()}-d@test.gostaylo.invalid`;
    const emailE = `s72-${Date.now()}-e@test.gostaylo.invalid`;

    const codeA = makeRefCode(idA);
    const codeB = makeRefCode(idB);
    const codeC = makeRefCode(idC);
    const codeD = makeRefCode(idD);
    const codeE = makeRefCode(idE);

    const profilesPayload = [
      {
        id: idA,
        email: emailA,
        password_hash: bcryptHash,
        role: 'RENTER',
        referral_code: codeA,
        referred_by: null,
        first_name: 'UserA',
        language: 'ru',
        preferred_currency: 'THB',
        preferred_payout_currency: 'THB',
        is_verified: true,
      },
      {
        id: idB,
        email: emailB,
        password_hash: bcryptHash,
        role: 'RENTER',
        referral_code: codeB,
        referred_by: codeA,
        first_name: 'UserB',
        language: 'ru',
        preferred_currency: 'THB',
        preferred_payout_currency: 'THB',
        is_verified: true,
      },
      {
        id: idC,
        email: emailC,
        password_hash: bcryptHash,
        role: 'PARTNER',
        referral_code: codeC,
        referred_by: codeB,
        first_name: 'UserC',
        language: 'ru',
        preferred_currency: 'THB',
        preferred_payout_currency: 'THB',
        is_verified: true,
      },
      {
        id: idD,
        email: emailD,
        password_hash: bcryptHash,
        role: 'RENTER',
        referral_code: codeD,
        referred_by: codeC,
        first_name: 'UserD',
        language: 'ru',
        preferred_currency: 'THB',
        preferred_payout_currency: 'THB',
        is_verified: true,
      },
      {
        id: idE,
        email: emailE,
        password_hash: bcryptHash,
        role: 'RENTER',
        referral_code: codeE,
        referred_by: null,
        first_name: 'UserE',
        language: 'ru',
        preferred_currency: 'THB',
        preferred_payout_currency: 'THB',
        verification_status: 'VERIFIED',
        is_verified: true,
      },
    ];

    const { error: profErr } = await supabaseAdmin.from('profiles').insert(profilesPayload);
    if (profErr) throw new Error(`profiles insert: ${profErr.message}`);

    /**
     * Stage 72.5: у новых профилей по умолчанию tier-beginner → referral_tier_payout_ratio = 60%.
     * WalletService.addFunds для referral_bonus берёт долю из тира и перекрывает global payout_to_internal_ratio (70).
     * Для детерминированного E2E выравниваем долю с patched general.
     */
    const { error: tierErr } = await supabaseAdmin
      .from('profiles')
      .update({
        referral_tier_payout_ratio: 70,
        referral_tier_updated_at: new Date().toISOString(),
      })
      .in('id', [idA, idB, idC, idD, idE]);
    if (tierErr) throw new Error(`profiles tier alignment: ${tierErr.message}`);

    const nowIso = new Date().toISOString();
    /** Совместимо с computeInviteTreeFields / distributeHostPartnerActivation (L1=B, L2=A для хоста C). */
    const relRows = [
      {
        id: makeProfileId('rfr'),
        referrer_id: idA,
        referee_id: idB,
        referred_at: nowIso,
        created_at: nowIso,
        network_depth: 1,
        ancestor_path: [idA],
        metadata: { e2e: tag },
      },
      {
        id: makeProfileId('rfr'),
        referrer_id: idB,
        referee_id: idC,
        referred_at: nowIso,
        created_at: nowIso,
        network_depth: 2,
        ancestor_path: [idA, idB],
        metadata: { e2e: tag },
      },
      {
        id: makeProfileId('rfr'),
        referrer_id: idC,
        referee_id: idD,
        referred_at: nowIso,
        created_at: nowIso,
        network_depth: 3,
        ancestor_path: [idA, idB, idC],
        metadata: { e2e: tag },
      },
    ];

    const { error: relErr } = await supabaseAdmin.from('referral_relations').insert(relRows);
    if (relErr) throw new Error(`referral_relations insert: ${relErr.message}`);

    for (const u of profilesPayload) {
      const { error: rcErr } = await supabaseAdmin.from('referral_codes').upsert(
        {
          id: makeProfileId('rfc'),
          user_id: u.id,
          code: u.referral_code,
          is_active: true,
          metadata: { e2e: tag },
        },
        { onConflict: 'user_id' },
      );
      if (rcErr) throw new Error(`referral_codes upsert: ${rcErr.message}`);
    }

    const { data: catRow, error: catErr } = await supabaseAdmin
      .from('categories')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (catErr || !catRow?.id) throw new Error('NO_CATEGORY_FOR_FIXTURE');

    const listingId = randomUUID();
    const { error: listErr } = await supabaseAdmin.from('listings').insert({
      id: listingId,
      owner_id: idC,
      category_id: catRow.id,
      status: 'ACTIVE',
      title: `${tag} listing`,
      description: 'E2E Stage 72 cashflow',
      district: 'Patong',
      base_price_thb: 10000,
      commission_rate: 10,
      images: [],
      available: true,
      instant_booking: false,
      max_capacity: 1,
    });
    if (listErr) throw new Error(`listings insert: ${listErr.message}`);

    const snap = buildPricingSnapshotCommission1000();
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 30);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);

    const bookingD = randomUUID();
    const bookingE = randomUUID();

    const bookingRow = (bid, renterId) => ({
      id: bid,
      listing_id: listingId,
      renter_id: renterId,
      partner_id: idC,
      status: 'COMPLETED',
      check_in: checkIn.toISOString(),
      check_out: checkOut.toISOString(),
      price_thb: 10000,
      currency: 'THB',
      price_paid: 11000,
      exchange_rate: 1,
      commission_thb: 1000,
      /** Не начислять вторую «комиссию хоста» из subtotal — иначе gross > 1000 THB и пул режется по cap 95% от gross. */
      commission_rate: 0,
      applied_commission_rate: 0,
      partner_earnings_thb: 9000,
      guest_name: 'E2E Guest',
      guest_phone: '0000000000',
      guest_email: `${renterId}@guest.invalid`,
      guests_count: 1,
      special_requests: tag,
      pricing_snapshot: snap,
    });

    /** Нельзя вставлять обе COMPLETED сразу: host_activation требует ровно одну завершённую бронь хоста. */
    const { error: bErr1 } = await supabaseAdmin.from('bookings').insert(bookingRow(bookingD, idD));
    if (bErr1) throw new Error(`booking D insert: ${bErr1.message}`);

    const { data: bookingDRead, error: bReadErr } = await supabaseAdmin
      .from('bookings')
      .select('id,price_thb,commission_thb,commission_rate,applied_commission_rate,pricing_snapshot')
      .eq('id', bookingD)
      .maybeSingle();
    if (bReadErr || !bookingDRead) {
      throw new Error(`booking D re-read failed: ${bReadErr?.message || 'MISSING'}`);
    }
    const feeBaseProbe = ReferralPnlService.deriveFeeBaseFromBooking(bookingDRead);
    if (Math.abs(Number(feeBaseProbe.platformGrossRevenueThb) - 1000) > 0.05) {
      throw new Error(
        `E2E_STAGE72_GROSS_MISMATCH: platformGross=${feeBaseProbe.platformGrossRevenueThb} ` +
          `guest=${feeBaseProbe.guestServiceFeeThb} host=${feeBaseProbe.hostCommissionThb} ` +
          `commission_thb=${bookingDRead.commission_thb} snap=${JSON.stringify(bookingDRead.pricing_snapshot)?.slice(0, 800)}`,
      );
    }

    const dist1 = await ReferralPnlService.distribute(bookingD, { trigger: 'e2e_completed' });
    const act1 = await ReferralPnlService.distributeHostPartnerActivation(bookingD);

    const { error: bErr2 } = await supabaseAdmin.from('bookings').insert(bookingRow(bookingE, idE));
    if (bErr2) throw new Error(`booking E insert: ${bErr2.message}`);

    const dist2 = await ReferralPnlService.distribute(bookingE, { trigger: 'e2e_completed' });
    const act2 = await ReferralPnlService.distributeHostPartnerActivation(bookingE);

    const walletIds = [idA, idB, idC, idD];
    const walletRows = [];
    for (const uid of walletIds) {
      const { data: w } = await supabaseAdmin
        .from('user_wallets')
        .select('user_id,withdrawable_balance_thb,internal_credits_thb,balance_thb')
        .eq('user_id', uid)
        .maybeSingle();
      walletRows.push({
        userId: uid,
        withdrawable: Number(w?.withdrawable_balance_thb ?? 0),
        internal: Number(w?.internal_credits_thb ?? 0),
        balance: Number(w?.balance_thb ?? 0),
      });
    }

    const sumWd = Math.round(walletRows.reduce((s, r) => s + r.withdrawable, 0) * 100) / 100;
    const sumInt = Math.round(walletRows.reduce((s, r) => s + r.internal, 0) * 100) / 100;

    const { data: ledgerRows } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb,status,referral_type')
      .in('booking_id', [bookingD, bookingE])
      .eq('status', 'earned');

    const ledgerSum = Math.round(
      (ledgerRows || []).reduce((s, r) => s + Number(r.amount_thb || 0), 0) * 100,
    ) / 100;

    const genAfter = await PricingService.getGeneralPricingSettings();
    const promoPotAfter = Number(genAfter?.marketing_promo_pot ?? genAfter?.marketingPromoPot ?? 0);

    return {
      success: true,
      data: {
        users: { A: idA, B: idB, C: idC, D: idD, E: idE },
        bookingIds: { referral: bookingD, organic: bookingE, listingId },
        emails: { A: emailA, B: emailB, C: emailC, D: emailD, E: emailE },
        distribute: { booking1: dist1, hostActivation1: act1, booking2: dist2, hostActivation2: act2 },
        walletByUser: {
          User_A: walletRows.find((w) => w.userId === idA),
          User_B: walletRows.find((w) => w.userId === idB),
          User_C: walletRows.find((w) => w.userId === idC),
          User_D: walletRows.find((w) => w.userId === idD),
        },
        totals: {
          withdrawableSum: sumWd,
          internalSum: sumInt,
          ledgerEarnedSum: ledgerSum,
          marketingPromoPotAfter: promoPotAfter,
        },
        /** Согласовано с clamp reinvest ≤95%: гостевой пул 617.5 THB → суммы WD/INT ниже «идеальных» 577.5/572.5. */
        expected: {
          withdrawableSum: 566.125,
          internalSum: 551.375,
          ledgerEarnedSum: 1117.5,
          marketingPromoPotAfter: 97.5,
        },
      },
    };
  } finally {
    if (settingsBackup && typeof settingsBackup === 'object') {
      try {
        await persistGeneral(settingsBackup);
      } catch (e) {
        console.error('[stage72-fixture] failed to restore system_settings.general', e?.message || e);
      }
    }
  }
}
