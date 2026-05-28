/**
 * Stage 123.0 (B4) — SSOT для версионированных правил начисления + shadow A/B.
 * Экономика (margin, safety cap 95%, split в payout) — referral-pnl.service.js без изменений.
 * Production rule влияет на hold_days (после override кампании).
 * Shadow rule — только metadata.reward_rule_shadow на выбранном % трафика.
 */
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { makeId } from '@/lib/services/marketing/referral-calculation.js';

const TABLE = 'referral_reward_rules';

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clampHoldDays(days) {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(90, Math.max(0, n));
}

function clampShadowPct(pct) {
  const n = Math.floor(Number(pct));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function normalizeSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return s || null;
}

export function normalizeRewardRulesPayload(rules) {
  const src = rules && typeof rules === 'object' ? rules : {};
  const holdRaw = src.hold_days ?? src.holdDays;
  const splitRaw = src.split_ratio ?? src.splitRatio;
  const minRaw = src.min_booking_value_thb ?? src.minBookingValueThb;
  const applySplitRaw = src.apply_split_in_production ?? src.applySplitInProduction;
  const holdDays = holdRaw == null || holdRaw === '' ? null : clampHoldDays(holdRaw);
  let splitRatio = null;
  if (splitRaw != null && splitRaw !== '') {
    const s = Number(splitRaw);
    if (Number.isFinite(s) && s > 0 && s < 1) splitRatio = round2(s);
  }
  let minBookingValueThb = null;
  if (minRaw != null && minRaw !== '') {
    const m = round2(minRaw);
    if (m > 0) minBookingValueThb = m;
  }
  return {
    hold_days: holdDays,
    split_ratio: splitRatio,
    min_booking_value_thb: minBookingValueThb,
    apply_split_in_production: applySplitRaw === true,
  };
}

