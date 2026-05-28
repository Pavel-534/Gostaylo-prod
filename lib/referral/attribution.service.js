/**
 * Stage 120.0–120.6 — SSOT referral click attribution (first-touch 30d, last-touch 7d).
 *
 * Scope of THIS module:
 * - Click tracking, cookie `gostaylo_ref`, signup/booking bind, anti-fraud gates
 * - Admin read API assembly (`getAdminDashboard`) — delegates monetary metrics to
 *   `lib/finance/reporting.service.js` (Financial Intelligence Dashboard SSOT)
 *
 * Out of scope (use other SSOT):
 * - Payout economics / bonus amounts → `referral-pnl.service.js`, `referral-ledger.service.js`
 * - Promo tank debits → `referral-promo-tank.service.js`
 * - Margin, ROI, clawback, cohort rows → `FinancialReportingService`
 *
 * Economics unchanged — attribution is metadata trail only on ledger.
 */
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import ReferralGuardService, {
  resolveClientIpFromRequest,
} from '@/lib/services/marketing/referral-guard.service';
import { makeId } from '@/lib/services/marketing/referral-calculation.js';
import FinancialReportingService from '@/lib/finance/reporting.service.js';

export const REF_ATTRIBUTION_COOKIE = 'gostaylo_ref';

const MS_DAY = 86400000;
const FIRST_TOUCH_MS = 30 * MS_DAY;
const LAST_TOUCH_MS = 7 * MS_DAY;
/** Max track requests per IP per UTC day. */
const DAILY_TRACK_LIMIT_PER_IP = 120;
/** Max conversion attempts (signup binds) per device/IP per UTC day. */
const DAILY_CONVERT_LIMIT_PER_DEVICE = 8;
const DAILY_CONVERT_LIMIT_PER_IP = 12;

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function normalizeFingerprint(value) {
  const fp = String(value || '').trim();
  if (!fp) return null;
  return fp.slice(0, 160);
}

function hashValue(raw, salt = 'gostaylo-ref-v1') {
  const s = String(raw || '').trim();
  if (!s) return null;
  return createHash('sha256')
    .update(`${salt}:${s}`)
    .digest('hex')
    .slice(0, 64);
}

function deviceHashFromFingerprint(fingerprint) {
  return hashValue(normalizeFingerprint(fingerprint), 'device');
}

function ipHashFromRequest(request) {
  const ip = resolveClientIpFromRequest(request);
  return hashValue(ip, 'ip');
}

function buildIpToken(request) {
  const ip = resolveClientIpFromRequest(request);
  if (!ip) return null;
  return Buffer.from(ip).toString('base64').slice(0, 48);
}

function utcDayStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function utcDateKey(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildLastNDaysUtcKeys(n) {
  const keys = [];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(end.getTime() - i * MS_DAY);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function profileDisplayName(p) {
  if (!p) return '';
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return name || p.email || p.id || '';
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function readRefAttributionCookie(request) {
  let raw = '';
  try {
    raw = request?.cookies?.get?.(REF_ATTRIBUTION_COOKIE)?.value || '';
  } catch {
    raw = '';
  }
  if (!raw) return '';
  try {
    return decodeURIComponent(String(raw).trim());
  } catch {
    return String(raw).trim();
  }
}

function buildRefCookieHeader(clickId, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production';
  const encoded = encodeURIComponent(String(clickId));
  return `${REF_ATTRIBUTION_COOKIE}=${encoded}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`;
}

async function countSince(tableFilter) {
  const { count, error } = await supabaseAdmin
    .from('referral_attributions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', utcDayStartIso())
    .match(tableFilter);
  if (error) throw new Error(error.message || 'ATTRIBUTION_COUNT_FAILED');
  return Number(count || 0);
}

async function getActiveFirstTouch(deviceHash) {
  if (!deviceHash) return null;
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('referral_attributions')
    .select(
      'id, click_id, referrer_id, referral_code, touch_type, status, expires_at, converted_profile_id',
    )
    .eq('device_hash', deviceHash)
    .eq('touch_type', 'first')
    .eq('status', 'clicked')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function getByClickId(clickId) {
  const cid = String(clickId || '').trim();
  if (!cid) return null;
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('referral_attributions')
    .select(
      'id, click_id, referrer_id, referral_code, touch_type, status, expires_at, converted_profile_id, device_hash',
    )
    .eq('click_id', cid)
    .maybeSingle();
  if (!data) return null;
  if (data.status !== 'clicked') return null;
  if (data.expires_at && String(data.expires_at) < nowIso) return null;
  return data;
}

export class ReferralAttributionService {
  /**
   * Anti-fraud v2 (Phase A): rate limits + self-referral on track.
   * @returns {{ allowed: boolean, error?: string, status?: number }}
   */
  static async assertTrackAllowed({ request, code, candidateUserId = null, fingerprint = null }) {
    const ipHash = ipHashFromRequest(request);
    if (ipHash) {
      const ipTracks = await countSince({ ip_hash: ipHash });
      if (ipTracks >= DAILY_TRACK_LIMIT_PER_IP) {
        return { allowed: false, error: 'REFERRAL_TRACK_RATE_LIMIT', status: 429 };
      }
    }

    const resolved = await ReferralGuardService.resolveReferrerByCode(code);
    if (resolved.error) {
      return { allowed: false, error: resolved.error, status: resolved.status || 400 };
    }
    const referrerId = String(resolved.data.referrerProfile?.id || '').trim();
    const candidateId = String(candidateUserId || '').trim();
    if (candidateId && referrerId && candidateId === referrerId) {
      return { allowed: false, error: 'REFERRAL_SELF_BY_ID', status: 400 };
    }

    const deviceHash = deviceHashFromFingerprint(fingerprint);
    if (deviceHash) {
      const { count: deviceHourCount } = await supabaseAdmin
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString());
      if (Number(deviceHourCount || 0) >= 40) {
        return { allowed: false, error: 'REFERRAL_TRACK_DEVICE_THROTTLE', status: 429 };
      }
    }

    const fraud = await ReferralGuardService.runFraudChecksV2({
      source: 'track',
      referrerId,
      candidateUserId,
      candidateEmail: null,
      request,
      fingerprint,
      referrerProfile: resolved.data.referrerProfile,
    });
    if (fraud.severity === 'block') {
      await ReferralGuardService.enqueueFraudQueue({
        severity: 'block',
        source: 'track',
        ruleCodes: fraud.rulesTriggered,
        reason: fraud.reason,
        referrerId,
        candidateUserId,
        referralCode: resolved.data.code,
        campaignSlug: resolved.data.campaignSlug || null,
        metadata: fraud.metadata,
      });
      return { allowed: false, error: 'REFERRAL_TRACK_FRAUD_BLOCKED', status: 429 };
    }
    return {
      allowed: true,
      referrerId,
      referralCode: resolved.data.code,
      campaignSlug: resolved.data.campaignSlug || null,
      referralCodeRow: resolved.data.referralCodeRow,
      fraud,
    };
  }

  /**
   * Record last-touch click + first-touch if none active for device (30d).
   */
  static async recordClick({
    request,
    code,
    landingPath = null,
    utmSource = null,
    utmMedium = null,
    utmCampaign = null,
    fingerprint = null,
    candidateUserId = null,
  }) {
    const gate = await this.assertTrackAllowed({ request, code, candidateUserId, fingerprint });
    if (!gate.allowed) {
      return { success: false, error: gate.error, status: gate.status || 400 };
    }

    const now = Date.now();
    const deviceHash = deviceHashFromFingerprint(fingerprint);
    const ipHash = ipHashFromRequest(request);
    const clickId = makeId('clk');
    const lastExpires = new Date(now + LAST_TOUCH_MS).toISOString();
    const rows = [];
    const campaignSlug = gate.campaignSlug ? String(gate.campaignSlug).trim() : null;
    const ipToken = buildIpToken(request);

    const lastRow = {
      id: makeId('rat'),
      click_id: clickId,
      referrer_id: gate.referrerId,
      referral_code: gate.referralCode,
      touch_type: 'last',
      landing_path: landingPath ? String(landingPath).slice(0, 500) : null,
      utm_source: utmSource ? String(utmSource).slice(0, 120) : null,
      utm_medium: utmMedium ? String(utmMedium).slice(0, 120) : null,
      utm_campaign: utmCampaign ? String(utmCampaign).slice(0, 120) : null,
      device_hash: deviceHash,
      ip_hash: ipHash,
      status: 'clicked',
      expires_at: lastExpires,
      metadata: {
        source: 'track_api',
        campaign_slug: campaignSlug,
        ip_token: ipToken,
        fraud_suspicious: gate.fraud?.severity === 'review',
        fraud_rule_codes: gate.fraud?.rulesTriggered || [],
        fraud_severity: gate.fraud?.severity || 'allow',
        user_agent: request?.headers?.get?.('user-agent')?.slice(0, 200) || null,
      },
    };
    rows.push(lastRow);

    let firstClickId = null;
    const existingFirst = deviceHash ? await getActiveFirstTouch(deviceHash) : null;
    if (!existingFirst) {
      firstClickId = `${clickId}_f`;
      rows.push({
        ...lastRow,
        id: makeId('rat'),
        click_id: firstClickId,
        touch_type: 'first',
        expires_at: new Date(now + FIRST_TOUCH_MS).toISOString(),
        metadata: { ...lastRow.metadata, paired_last_click_id: clickId },
      });
    } else {
      firstClickId = existingFirst.click_id;
    }

    const { error } = await supabaseAdmin.from('referral_attributions').insert(rows);
    if (error) {
      return { success: false, error: error.message || 'ATTRIBUTION_INSERT_FAILED', status: 500 };
    }

    if (gate.fraud?.severity === 'review') {
      await ReferralGuardService.enqueueFraudQueue({
        severity: 'review',
        source: 'track',
        ruleCodes: gate.fraud?.rulesTriggered || [],
        reason: gate.fraud?.reason || null,
        referrerId: gate.referrerId,
        candidateUserId,
        referralCode: gate.referralCode,
        campaignSlug: campaignSlug || null,
        metadata: {
          ...(gate.fraud?.metadata && typeof gate.fraud.metadata === 'object'
            ? gate.fraud.metadata
            : {}),
          attribution_id: lastRow.id,
          click_id: clickId,
        },
      });
    }

    return {
      success: true,
      data: {
        clickId,
        firstClickId,
        attributionId: lastRow.id,
        referrerId: gate.referrerId,
        referralCode: gate.referralCode,
        cookieMaxAgeSec: Math.floor(LAST_TOUCH_MS / 1000),
        setCookie: buildRefCookieHeader(clickId, Math.floor(LAST_TOUCH_MS / 1000)),
      },
    };
  }

  /**
   * Resolve referral code for signup when client did not pass explicit code.
   * First-touch wins over last-touch cookie.
   */
  static async resolveCodeForSignup({ request, fingerprint = null }) {
    const deviceHash = deviceHashFromFingerprint(fingerprint);
    const first = deviceHash ? await getActiveFirstTouch(deviceHash) : null;
    const clickId = readRefAttributionCookie(request);
    const last = clickId ? await getByClickId(clickId) : null;
    const winner = first || last;
    if (!winner?.referral_code) return null;
    return {
      code: normalizeCode(winner.referral_code),
      attributionId: winner.id,
      clickId: winner.click_id,
      touchType: winner.touch_type,
      referrerId: winner.referrer_id,
    };
  }

  /**
   * After referral_relations created — mark attributions converted (idempotent).
   */
  static async markConvertedOnSignup({ profileId, request, fingerprint = null }) {
    const pid = String(profileId || '').trim();
    if (!pid) return { ok: false, reason: 'PROFILE_ID_REQUIRED' };

    const deviceHash = deviceHashFromFingerprint(fingerprint);
    const clickId = readRefAttributionCookie(request);
    const ids = new Set();

    const first = deviceHash ? await getActiveFirstTouch(deviceHash) : null;
    if (first?.id) ids.add(first.id);
    const last = clickId ? await getByClickId(clickId) : null;
    if (last?.id) ids.add(last.id);

    if (!ids.size) return { ok: true, updated: 0 };

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('referral_attributions')
      .update({
        status: 'converted',
        converted_profile_id: pid,
        converted_at: nowIso,
        updated_at: nowIso,
      })
      .in('id', [...ids])
      .eq('status', 'clicked');
    if (error) {
      console.warn('[ReferralAttribution] markConverted:', error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, updated: ids.size };
  }

  /**
   * Guard: do not create a new relation if referee already has one (first-touch policy).
   */
  static async refereeAlreadyReferred(refereeId) {
    const rid = String(refereeId || '').trim();
    if (!rid) return false;
    const { data } = await supabaseAdmin
      .from('referral_relations')
      .select('id')
      .eq('referee_id', rid)
      .maybeSingle();
    return Boolean(data?.id);
  }

  /**
   * Anti-fraud before binding on signup.
   */
  static async assertConvertAllowed({ request, fingerprint = null }) {
    const deviceHash = deviceHashFromFingerprint(fingerprint);
    const ipHash = ipHashFromRequest(request);
    if (deviceHash) {
      const { count: deviceConvertCount } = await supabaseAdmin
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .eq('status', 'converted')
        .gte('converted_at', utcDayStartIso());
      if (Number(deviceConvertCount || 0) >= DAILY_CONVERT_LIMIT_PER_DEVICE) {
        return { allowed: false, error: 'REFERRAL_CONVERT_DEVICE_LIMIT', status: 429 };
      }
    }
    if (ipHash) {
      const { count: ipConvertCount } = await supabaseAdmin
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .eq('status', 'converted')
        .gte('converted_at', utcDayStartIso());
      if (Number(ipConvertCount || 0) >= DAILY_CONVERT_LIMIT_PER_IP) {
        return { allowed: false, error: 'REFERRAL_CONVERT_IP_LIMIT', status: 429 };
      }
    }
    const fraud = await ReferralGuardService.runFraudChecksV2({
      source: 'convert',
      referrerId: null,
      request,
      fingerprint,
      candidateEmail: null,
      candidateUserId: null,
    });
    if (fraud.severity === 'block') {
      await ReferralGuardService.enqueueFraudQueue({
        severity: 'block',
        source: 'convert',
        ruleCodes: fraud.rulesTriggered,
        reason: fraud.reason,
        metadata: fraud.metadata,
      });
      return { allowed: false, error: 'REFERRAL_CONVERT_FRAUD_BLOCKED', status: 429 };
    }
    return { allowed: true };
  }

  /**
   * Link booking to converted attribution for renter (metadata trail).
   */
  static async attachBooking({ bookingId, renterId }) {
    const bid = String(bookingId || '').trim();
    const rid = String(renterId || '').trim();
    if (!bid || !rid) return null;

    const { data: attr } = await supabaseAdmin
      .from('referral_attributions')
      .select('id, booking_id, metadata')
      .eq('converted_profile_id', rid)
      .eq('status', 'converted')
      .order('converted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attr?.id) return null;
    if (attr.booking_id === bid) return attr.id;

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('referral_attributions')
      .update({
        booking_id: bid,
        updated_at: nowIso,
        metadata: {
          ...(attr.metadata && typeof attr.metadata === 'object' ? attr.metadata : {}),
          booking_attached_at: nowIso,
        },
      })
      .eq('id', attr.id);
    if (error) {
      console.warn('[ReferralAttribution] attachBooking:', error.message);
      return null;
    }
    return attr.id;
  }

  static async getAttributionIdForBooking(bookingId) {
    const bid = String(bookingId || '').trim();
    if (!bid) return null;
    const { data } = await supabaseAdmin
      .from('referral_attributions')
      .select('id, metadata')
      .eq('booking_id', bid)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.id) return null;
    return {
      id: data.id,
      campaignSlug: String(data?.metadata?.campaign_slug || '').trim() || null,
    };
  }

  static async getAttributionIdForRenter(renterId) {
    const rid = String(renterId || '').trim();
    if (!rid) return null;
    const { data } = await supabaseAdmin
      .from('referral_attributions')
      .select('id, metadata')
      .eq('converted_profile_id', rid)
      .eq('status', 'converted')
      .order('converted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.id) return null;
    return {
      id: data.id,
      campaignSlug: String(data?.metadata?.campaign_slug || '').trim() || null,
    };
  }

  /**
   * Stage 120.1–120.2 — admin dashboard aggregates (read-only).
   */
  static async getAdminDashboard({
    dateFrom = null,
    dateTo = null,
    status = null,
    referrerId = null,
    utmSource = null,
    minMarginThb = null,
    profitabilityFilter = 'all',
    tableLimit = 80,
    ledgerStatus = null,
    campaignSlug = null,
  } = {}) {
    const now = new Date();
    const toIso = dateTo ? new Date(dateTo).toISOString() : now.toISOString();
    const fromDefault = new Date(now.getTime() - 30 * MS_DAY);
    const fromIso = dateFrom ? new Date(dateFrom).toISOString() : fromDefault.toISOString();
    const rid = referrerId ? String(referrerId).trim() : '';
    const statusFilter = status ? String(status).trim().toLowerCase() : '';
    const ledgerStatusFilter = ledgerStatus ? String(ledgerStatus).trim().toLowerCase() : '';
    const utmFilter = utmSource ? String(utmSource).trim().toLowerCase() : '';
    const campaignFilter = String(campaignSlug || '').trim();
    const limit = Math.min(500, Math.max(1, Math.floor(Number(tableLimit) || 80)));

    const applyBase = (q, { touchType = null } = {}) => {
      let next = q.gte('created_at', fromIso).lte('created_at', toIso);
      if (rid) next = next.eq('referrer_id', rid);
      if (statusFilter) next = next.eq('status', statusFilter);
      if (utmFilter) next = next.ilike('utm_source', utmFilter);
      if (campaignFilter) next = next.contains('metadata', { campaign_slug: campaignFilter });
      if (touchType) next = next.eq('touch_type', touchType);
      return next;
    };

    const { count: clicksCount, error: clicksErr } = await applyBase(
      supabaseAdmin.from('referral_attributions').select('id', { count: 'exact', head: true }),
      { touchType: 'last' },
    );
    if (clicksErr) throw new Error(clicksErr.message || 'ATTRIBUTION_CLICKS_COUNT_FAILED');

    const { data: convertedRows, error: convErr } = await applyBase(
      supabaseAdmin
        .from('referral_attributions')
        .select('id, converted_profile_id, booking_id, converted_at, metadata')
        .eq('status', 'converted')
        .not('converted_profile_id', 'is', null),
    );
    if (convErr) throw new Error(convErr.message || 'ATTRIBUTION_CONVERTED_READ_FAILED');

    const registrationsSet = new Set();
    const bookingsSet = new Set();
    let suspiciousConversionsCount = 0;
    for (const row of convertedRows || []) {
      if (row.converted_profile_id) registrationsSet.add(String(row.converted_profile_id));
      if (row.booking_id) bookingsSet.add(String(row.booking_id));
      if (row?.metadata?.fraud_suspicious === true) suspiciousConversionsCount += 1;
    }
    const registrationsCount = registrationsSet.size;
    const bookingsCount = bookingsSet.size;
    const clicks = Number(clicksCount || 0);
    const clickToRegistrationPct = clicks > 0 ? round2((registrationsCount / clicks) * 100) : 0;
    const registrationToBookingPct =
      registrationsCount > 0 ? round2((bookingsCount / registrationsCount) * 100) : 0;
    const suspiciousConversionPct =
      registrationsCount > 0 ? round2((suspiciousConversionsCount / registrationsCount) * 100) : 0;

    const ledgerBundle = await FinancialReportingService.fetchReferralLedgerBundle({
      fromIso,
      toIso,
      referrerId: rid,
    });
    const ledgerRows = ledgerBundle.earnedRows;
    const clawbackRows = ledgerBundle.clawbackRows;

    const earnedByReferrer = new Map();
    const refereesWithEarned = new Set();
    let earnedTotalThb = 0;
    const earnedByAttributionId = new Map();
    const earnedByBookingId = new Map();
    const ledgerCountByAttributionId = new Map();

    for (const row of ledgerRows || []) {
      const refId = String(row.referrer_id || '').trim();
      const refereeId = String(row.referee_id || '').trim();
      const amt = Number(row.amount_thb) || 0;
      earnedTotalThb += amt;
      if (refereeId) refereesWithEarned.add(refereeId);
      if (refId) earnedByReferrer.set(refId, (earnedByReferrer.get(refId) || 0) + amt);

      const meta =
        row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      const attrId = meta.attribution_id ? String(meta.attribution_id).trim() : '';
      const bid = row.booking_id ? String(row.booking_id).trim() : '';
      if (attrId) {
        earnedByAttributionId.set(attrId, (earnedByAttributionId.get(attrId) || 0) + amt);
        ledgerCountByAttributionId.set(attrId, (ledgerCountByAttributionId.get(attrId) || 0) + 1);
      }
      if (bid) earnedByBookingId.set(bid, (earnedByBookingId.get(bid) || 0) + amt);
    }
    earnedTotalThb = round2(earnedTotalThb);
    const referralSpendThb = earnedTotalThb;

    const ledgerBookingIds = [
      ...new Set((ledgerRows || []).map((r) => String(r.booking_id || '').trim()).filter(Boolean)),
    ];
    const commissionBookingIds = [...new Set([...bookingsSet, ...ledgerBookingIds])];

    const periodMetrics = await FinancialReportingService.computeReferralPeriodMetrics({
      fromIso,
      toIso,
      earnedRows: ledgerRows,
      clawbackRows,
      commissionBookingIds,
    });

    const referrerMonetaryRowsRaw = await FinancialReportingService.buildReferrerMonetaryRows({
      fromIso,
      toIso,
      utmFilter,
      rid,
      minMarginThb,
      profitabilityFilter,
      earnedRows: ledgerRows,
      clawbackRows,
    });

    const funnel = await FinancialReportingService.computeReferralFunnelBundle({
      fromIso,
      toIso,
      referrerId: rid,
      utmFilter,
      earnedRows: ledgerRows,
    });
    let referrerMonetaryRows = FinancialReportingService.mergeReferrerRowsWithFunnel(
      referrerMonetaryRowsRaw,
      funnel,
    );

    if (ledgerStatusFilter === 'earned_held') {
      referrerMonetaryRows = referrerMonetaryRows.filter((row) => Number(row.heldBonusesThb) > 0);
    } else if (ledgerStatusFilter === 'earned') {
      referrerMonetaryRows = referrerMonetaryRows.filter((row) => Number(row.bonusesThb) > 0);
    }

    const heldReferralThb = await FinancialReportingService.fetchReferralHeldOutstandingThb({
      referrerId: rid,
    });
    const campaignRows = await FinancialReportingService.buildCampaignMetricsRows({
      fromIso,
      toIso,
      referrerId: rid,
      utmFilter,
      campaignSlugFilter: campaignFilter,
    });
    const campaignOptions = [...new Set(campaignRows.map((row) => String(row?.campaignSlug || '').trim()).filter(Boolean))];

    const profitableReferrersCount = referrerMonetaryRows.filter(
      (row) => Number(row.netMarginThb) > 0,
    ).length;

    const avgEarnedPerReferralThb = periodMetrics.avgEarnedPerReferralThb;
    const referredCommissionThb = periodMetrics.referredCommissionThb;
    const roiIndex = periodMetrics.roiIndex;

    const topIds = [...earnedByReferrer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
    let profileMap = new Map();
    if (topIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, first_name, last_name, referral_code')
        .in('id', topIds);
      profileMap = new Map((profiles || []).map((p) => [String(p.id), p]));
    }
    const topReferrers = topIds.map((id) => {
      const p = profileMap.get(id);
      return {
        referrerId: id,
        earnedThb: round2(earnedByReferrer.get(id) || 0),
        email: p?.email || null,
        referralCode: p?.referral_code || null,
        name: profileDisplayName(p) || id,
      };
    });

    const chartFromIso = new Date(now.getTime() - 30 * MS_DAY).toISOString();
    const dayKeys = buildLastNDaysUtcKeys(30);
    const chartByDay = new Map(dayKeys.map((k) => [k, { clicks: 0, registrations: 0, bookings: 0, earnedThb: 0 }]));

    const { data: chartClicks } = await supabaseAdmin
      .from('referral_attributions')
      .select('created_at')
      .eq('touch_type', 'last')
      .gte('created_at', chartFromIso)
      .lte('created_at', toIso);
    for (const row of chartClicks || []) {
      const k = utcDateKey(row.created_at);
      if (k && chartByDay.has(k)) chartByDay.get(k).clicks += 1;
    }

    const { data: chartConverted } = await supabaseAdmin
      .from('referral_attributions')
      .select('converted_profile_id, booking_id, converted_at, updated_at')
      .eq('status', 'converted')
      .gte('converted_at', chartFromIso)
      .lte('converted_at', toIso);
    const regByDay = new Map();
    for (const row of chartConverted || []) {
      const k = utcDateKey(row.converted_at || row.updated_at);
      if (!k || !chartByDay.has(k)) continue;
      const pid = row.converted_profile_id ? String(row.converted_profile_id) : '';
      if (pid) {
        if (!regByDay.has(k)) regByDay.set(k, new Set());
        regByDay.get(k).add(pid);
      }
      if (row.booking_id) {
        chartByDay.get(k).bookings += 1;
      }
    }
    for (const [k, set] of regByDay) {
      if (chartByDay.has(k)) chartByDay.get(k).registrations = set.size;
    }

    const { data: chartLedger } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb, earned_at, created_at')
      .eq('status', 'earned')
      .gte('created_at', chartFromIso)
      .lte('created_at', toIso);
    for (const row of chartLedger || []) {
      const k = utcDateKey(row.earned_at || row.created_at);
      if (k && chartByDay.has(k)) {
        chartByDay.get(k).earnedThb += Number(row.amount_thb) || 0;
      }
    }
    const chartDaily = dayKeys.map((date) => {
      const b = chartByDay.get(date);
      return {
        date,
        clicks: b.clicks,
        registrations: b.registrations,
        bookings: b.bookings,
        earnedThb: round2(b.earnedThb),
      };
    });

    const { data: tableRows, error: tableErr } = await applyBase(
      supabaseAdmin
        .from('referral_attributions')
        .select(
          'id, click_id, referrer_id, referral_code, touch_type, landing_path, utm_source, utm_medium, utm_campaign, device_hash, status, converted_profile_id, booking_id, expires_at, converted_at, created_at, metadata',
        )
        .order('created_at', { ascending: false })
        .limit(limit),
      { touchType: 'last' },
    );
    if (tableErr) throw new Error(tableErr.message || 'ATTRIBUTION_TABLE_READ_FAILED');

    const referrerIds = [
      ...new Set((tableRows || []).map((r) => String(r.referrer_id || '')).filter(Boolean)),
    ];
    const refMap = new Map();
    if (referrerIds.length) {
      const { data: refProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, first_name, last_name, referral_code')
        .in('id', referrerIds);
      for (const p of refProfiles || []) refMap.set(String(p.id), p);
    }

    const enrichedRows = (tableRows || []).map((row) => {
      const p = refMap.get(String(row.referrer_id || ''));
      const attrId = String(row.id || '');
      const bid = row.booking_id ? String(row.booking_id) : '';
      const earnedFromAttr = earnedByAttributionId.get(attrId) || 0;
      const earnedFromBooking = bid ? earnedByBookingId.get(bid) || 0 : 0;
      const earnedThb = round2(earnedFromAttr || earnedFromBooking);
      return {
        ...row,
        referrer_label: profileDisplayName(p) || row.referral_code,
        referrer_email: p?.email || null,
        earnedThb,
        ledgerRowCount: ledgerCountByAttributionId.get(attrId) || (earnedThb > 0 ? 1 : 0),
        utm_label: [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(' / ') || '—',
        campaign_slug: String(row?.metadata?.campaign_slug || '').trim() || null,
        fraud_suspicious: row?.metadata?.fraud_suspicious === true,
        fraud_rule_codes: Array.isArray(row?.metadata?.fraud_rule_codes) ? row.metadata.fraud_rule_codes : [],
        fraud_severity: String(row?.metadata?.fraud_severity || 'allow'),
      };
    });

    const { data: utmSourcesRaw } = await supabaseAdmin
      .from('referral_attributions')
      .select('utm_source')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .not('utm_source', 'is', null);
    const utmSourceOptions = [
      ...new Set(
        (utmSourcesRaw || [])
          .map((r) => String(r.utm_source || '').trim())
          .filter(Boolean),
      ),
    ].sort();

    return {
      period: { from: fromIso, to: toIso },
      chartDaily,
      funnel,
      metrics: {
        clicks,
        registrations: registrationsCount,
        bookingsAttributed: bookingsCount,
        clickToRegistrationPct,
        registrationToBookingPct,
        firstBookingUsersCount: funnel.summary.firstBookingUsersCount,
        repeatBookingUsersCount: funnel.summary.repeatBookingUsersCount,
        repeatBookingsCount: funnel.summary.repeatBookingsCount,
        signupToFirstBookingPct: funnel.summary.signupToFirstBookingPct,
        repeatUserPct: funnel.summary.repeatUserPct,
        registrationConversionPct: clickToRegistrationPct,
        bookingConversionPct: registrationToBookingPct,
        earnedBonusesThb: earnedTotalThb,
        referralSpendThb,
        referredCommissionThb,
        clawbackThb: periodMetrics.clawbackThb,
        grossMarginThb: periodMetrics.grossMarginThb,
        netMarginThb: periodMetrics.netMarginThb,
        avgEarnedPerReferralThb,
        profitableReferrersCount,
        roiIndex,
        roiPct: periodMetrics.roiPct,
        promoTankSpendThb: periodMetrics.promoTankSpendThb,
        promoTankBalanceThb: periodMetrics.promoTankBalanceThb,
        promoTankSpentPct: periodMetrics.promoTankSpentPct,
        heldReferralThb,
        suspiciousConversionsCount,
        suspiciousConversionPct,
      },
      topReferrers,
      campaignRows,
      campaignOptions,
      referrerMonetaryRows,
      utmSourceOptions,
      rows: enrichedRows,
    };
  }

  /** Stage 120.4–120.5 — delegates to FinancialReportingService (SSOT). */
  static async buildReferrerMonetaryRows(options) {
    return FinancialReportingService.buildReferrerMonetaryRows(options);
  }

  /** Stage 120.4–120.5 — drill-down + cohort tab via FinancialReportingService. */
  static async getAdminReferrerDetail(referrerId, options = {}) {
    return FinancialReportingService.getReferrerDetail(referrerId, options);
  }

  static buildAdminReferrerMonetaryCsv(rows) {
    return FinancialReportingService.buildReferrerMonetaryCsv(rows);
  }

  static buildAdminReferrerCohortCsv(referrerRows, cohortMap) {
    return FinancialReportingService.buildReferrerCohortCsv(referrerRows, cohortMap);
  }

  static async buildCohortMapForReferrers(referrerRows, period) {
    return FinancialReportingService.buildCohortMapForReferrers(referrerRows, period);
  }

  static async getAdminLedgerForAttribution(attributionId) {
    const aid = String(attributionId || '').trim();
    if (!aid) return { error: 'ATTRIBUTION_ID_REQUIRED', status: 400 };

    const { data: attr, error: attrErr } = await supabaseAdmin
      .from('referral_attributions')
      .select('id, click_id, booking_id, referrer_id, referral_code, status')
      .eq('id', aid)
      .maybeSingle();
    if (attrErr) throw new Error(attrErr.message || 'ATTRIBUTION_READ_FAILED');
    if (!attr) return { error: 'ATTRIBUTION_NOT_FOUND', status: 404 };

    const bookingId = attr.booking_id ? String(attr.booking_id) : '';

    const { data: byMeta, error: metaErr } = await supabaseAdmin
      .from('referral_ledger')
      .select(
        'id, booking_id, referrer_id, referee_id, amount_thb, type, status, referral_type, metadata, earned_at, created_at',
      )
      .contains('metadata', { attribution_id: aid })
      .order('created_at', { ascending: false });
    if (metaErr) throw new Error(metaErr.message || 'LEDGER_BY_META_FAILED');

    let byBooking = [];
    if (bookingId) {
      const { data, error } = await supabaseAdmin
        .from('referral_ledger')
        .select(
          'id, booking_id, referrer_id, referee_id, amount_thb, type, status, referral_type, metadata, earned_at, created_at',
        )
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message || 'LEDGER_BY_BOOKING_FAILED');
      byBooking = data || [];
    }

    const merged = new Map();
    for (const row of [...(byMeta || []), ...byBooking]) {
      merged.set(String(row.id), row);
    }
    const rows = [...merged.values()];
    const earnedTotalThb = round2(
      rows
        .filter((r) => String(r.status).toLowerCase() === 'earned')
        .reduce((s, r) => s + (Number(r.amount_thb) || 0), 0),
    );

    return {
      attribution: attr,
      rows,
      earnedTotalThb,
    };
  }

  static buildAdminDashboardCsv(rows) {
    const header = [
      'click_id',
      'referrer_id',
      'referrer_label',
      'referral_code',
      'campaign_slug',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'created_at',
      'status',
      'booking_id',
      'earned_thb',
      'converted_profile_id',
    ];
    const lines = [header.join(',')];
    for (const row of rows || []) {
      lines.push(
        [
          row.click_id,
          row.referrer_id,
          row.referrer_label,
          row.referral_code,
          row.campaign_slug,
          row.utm_source,
          row.utm_medium,
          row.utm_campaign,
          row.created_at,
          row.status,
          row.booking_id,
          row.earnedThb,
          row.converted_profile_id,
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }
}

export default ReferralAttributionService;
