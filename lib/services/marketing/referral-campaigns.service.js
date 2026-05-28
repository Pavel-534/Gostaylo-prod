import { supabaseAdmin } from '@/lib/supabase';
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import { computeBudgetAlertLevel, computeBudgetUsagePct, computeDaysUntilExpiry } from '@/lib/admin/referral-campaign-ui.js';
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js';

const SETTINGS_KEY = 'referral_campaigns';

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function normalizeCampaignSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function clampHoldDays(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(90, Math.max(0, n));
}

function normalizeCampaignRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const slug = normalizeCampaignSlug(row.slug);
  if (!slug) return null;
  const name = String(row.name || '').trim();
  if (!name) return null;
  const maxBudgetThb = Number(row.maxBudgetThb);
  const override = clampHoldDays(row.overrideHoldDays);
  const expires = String(row.campaignExpiresAt || '').trim();
  const expiresIso =
    expires && !Number.isNaN(new Date(expires).getTime()) ? new Date(expires).toISOString() : null;
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...row.metadata }
      : {};
  const budgetTopups = Array.isArray(metadata.budget_topups)
    ? metadata.budget_topups.filter((x) => x && typeof x === 'object')
    : [];
  return {
    slug,
    name,
    isActive: row.isActive !== false,
    maxBudgetThb: Number.isFinite(maxBudgetThb) && maxBudgetThb > 0 ? round2(maxBudgetThb) : null,
    campaignExpiresAt: expiresIso,
    overrideHoldDays: override,
    createdAt: row.createdAt ? String(row.createdAt) : new Date().toISOString(),
    updatedAt: row.updatedAt ? String(row.updatedAt) : new Date().toISOString(),
    metadata: { budget_topups: budgetTopups },
  };
}

function enrichCampaignRow(row, stats) {
  const maxBudget = row.maxBudgetThb != null ? round2(row.maxBudgetThb) : null;
  const spent = round2(stats.spentThb);
  const remaining = maxBudget != null ? round2(maxBudget - spent) : null;
  const nowMs = Date.now();
  const expired =
    !!row.campaignExpiresAt && !Number.isNaN(new Date(row.campaignExpiresAt).getTime())
      ? new Date(row.campaignExpiresAt).getTime() <= nowMs
      : false;
  const budgetExhausted = maxBudget != null && spent >= maxBudget;
  const status = row.isActive
    ? expired
      ? 'expired'
      : budgetExhausted
        ? 'budget_exhausted'
        : 'active'
    : 'paused';
  const budgetAlertLevel = computeBudgetAlertLevel(maxBudget, spent);
  const budgetUsagePct = computeBudgetUsagePct(maxBudget, spent);
  const daysUntilExpiry = computeDaysUntilExpiry(row.campaignExpiresAt);
  const budgetTopups = Array.isArray(row.metadata?.budget_topups) ? row.metadata.budget_topups : [];
  return {
    ...row,
    spentThb: spent,
    remainingBudgetThb: remaining,
    assignedCodes: stats.assignedCodes,
    status,
    budgetAlertLevel,
    budgetUsagePct,
    daysUntilExpiry,
    budgetTopups,
  };
}

async function readRegistry() {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message || 'REFERRAL_CAMPAIGNS_READ_FAILED');
  return Array.isArray(data?.value) ? data.value.map(normalizeCampaignRecord).filter(Boolean) : [];
}

async function writeRegistry(campaigns) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: campaigns.map(normalizeCampaignRecord).filter(Boolean),
    },
    { onConflict: 'key' },
  );
  if (error) throw new Error(error.message || 'REFERRAL_CAMPAIGNS_WRITE_FAILED');
}