function normalizeRow(row) {
  if (!row) return null;
  const rules = normalizeRewardRulesPayload(row.rules);
  return {
    id: String(row.id),
    version: Number(row.version) || 1,
    name: String(row.name || ''),
    isActive: row.is_active === true,
    isShadow: row.is_shadow === true,
    shadowTrafficPct: clampShadowPct(row.shadow_traffic_pct),
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null,
    campaignSlug: normalizeSlug(row.campaign_slug),
    priority: Number(row.priority) || 0,
    rules,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function isEffective(row, nowMs = Date.now()) {
  if (!row) return false;
  const fromMs = row.effectiveFrom ? Date.parse(row.effectiveFrom) : 0;
  const toMs = row.effectiveTo ? Date.parse(row.effectiveTo) : Infinity;
  if (Number.isNaN(fromMs)) return false;
  if (row.effectiveTo && Number.isNaN(toMs)) return false;
  return nowMs >= fromMs && nowMs < toMs;
}

/** Детерминированный bucket 0..99 для A/B shadow. */
export function inShadowTrafficBucket(bookingId, ruleId, shadowTrafficPct) {
  const pct = clampShadowPct(shadowTrafficPct);
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  const seed = `${String(bookingId || '').trim()}:${String(ruleId || '').trim()}`;
  if (!seed || seed === ':') return false;
  const hash = crypto.createHash('sha256').update(seed).digest();
  const bucket = hash.readUInt32BE(0) % 100;
  return bucket < pct;
}

function ruleMatchesCampaign(row, campaignSlug) {
  if (!row?.campaignSlug) return true;
  if (!campaignSlug) return false;
  return row.campaignSlug === normalizeSlug(campaignSlug);
}

function pickBestRule(candidates, campaignSlug) {
  const filtered = candidates
    .filter((r) => isEffective(r) && ruleMatchesCampaign(r, campaignSlug))
    .sort((a, b) => b.priority - a.priority || b.version - a.version);
  return filtered[0] || null;
}

async function readAllRules() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .order('priority', { ascending: false })
    .order('version', { ascending: false });
  if (error) {
    if (String(error.message || '').includes('does not exist')) return [];
    throw new Error(error.message || 'REWARD_RULES_READ_FAILED');
  }
  return (data || []).map(normalizeRow).filter(Boolean);
}

export async function listReferralRewardRules() {
  return readAllRules();
}

export async function getReferralRewardRuleById(id) {
  const safeId = String(id || '').trim();
  if (!safeId) return null;
  const { data, error } = await supabaseAdmin.from(TABLE).select('*').eq('id', safeId).maybeSingle();
  if (error) throw new Error(error.message || 'REWARD_RULE_READ_FAILED');
  return normalizeRow(data);
}

async function deactivateSiblings({ isShadow, excludeId }) {
  let q = supabaseAdmin
    .from(TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_shadow', !!isShadow);
  const ex = String(excludeId || '').trim();
  if (ex) q = q.neq('id', ex);
  const { error } = await q;
  if (error) throw new Error(error.message || 'REWARD_RULES_DEACTIVATE_FAILED');
}

export async function upsertReferralRewardRule(payload = {}) {
  const nowIso = new Date().toISOString();
  const id = String(payload.id || '').trim() || makeId('rrr');
  const existing = payload.id ? await getReferralRewardRuleById(id) : null;
  const version = Math.max(1, Math.floor(Number(payload.version ?? existing?.version ?? 1)));
  const name = String(payload.name || existing?.name || '').trim();
  if (!name) throw new Error('RULE_NAME_REQUIRED');

  const isShadow = payload.isShadow === true || payload.is_shadow === true;
  const isActive = payload.isActive !== false && payload.is_active !== false;
  const row = {
    id,
    version,
    name,
    is_active: isActive,
    is_shadow: isShadow,
    shadow_traffic_pct: clampShadowPct(payload.shadowTrafficPct ?? payload.shadow_traffic_pct ?? existing?.shadowTrafficPct ?? 0),
    effective_from: payload.effectiveFrom || payload.effective_from || existing?.effectiveFrom || nowIso,
    effective_to: payload.effectiveTo || payload.effective_to || existing?.effectiveTo || null,
    campaign_slug: normalizeSlug(payload.campaignSlug ?? payload.campaign_slug ?? existing?.campaignSlug),
    priority: Math.floor(Number(payload.priority ?? existing?.priority ?? 0)),
    rules: normalizeRewardRulesPayload(payload.rules ?? existing?.rules),
    created_by: payload.createdBy || payload.created_by || existing?.createdBy || null,
    updated_at: nowIso,
    created_at: existing?.createdAt || nowIso,
  };

  if (isActive) {
    await deactivateSiblings({ isShadow, excludeId: id });
  }

  const { error } = await supabaseAdmin.from(TABLE).upsert(row, { onConflict: 'id' });
  if (error) throw new Error(error.message || 'REWARD_RULE_UPSERT_FAILED');
  return getReferralRewardRuleById(id);
}

export async function setReferralRewardRuleActive(id, isActive) {
  const rule = await getReferralRewardRuleById(id);
  if (!rule) throw new Error('RULE_NOT_FOUND');
  return upsertReferralRewardRule({ ...rule, isActive: !!isActive });
}

/**
 * Резолв правил при начислении.
 * Приоритет hold: кампания (override) → production rule → default policy.
 */
export async function resolveRewardRulesForAccrual({
  bookingId,
  bookingPriceThb = 0,
  campaignGate = null,
  defaultHoldDays = 14,
  defaultSplitRatio = 0.5,
} = {}) {
  const bid = String(bookingId || '').trim();
  const campaignSlug =
    campaignGate?.campaign?.campaignSlug ||
    campaignGate?.campaignSlug ||
    null;
  const defaultHold = clampHoldDays(defaultHoldDays) ?? 14;

  let holdDays = defaultHold;
  let holdSource = 'default';
  let productionRule = null;

  if (campaignGate?.active && campaignGate.campaign?.overrideHoldDays != null) {
    holdDays = clampHoldDays(campaignGate.campaign.overrideHoldDays) ?? defaultHold;
    holdSource = 'campaign';
  } else {
    try {
      const all = await readAllRules();
      productionRule = pickBestRule(
        all.filter((r) => r.isActive && !r.isShadow),
        campaignSlug,
      );
      if (productionRule?.rules?.hold_days != null) {
        holdDays = productionRule.rules.hold_days;
        holdSource = 'reward_rule';
      }
    } catch (e) {
      console.warn('[referral-reward-rules] resolve skipped', e?.message || e);
    }
  }

  let shadowPayload = null;
  try {
    const all = await readAllRules();
    const shadowRule = pickBestRule(
      all.filter((r) => r.isActive && r.isShadow),
      campaignSlug,
    );
    if (shadowRule && bid && inShadowTrafficBucket(bid, shadowRule.id, shadowRule.shadowTrafficPct)) {
      const shadowHold =
        shadowRule.rules.hold_days != null ? shadowRule.rules.hold_days : holdDays;
      shadowPayload = {
        rule_id: shadowRule.id,
        rule_version: shadowRule.version,
        rule_name: shadowRule.name,
        shadow_traffic_pct: shadowRule.shadowTrafficPct,
        hold_days: shadowHold,
        split_ratio: shadowRule.rules.split_ratio ?? defaultSplitRatio,
        min_booking_value_thb: shadowRule.rules.min_booking_value_thb,
        would_block_min_booking:
          shadowRule.rules.min_booking_value_thb != null &&
          round2(bookingPriceThb) < shadowRule.rules.min_booking_value_thb,
        campaign_slug: campaignSlug,
      };
    }
  } catch (e) {
    console.warn('[referral-reward-rules] shadow skipped', e?.message || e);
  }

  const metadataPatch = {
    reward_rule_id: productionRule?.id ?? null,
    reward_rule_version: productionRule?.version ?? null,
    reward_rule_name: productionRule?.name ?? null,
    reward_rule_hold_source: holdSource,
    reward_rule_hold_days_applied: holdDays,
    ...(productionRule?.rules?.split_ratio != null
      ? { reward_rule_split_ratio_logged: productionRule.rules.split_ratio }
      : {}),
    ...(shadowPayload ? { reward_rule_shadow: shadowPayload } : {}),
  };

  return {
    holdDays,
    holdSource,
    productionRule,
    shadowPayload,
    metadataPatch,
  };
}

/**
 * Stage 123.1 — единый фасад SSOT:
 * campaign gate + reward rules + global defaults.
 */
export async function resolveReferralAccrualPolicy({
  bookingId,
  bookingPriceThb = 0,
  campaignGate = null,
  defaultHoldDays = 14,
  defaultSplitRatio = 0.5,
} = {}) {
  const rewardResolution = await resolveRewardRulesForAccrual({
    bookingId,
    bookingPriceThb,
    campaignGate,
    defaultHoldDays,
    defaultSplitRatio,
  });

  const productionRule = rewardResolution.productionRule;
  const productionRules = productionRule?.rules || {};
  const splitRolloutEnabled = productionRules.apply_split_in_production === true;
  const minBookingValueThb = productionRules.min_booking_value_thb;
  const bookingBelowMin =
    minBookingValueThb != null && round2(bookingPriceThb) < round2(minBookingValueThb);

  const shouldApplyProductionRule = !!productionRule && splitRolloutEnabled;
  const shouldBlockByMinBooking =
    shouldApplyProductionRule && minBookingValueThb != null && bookingBelowMin;
  const splitRatioApplied =
    shouldApplyProductionRule && productionRules.split_ratio != null
      ? productionRules.split_ratio
      : null;

  const metadataPatch = {
    ...rewardResolution.metadataPatch,
    reward_rule_applied: shouldApplyProductionRule,
    reward_rule_rollout_flag: splitRolloutEnabled,
    ...(shouldApplyProductionRule ? { reward_rule_split_ratio_applied: splitRatioApplied } : {}),
  };

  return {
    ...rewardResolution,
    metadataPatch,
    splitRolloutEnabled,
    shouldApplyProductionRule,
    splitRatioApplied,
    minBookingValueThb,
    shouldBlockByMinBooking,
  };
}

/** Агрегат для админки A/B — по metadata.reward_rule_version / shadow. */
export async function buildRewardRuleStatsFromLedger({ fromIso, toIso } = {}) {
  const from = fromIso || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = toIso || new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('id, amount_thb, status, metadata, created_at')
    .in('status', ['earned', 'earned_held', 'pending'])
    .gte('created_at', from)
    .lte('created_at', to)
    .limit(5000);
  if (error) throw new Error(error.message || 'REWARD_RULE_STATS_LEDGER_FAILED');

  const byVersion = new Map();
  const byShadow = new Map();

  for (const row of data || []) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const amount = round2(row.amount_thb);
    const ver = meta.reward_rule_version;
    const verKey = ver != null ? `v${ver}` : '(default)';
    if (!byVersion.has(verKey)) {
      byVersion.set(verKey, {
        ruleVersion: ver,
        ruleName: meta.reward_rule_name || null,
        accrualCount: 0,
        totalThb: 0,
        heldCount: 0,
      });
    }
    const v = byVersion.get(verKey);
    v.accrualCount += 1;
    v.totalThb = round2(v.totalThb + amount);
    if (String(row.status) === 'earned_held') v.heldCount += 1;

    const sh = meta.reward_rule_shadow;
    if (sh?.rule_version != null) {
      const sk = `shadow-v${sh.rule_version}`;
      if (!byShadow.has(sk)) {
        byShadow.set(sk, {
          ruleVersion: sh.rule_version,
          ruleName: sh.rule_name || null,
          sampleCount: 0,
          totalThb: 0,
          wouldBlockCount: 0,
        });
      }
      const s = byShadow.get(sk);
      s.sampleCount += 1;
      s.totalThb = round2(s.totalThb + amount);
      if (sh.would_block_min_booking) s.wouldBlockCount += 1;
    }
  }

  return {
    production: [...byVersion.values()].sort((a, b) => String(b.ruleVersion).localeCompare(String(a.ruleVersion))),
    shadow: [...byShadow.values()].sort((a, b) => b.sampleCount - a.sampleCount),
  };
}
