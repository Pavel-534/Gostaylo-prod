/**
 * Stage 200.22 — SSOT policy for listing draft garbage collection.
 * Used by `/api/cron/cleanup-drafts` (empty wizard shells vs contentful drafts).
 */

/** Contentful drafts (partner typed something). Override: DRAFT_CLEANUP_DAYS */
export const DRAFT_CLEANUP_CONTENTFUL_DAYS_DEFAULT = 30

/**
 * Empty wizard orphans (category-select shell / wizard_upload with no real content).
 * Override: DRAFT_CLEANUP_EMPTY_DAYS
 */
export const DRAFT_CLEANUP_EMPTY_DAYS_DEFAULT = 7

const EMPTY_TITLE_MARKERS = new Set([
  '',
  'draft',
  'draft listing',
  'черновик',
  '草稿',
  'ฉบับร่าง',
])

/**
 * @param {unknown} meta
 */
export function isListingDraftMetadata(meta) {
  return Boolean(
    meta &&
      typeof meta === 'object' &&
      (meta.is_draft === true || meta.is_draft === 'true'),
  )
}

/**
 * @returns {{ emptyDays: number, contentfulDays: number }}
 */
export function resolveDraftCleanupTtlDays(env = process.env) {
  const emptyRaw = Number(env.DRAFT_CLEANUP_EMPTY_DAYS)
  const contentfulRaw = Number(env.DRAFT_CLEANUP_DAYS)
  const emptyDays =
    Number.isFinite(emptyRaw) && emptyRaw > 0 ? Math.floor(emptyRaw) : DRAFT_CLEANUP_EMPTY_DAYS_DEFAULT
  const contentfulDays =
    Number.isFinite(contentfulRaw) && contentfulRaw > 0
      ? Math.floor(contentfulRaw)
      : DRAFT_CLEANUP_CONTENTFUL_DAYS_DEFAULT
  return {
    emptyDays,
    contentfulDays: Math.max(contentfulDays, emptyDays),
  }
}

/**
 * Wizard category-select shells and abandoned empty drafts.
 * @param {{ title?: string, description?: string, images?: unknown, metadata?: object }} listing
 */
export function isEmptyWizardOrphanDraft(listing) {
  if (!listing || typeof listing !== 'object') return false
  if (!isListingDraftMetadata(listing.metadata)) return false

  const title = String(listing.title || '').trim().toLowerCase()
  const images = Array.isArray(listing.images) ? listing.images.filter(Boolean) : []
  const desc = String(listing.description || '').trim()
  const titleLooksEmpty = EMPTY_TITLE_MARKERS.has(title) || title.length < 3
  const noPhotos = images.length === 0
  const shortDesc = desc.length < 40

  return titleLooksEmpty && noPhotos && shortDesc
}

/**
 * Merge explicit numeric overrides with process.env (undefined must not blank env).
 * @param {{ emptyDays?: number, contentfulDays?: number }} [opts]
 */
function resolveTtlFromOpts(opts = {}) {
  const fromEnv = resolveDraftCleanupTtlDays()
  const emptyDays =
    Number.isFinite(opts.emptyDays) && opts.emptyDays > 0
      ? Math.floor(opts.emptyDays)
      : fromEnv.emptyDays
  const contentfulDays =
    Number.isFinite(opts.contentfulDays) && opts.contentfulDays > 0
      ? Math.floor(opts.contentfulDays)
      : fromEnv.contentfulDays
  return { emptyDays, contentfulDays: Math.max(contentfulDays, emptyDays) }
}

/**
 * @param {{ updated_at?: string, title?: string, description?: string, images?: unknown, metadata?: object }} listing
 * @param {{ nowMs?: number, emptyDays?: number, contentfulDays?: number }} [opts]
 */
export function shouldDeleteExpiredDraft(listing, opts = {}) {
  if (!isListingDraftMetadata(listing?.metadata)) return false
  const { emptyDays, contentfulDays } = resolveTtlFromOpts(opts)
  const ttlDays = isEmptyWizardOrphanDraft(listing) ? emptyDays : contentfulDays
  const updatedMs = Date.parse(String(listing?.updated_at || ''))
  if (!Number.isFinite(updatedMs)) return false
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now()
  const ageDays = (nowMs - updatedMs) / (24 * 60 * 60 * 1000)
  return ageDays >= ttlDays
}

/**
 * Candidate query cutoff = shortest TTL (empty orphans).
 * @param {{ nowMs?: number, emptyDays?: number, contentfulDays?: number }} [opts]
 */
export function draftCleanupCandidateCutoffIso(opts = {}) {
  const { emptyDays } = resolveTtlFromOpts(opts)
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now()
  return new Date(nowMs - emptyDays * 24 * 60 * 60 * 1000).toISOString()
}
