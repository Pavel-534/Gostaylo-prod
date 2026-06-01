/**
 * Stage 124.14 — URL helpers for Referral ROI campaign drill-down.
 */

/** @param {string | null | undefined} param */
export function decodeCampaignSlugParam(param) {
  const raw = decodeURIComponent(String(param || '').trim());
  if (!raw || raw === '_default') return '(default)';
  return raw;
}

/** @param {string | null | undefined} slug */
export function encodeCampaignSlugForUrl(slug) {
  const s = String(slug || '').trim() || '(default)';
  if (s === '(default)') return '_default';
  return encodeURIComponent(s);
}

/** @param {string} slug */
export function campaignRoiDetailPath(slug) {
  return `/admin/marketing/roi/${encodeCampaignSlugForUrl(slug)}`;
}

/** @param {string} slug */
export function campaignMarketingManagePath(slug) {
  const enc = encodeCampaignSlugForUrl(slug);
  if (enc === '_default') return '/admin/marketing/campaigns';
  return `/admin/marketing/campaigns/${enc}`;
}
