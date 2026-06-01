/**
 * Stage 124.13 — отправка Owner Marketing Digest (email + Telegram).
 */
import { readSystemSettingValue, upsertSystemSetting } from '@/lib/admin/system-settings-store.js';
import buildOwnerMarketingDigestReport from '@/lib/analytics/reports/owner-marketing-digest.report.js';
import {
  buildOwnerDigestHtml,
  buildOwnerDigestPlainText,
  buildOwnerDigestTelegramHtml,
} from '@/lib/analytics/digest/owner-marketing-digest.format.js';
import { sendResendEmail } from '@/lib/services/notifications/email.service.js';
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js';
import { getSiteDisplayName } from '@/lib/site-url';

export const OWNER_MARKETING_DIGEST_SETTINGS_KEY = 'owner_marketing_digest';

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  emailEnabled: true,
  telegramEnabled: true,
  recipientEmails: [],
  lastSentAt: null,
  lastSentWeekKey: null,
});

/**
 * @param {unknown} raw
 */
export function normalizeOwnerDigestSettings(raw) {
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const emails = Array.isArray(v.recipientEmails)
    ? v.recipientEmails.map((e) => String(e || '').trim()).filter((e) => e.includes('@'))
    : [];
  const envEmails = String(process.env.OWNER_DIGEST_EMAIL || process.env.MARKETING_DIGEST_EMAIL || '')
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter((e) => e.includes('@'));

  const mergedEmails = emails.length ? emails : envEmails;

  return {
    enabled: v.enabled === true,
    emailEnabled: v.emailEnabled !== false,
    telegramEnabled: v.telegramEnabled !== false,
    recipientEmails: mergedEmails,
    lastSentAt: v.lastSentAt ? String(v.lastSentAt) : null,
    lastSentWeekKey: v.lastSentWeekKey ? String(v.lastSentWeekKey) : null,
  };
}

export async function loadOwnerDigestSettings() {
  const raw = await readSystemSettingValue(OWNER_MARKETING_DIGEST_SETTINGS_KEY);
  return normalizeOwnerDigestSettings(raw ?? DEFAULT_SETTINGS);
}

/**
 * @param {Partial<typeof DEFAULT_SETTINGS>} patch
 */
export async function saveOwnerDigestSettings(patch) {
  const current = await loadOwnerDigestSettings();
  const next = normalizeOwnerDigestSettings({
    ...current,
    ...patch,
    recipientEmails: patch.recipientEmails ?? current.recipientEmails,
  });
  await upsertSystemSetting(OWNER_MARKETING_DIGEST_SETTINGS_KEY, next);
  return next;
}

/** ISO week key for deduplication */
export function getIsoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * @param {{ force?: boolean, skipWeeklyDedup?: boolean }} [opts]
 */
export async function sendOwnerMarketingDigest(opts = {}) {
  const settings = await loadOwnerDigestSettings();
  const weekKey = getIsoWeekKey();

  if (!opts.force && !settings.enabled) {
    return { ok: false, skipped: true, reason: 'DIGEST_DISABLED' };
  }

  if (!opts.force && !opts.skipWeeklyDedup && settings.lastSentWeekKey === weekKey) {
    return { ok: false, skipped: true, reason: 'ALREADY_SENT_THIS_WEEK', weekKey };
  }

  const digest = await buildOwnerMarketingDigestReport({ skipCache: true });
  const subject = `${getSiteDisplayName()} — дайджест маркетинга (${digest.periodLabel})`;
  const textBody = buildOwnerDigestPlainText(digest);
  const htmlBody = buildOwnerDigestHtml(digest);
  const telegramHtml = buildOwnerDigestTelegramHtml(digest);

  const result = {
    ok: true,
    weekKey,
    email: { attempted: false, sent: 0, mock: false },
    telegram: { attempted: false, success: false },
  };

  if (settings.emailEnabled && settings.recipientEmails.length) {
    result.email.attempted = true;
    for (const to of settings.recipientEmails) {
      const res = await sendResendEmail(to, subject, textBody, htmlBody);
      if (res.success) {
        result.email.sent += 1;
        if (res.mock) result.email.mock = true;
      }
    }
  } else if (settings.emailEnabled) {
    result.email.skipped = 'NO_RECIPIENTS';
  }

  if (settings.telegramEnabled) {
    result.telegram.attempted = true;
    const tg = await sendToAdminTopic('FINANCE', telegramHtml);
    result.telegram.success = Boolean(tg?.success);
  }

  const sentAt = new Date().toISOString();
  if (!opts.skipWeeklyDedup) {
    await saveOwnerDigestSettings({
      lastSentAt: sentAt,
      lastSentWeekKey: weekKey,
    });
  }

  result.sentAt = sentAt;
  return result;
}

/**
 * Cron entry: only when enabled and not yet sent this week.
 */
export async function runWeeklyOwnerMarketingDigestCron() {
  const settings = await loadOwnerDigestSettings();
  if (!settings.enabled) {
    return { ok: true, skipped: true, reason: 'DIGEST_DISABLED' };
  }
  return sendOwnerMarketingDigest();
}
