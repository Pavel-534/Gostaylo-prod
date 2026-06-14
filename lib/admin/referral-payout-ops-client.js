/**
 * Stage 132.1 — SSOT fetch layer for admin Referral Payout Ops Desk.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function assertOk(res, json, fallback) {
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || fallback);
  }
  return json;
}

/** @param {{ query?: string, readyOnly?: boolean, referralOnly?: boolean, limit?: number }} [opts] */
export async function fetchPayoutQueue(opts = {}) {
  const {
    query = '',
    readyOnly = true,
    referralOnly = true,
    limit = 250,
  } = opts;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('readyOnly', readyOnly ? '1' : '0');
  if (referralOnly) params.set('referralOnly', '1');
  if (String(query || '').trim()) params.set('query', String(query).trim());
  const res = await fetch(`/api/v2/admin/wallet/payouts?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await parseJson(res);
  assertOk(res, json, 'LOAD_PAYOUTS_FAILED');
  return json.data || {};
}

/** @param {'approve' | 'reject'} action */
export async function bulkReferralPayoutAction(action, userIds, opts = {}) {
  const payload = { action, userIds };
  if (action === 'reject') {
    payload.admin_comment = String(opts.adminComment ?? opts.admin_comment ?? '').trim();
  }
  const res = await fetch('/api/v2/admin/wallet/payouts/referral-bulk', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  assertOk(res, json, 'BULK_REFERRAL_FAILED');
  return json.data || {};
}

/** @param {Record<string, unknown>} payload */
export async function patchWalletPayout(payload) {
  const res = await fetch('/api/v2/admin/wallet/payouts', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  assertOk(res, json, 'PATCH_WALLET_PAYOUT_FAILED');
  return json.data || {};
}

/** @param {{ referralOnly?: boolean }} [opts] */
export async function fetchRegistryPreview(opts = {}) {
  const params = new URLSearchParams();
  if (opts.referralOnly !== false) params.set('referralOnly', '1');
  const res = await fetch(`/api/v2/admin/payouts/tbank-registry?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await parseJson(res);
  assertOk(res, json, 'REGISTRY_PREVIEW_FAILED');
  return json.data || {};
}

/** @param {{ encoding?: 'utf-8' | 'windows-1251', referralOnly?: boolean }} [opts] */
export async function exportTbankRegistry(opts = {}) {
  const encoding = opts.encoding === 'windows-1251' ? 'windows-1251' : 'utf-8';
  const res = await fetch('/api/v2/admin/payouts/tbank-registry', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({
      encoding,
      referralOnly: opts.referralOnly !== false,
    }),
  });
  const json = await parseJson(res);
  assertOk(res, json, 'REGISTRY_EXPORT_FAILED');
  return json.data || {};
}

/** Trigger browser download from registry export response. */
export function downloadRegistryPayload(data) {
  const d = data || {};
  const { filename, csv, csvBase64, encoding } = d;
  if (!filename) return false;
  if (encoding === 'windows-1251' && csvBase64) {
    const bin = Uint8Array.from(atob(csvBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bin], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  if (csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  return false;
}

export function isReferralPayoutRow(p) {
  const rail = String(p?.payoutRail || p?.payout_rail || '').toUpperCase();
  const type = String(p?.metadata?.payout_type || '').toLowerCase();
  return rail === 'REFERRAL_RUB_CARD' || type === 'referral_withdrawal';
}

/** @param {string} status PROCESSING | PAID | FAILED | FINAL */
export async function fetchAdminPayouts(status, { limit = 200 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  const res = await fetch(`/api/v2/admin/payouts?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await parseJson(res);
  assertOk(res, json, 'LOAD_PAYOUTS_FAILED');
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.filter(isReferralPayoutRow);
}

export async function markPayoutStatus(payoutId, status, adminNote) {
  const payload = { status };
  if (typeof adminNote === 'string' && adminNote.trim()) {
    payload.adminNote = adminNote.trim();
  }
  const res = await fetch(`/api/v2/admin/payouts/${encodeURIComponent(payoutId)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  assertOk(res, json, 'MARK_PAYOUT_STATUS_FAILED');
  return json.data || {};
}

export const SKIPPED_REASON_LABELS = {
  NO_PROFILE: 'Нет payout-профиля',
  PROFILE_NOT_VERIFIED: 'Профиль не верифицирован',
  INCOMPLETE_BANK_DETAILS: 'Неполные реквизиты (счёт, БИК, ИНН)',
  MISSING_RECIPIENT_NAME: 'Нет ФИО получателя',
};

export function skippedReasonLabel(reason) {
  const key = String(reason || '').split(':')[0];
  return SKIPPED_REASON_LABELS[key] || reason || '—';
}