async function patchCodesMetadataBySlug(slug, patch) {
  const safeSlug = normalizeCampaignSlug(slug);
  if (!safeSlug) return;
  const { data: codeRows, error } = await supabaseAdmin
    .from('referral_codes')
    .select('id, metadata')
    .eq('campaign_slug', safeSlug);
  if (error) throw new Error(error.message || 'REFERRAL_CODES_BY_CAMPAIGN_READ_FAILED');
  for (const row of codeRows || []) {
    const metadata = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
    metadata.campaign_slug = safeSlug;
    if (patch.maxBudgetThb != null) metadata.max_budget_thb = round2(patch.maxBudgetThb);
    else delete metadata.max_budget_thb;
    if (patch.campaignExpiresAt) metadata.campaign_expires_at = patch.campaignExpiresAt;
    else delete metadata.campaign_expires_at;
    if (patch.overrideHoldDays != null) metadata.override_hold_days = patch.overrideHoldDays;
    else delete metadata.override_hold_days;
    metadata.campaign_is_active = patch.isActive !== false;
    const { error: upErr } = await supabaseAdmin
      .from('referral_codes')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upErr) throw new Error(upErr.message || 'REFERRAL_CODE_METADATA_SYNC_FAILED');
  }
}

export async function listReferralCampaigns() {
  const registry = await readRegistry();
  const slugs = registry.map((x) => x.slug);
  const statsBySlug = new Map();
  if (slugs.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('referral_codes')
      .select('id,campaign_slug,metadata')
      .in('campaign_slug', slugs);
    if (error) throw new Error(error.message || 'REFERRAL_CAMPAIGNS_CODES_READ_FAILED');
    for (const row of data || []) {
      const slug = normalizeCampaignSlug(row?.campaign_slug);
      if (!slug) continue;
      if (!statsBySlug.has(slug)) statsBySlug.set(slug, { assignedCodes: 0, spentThb: 0 });
      const agg = statsBySlug.get(slug);
      agg.assignedCodes += 1;
      const spent = Number(row?.metadata?.current_spent_thb);
      agg.spentThb += Number.isFinite(spent) ? spent : 0;
    }
  }
  return registry
    .map((row) => {
      const stats = statsBySlug.get(row.slug) || { assignedCodes: 0, spentThb: 0 };
      return enrichCampaignRow(row, stats);
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
}

export async function upsertReferralCampaign(input) {
  const slug = normalizeCampaignSlug(input?.slug);
  const name = String(input?.name || '').trim();
  const maxBudgetThb = Number(input?.maxBudgetThb);
  const campaignExpiresAt = String(input?.campaignExpiresAt || '').trim();
  const expiresIso =
    campaignExpiresAt && !Number.isNaN(new Date(campaignExpiresAt).getTime())
      ? new Date(campaignExpiresAt).toISOString()
      : null;
  const overrideHoldDays = clampHoldDays(input?.overrideHoldDays);
  const isActive = input?.isActive !== false;
  if (!slug) throw new Error('CAMPAIGN_SLUG_REQUIRED');
  if (!name) throw new Error('CAMPAIGN_NAME_REQUIRED');
  if (Number.isFinite(maxBudgetThb) && maxBudgetThb <= 0) throw new Error('CAMPAIGN_MAX_BUDGET_INVALID');
  const registry = await readRegistry();
  const nowIso = new Date().toISOString();
  const existingIdx = registry.findIndex((x) => x.slug === slug);
  const prev = existingIdx >= 0 ? registry[existingIdx] : null;
  const nextRow = {
    slug,
    name,
    isActive,
    maxBudgetThb: Number.isFinite(maxBudgetThb) && maxBudgetThb > 0 ? round2(maxBudgetThb) : null,
    campaignExpiresAt: expiresIso,
    overrideHoldDays,
    createdAt: prev?.createdAt || nowIso,
    updatedAt: nowIso,
    metadata: prev?.metadata || { budget_topups: [] },
  };
  if (existingIdx >= 0) registry[existingIdx] = nextRow;
  else registry.push(nextRow);
  await writeRegistry(registry);
  await patchCodesMetadataBySlug(slug, nextRow);
  return nextRow;
}

export async function setReferralCampaignState(slug, isActive) {
  const safeSlug = normalizeCampaignSlug(slug);
  if (!safeSlug) throw new Error('CAMPAIGN_SLUG_REQUIRED');
  const registry = await readRegistry();
  const idx = registry.findIndex((x) => x.slug === safeSlug);
  if (idx < 0) throw new Error('CAMPAIGN_NOT_FOUND');
  registry[idx] = { ...registry[idx], isActive: isActive !== false, updatedAt: new Date().toISOString() };
  await writeRegistry(registry);
  await patchCodesMetadataBySlug(safeSlug, registry[idx]);
  return registry[idx];
}

export async function listActiveReferralCampaigns() {
  const rows = await listReferralCampaigns();
  return rows.filter((x) => x.status === 'active');
}

export async function getReferralCampaignBySlug(slug) {
  const safeSlug = normalizeCampaignSlug(slug);
  if (!safeSlug) return null;
  const rows = await listReferralCampaigns();
  return rows.find((x) => x.slug === safeSlug) || null;
}

async function hasBudgetExhaustedAlertToday(campaignSlug) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  try {
    const { data } = await supabaseAdmin
      .from('critical_signal_events')
      .select('id')
      .eq('signal_key', 'REFERRAL_CAMPAIGN_BUDGET_EXHAUSTED')
      .gte('created_at', dayStart.toISOString())
      .contains('detail', { campaign_slug: campaignSlug })
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function persistBudgetExhaustedSignal(campaign) {
  try {
    await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: 'REFERRAL_CAMPAIGN_BUDGET_EXHAUSTED',
      detail: {
        campaign_slug: campaign.slug,
        campaign_name: campaign.name,
        spent_thb: campaign.spentThb,
        max_budget_thb: campaign.maxBudgetThb,
      },
    });
  } catch {
    /* table may be absent in dev */
  }
}

/** Telegram FINANCE topic — один раз в сутки на кампанию. */
export async function notifyReferralCampaignBudgetExhausted(campaign) {
  const slug = normalizeCampaignSlug(campaign?.slug);
  if (!slug) return;
  if (await hasBudgetExhaustedAlertToday(slug)) return;
  await persistBudgetExhaustedSignal(campaign);
  const spent = round2(campaign.spentThb);
  const max = round2(campaign.maxBudgetThb);
  await sendToAdminTopic(
    'FINANCE',
    `🛑 <b>REFERRAL_CAMPAIGN_BUDGET_EXHAUSTED</b>\n\n` +
      `Кампания <b>${campaign.name}</b> (<code>${slug}</code>) автоматически поставлена на паузу.\n` +
      `Потрачено: <b>${spent.toLocaleString('ru-RU')} ฿</b> из <b>${max.toLocaleString('ru-RU')} ฿</b>.\n` +
      `🔗 <a href="/admin/marketing/campaigns/${slug}">Карточка кампании</a>`,
  );
}

/**
 * После начисления — при 100% бюджета: пауза + Telegram (идемпотентно).
 */
export async function evaluateCampaignBudgetAfterSpend(campaignSlug) {
  const safeSlug = normalizeCampaignSlug(campaignSlug);
  if (!safeSlug) return { action: 'skipped' };
  const campaign = await getReferralCampaignBySlug(safeSlug);
  if (!campaign?.maxBudgetThb) return { action: 'no_budget_cap' };
  const pct = computeBudgetUsagePct(campaign.maxBudgetThb, campaign.spentThb);
  if (pct == null || pct < 100) {
    return { action: 'none', budgetUsagePct: pct, budgetAlertLevel: campaign.budgetAlertLevel };
  }
  if (!campaign.isActive || campaign.status === 'budget_exhausted') {
    return { action: 'already_handled', budgetUsagePct: pct };
  }
  await setReferralCampaignState(safeSlug, false);
  const refreshed = await getReferralCampaignBySlug(safeSlug);
  await notifyReferralCampaignBudgetExhausted(refreshed || campaign);
  return { action: 'paused_and_alerted', budgetUsagePct: pct };
}

/** Увеличить лимит бюджета кампании (не меняет экономику начислений). */
export async function topUpReferralCampaignBudget({
  slug,
  addThb,
  adminUserId = null,
  adminEmail = null,
  adminName = null,
  comment = null,
} = {}) {
  const safeSlug = normalizeCampaignSlug(slug);
  const add = round2(addThb);
  if (!safeSlug) throw new Error('CAMPAIGN_SLUG_REQUIRED');
  if (!(add > 0)) throw new Error('TOPUP_AMOUNT_INVALID');
  const registry = await readRegistry();
  const idx = registry.findIndex((x) => x.slug === safeSlug);
  if (idx < 0) throw new Error('CAMPAIGN_NOT_FOUND');
  const listed = (await listReferralCampaigns()).find((x) => x.slug === safeSlug);
  const spent = round2(listed?.spentThb ?? 0);
  const prevMax = registry[idx].maxBudgetThb;
  const nextMax = round2((prevMax != null ? prevMax : spent) + add);
  const nowIso = new Date().toISOString();
  const metadata =
    registry[idx].metadata && typeof registry[idx].metadata === 'object'
      ? { ...registry[idx].metadata }
      : { budget_topups: [] };
  const topup = {
    id: `topup_${Date.now().toString(36)}`,
    atIso: nowIso,
    amountThb: add,
    adminUserId: adminUserId ? String(adminUserId) : null,
    adminEmail: adminEmail ? String(adminEmail) : null,
    adminName: adminName ? String(adminName) : null,
    comment: String(comment || '').trim() || null,
  };
  metadata.budget_topups = [topup, ...(Array.isArray(metadata.budget_topups) ? metadata.budget_topups : [])].slice(
    0,
    100,
  );
  registry[idx] = {
    ...registry[idx],
    maxBudgetThb: nextMax,
    metadata,
    updatedAt: nowIso,
  };
  await writeRegistry(registry);
  await patchCodesMetadataBySlug(safeSlug, registry[idx]);
  return (await listReferralCampaigns()).find((x) => x.slug === safeSlug) || registry[idx];
}

/**
 * Stage 122.2 — drill-down bundle for one campaign (KPI, referrers, funnel, codes, cohort).
 */
export async function buildReferralCampaignDrilldown({ slug, fromIso, toIso } = {}) {
  const safeSlug = normalizeCampaignSlug(slug);
  if (!safeSlug) throw new Error('CAMPAIGN_SLUG_REQUIRED');

  const campaign = await getReferralCampaignBySlug(safeSlug);
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');

  const now = new Date();
  const to = toIso ? new Date(toIso).toISOString() : now.toISOString();
  const fromDefault = new Date(now.getTime() - 30 * 86400000);
  const from = fromIso ? new Date(fromIso).toISOString() : fromDefault.toISOString();

  const ledgerBundle = await FinancialReportingService.fetchReferralLedgerBundle({
    fromIso: from,
    toIso: to,
  });
  const filterByCampaign = (row) =>
    String(row?.metadata?.campaign_slug || '').trim() === safeSlug;
  const earnedRows = (ledgerBundle.earnedRows || []).filter(filterByCampaign);
  const clawbackRows = (ledgerBundle.clawbackRows || []).filter(filterByCampaign);

  const metricRows = await FinancialReportingService.buildCampaignMetricsRows({
    fromIso: from,
    toIso: to,
    campaignSlugFilter: safeSlug,
  });
  const metricsRaw = metricRows.find((x) => x.campaignSlug === safeSlug) || metricRows[0] || {};

  const clicks = Number(metricsRaw.clicksCount) || 0;
  const signups = Number(metricsRaw.signupsCount) || 0;
  const metrics = {
    ...metricsRaw,
    campaignSlug: safeSlug,
    clickToSignupPct: clicks > 0 ? round2((signups / clicks) * 100) : 0,
    signupToFirstBookingPct:
      signups > 0 ? round2((Number(metricsRaw.firstBookingsCount) / signups) * 100) : 0,
    remainingBudgetThb: campaign.remainingBudgetThb,
    maxBudgetThb: campaign.maxBudgetThb,
    spentThb: campaign.spentThb,
    suspiciousConversionsCount: Number(metricsRaw.suspiciousConversionsCount || 0),
    suspiciousConversionPct:
      signups > 0 ? round2((Number(metricsRaw.suspiciousConversionsCount || 0) / signups) * 100) : 0,
  };

  const [referrerRows, funnel, codesRes] = await Promise.all([
    FinancialReportingService.buildReferrerMonetaryRows({
      fromIso: from,
      toIso: to,
      campaignSlugFilter: safeSlug,
      earnedRows,
      clawbackRows,
    }),
    FinancialReportingService.computeReferralFunnelBundle({
      fromIso: from,
      toIso: to,
      campaignSlugFilter: safeSlug,
      earnedRows,
    }),
    supabaseAdmin
      .from('referral_codes')
      .select('id, code, user_id, is_active, campaign_slug, metadata, created_at')
      .eq('campaign_slug', safeSlug)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (codesRes.error) throw new Error(codesRes.error.message || 'CAMPAIGN_CODES_READ_FAILED');

  const cohortMap = await FinancialReportingService.buildCohortMapForReferrers(referrerRows, {
    fromIso: from,
    toIso: to,
  });
  const cohortRows = [];
  for (const ref of referrerRows) {
    for (const c of cohortMap.get(ref.referrerId) || []) {
      cohortRows.push({ referrerId: ref.referrerId, referrerName: ref.name, ...c });
    }
  }

  let profileMap = new Map();
  const userIds = [...new Set((codesRes.data || []).map((r) => String(r.user_id || '').trim()).filter(Boolean))];
  if (userIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', userIds);
    profileMap = new Map((profiles || []).map((p) => [String(p.id), p]));
  }
  const codes = (codesRes.data || []).map((row) => {
    const p = profileMap.get(String(row.user_id || ''));
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      code: row.code,
      userId: row.user_id,
      isActive: row.is_active !== false,
      ownerLabel: name || p?.email || row.user_id,
      currentSpentThb: round2(Number(row?.metadata?.current_spent_thb) || 0),
      createdAt: row.created_at,
    };
  });

  return {
    campaign,
    period: { from, to },
    metrics,
    referrerRows,
    funnel,
    codes,
    cohortRows,
    budgetTopups: campaign.budgetTopups || [],
  };
}

export async function bindReferralCodeToCampaign({ codeId, campaignSlug }) {
  const id = String(codeId || '').trim();
  if (!id) throw new Error('REFERRAL_CODE_ID_REQUIRED');
  const normalizedSlug = campaignSlug ? normalizeCampaignSlug(campaignSlug) : null;
  let selectedCampaign = null;
  if (normalizedSlug) {
    const campaigns = await listReferralCampaigns();
    selectedCampaign = campaigns.find((x) => x.slug === normalizedSlug) || null;
    if (!selectedCampaign) throw new Error('CAMPAIGN_NOT_FOUND');
  }
  const { data: row, error } = await supabaseAdmin
    .from('referral_codes')
    .select('id,metadata')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) throw new Error('REFERRAL_CODE_NOT_FOUND');
  const metadata = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
  if (selectedCampaign) {
    metadata.campaign_slug = selectedCampaign.slug;
    metadata.max_budget_thb = selectedCampaign.maxBudgetThb;
    metadata.campaign_expires_at = selectedCampaign.campaignExpiresAt;
    metadata.override_hold_days = selectedCampaign.overrideHoldDays;
    metadata.campaign_is_active = selectedCampaign.isActive !== false;
  } else {
    delete metadata.campaign_slug;
    delete metadata.max_budget_thb;
    delete metadata.campaign_expires_at;
    delete metadata.override_hold_days;
    delete metadata.campaign_is_active;
  }
  const { error: upErr } = await supabaseAdmin
    .from('referral_codes')
    .update({
      campaign_slug: selectedCampaign?.slug || null,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (upErr) throw new Error(upErr.message || 'REFERRAL_CODE_BIND_CAMPAIGN_FAILED');
  return { codeId: id, campaignSlug: selectedCampaign?.slug || null };
}

