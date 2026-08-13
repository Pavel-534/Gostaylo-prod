/**
 * Product feedback (site bug / UX) — not chat dispute escalate.
 * Stage 200.137
 */

export const PRODUCT_FEEDBACK_CATEGORIES = [
  { slug: 'technical', labelRu: 'Сбой на сайте', labelEn: 'Site bug' },
  { slug: 'ux', labelRu: 'Непонятный интерфейс', labelEn: 'Confusing UX' },
  { slug: 'idea', labelRu: 'Идея', labelEn: 'Idea' },
  { slug: 'other', labelRu: 'Другое', labelEn: 'Other' },
]

/**
 * Ops-facing audience label from profiles.role (server-side, not client-spoofed).
 * @param {string | null | undefined} role
 * @returns {'partner' | 'guest' | 'staff' | 'unknown'}
 */
export function normalizeProductFeedbackAudience(role) {
  const r = String(role || '').trim().toUpperCase()
  if (r === 'PARTNER') return 'partner'
  if (r === 'ADMIN' || r === 'MODERATOR') return 'staff'
  if (r === 'RENTER' || r === 'USER' || r === 'GUEST' || r === '') return 'guest'
  return 'unknown'
}

export const PRODUCT_FEEDBACK_CATEGORY_SLUGS = PRODUCT_FEEDBACK_CATEGORIES.map((c) => c.slug)

export const PRODUCT_FEEDBACK_DETAILS_MAX = 2000
export const PRODUCT_FEEDBACK_DETAILS_MIN = 10

export function labelForProductFeedbackCategory(slug, lang = 'ru') {
  const row = PRODUCT_FEEDBACK_CATEGORIES.find((x) => x.slug === slug)
  if (!row) return slug
  return lang === 'en' ? row.labelEn : row.labelRu
}

function trimStr(v, max) {
  return String(v ?? '')
    .trim()
    .slice(0, max)
}

/**
 * @param {{
 *   category?: string,
 *   details?: string,
 *   pathname?: string,
 *   pageUrl?: string,
 *   userAgent?: string,
 *   language?: string,
 * }} body
 * @param {{ userId: string, email?: string | null, role?: string | null }} user
 */
export function validateProductFeedbackBody(body, user) {
  const category = trimStr(body?.category, 40).toLowerCase()
  const details = trimStr(body?.details, PRODUCT_FEEDBACK_DETAILS_MAX)
  const pathname = trimStr(body?.pathname, 500) || '/'
  const pageUrl = trimStr(body?.pageUrl, 800) || pathname
  const userAgent = trimStr(body?.userAgent, 400)
  const language = trimStr(body?.language, 8).toLowerCase() || 'ru'
  const audience = normalizeProductFeedbackAudience(user?.role)
  const roleRaw = trimStr(user?.role, 40).toUpperCase() || null

  if (!PRODUCT_FEEDBACK_CATEGORY_SLUGS.includes(category)) {
    return { ok: false, error: 'INVALID_CATEGORY', status: 400 }
  }
  if (details.length < PRODUCT_FEEDBACK_DETAILS_MIN) {
    return { ok: false, error: 'DETAILS_TOO_SHORT', status: 400 }
  }
  if (!user?.userId) {
    return { ok: false, error: 'AUTH_REQUIRED', status: 401 }
  }

  return {
    ok: true,
    payload: {
      category,
      details,
      pathname,
      pageUrl,
      userAgent,
      language: language === 'en' ? 'en' : 'ru',
      userId: String(user.userId),
      email: user.email ? String(user.email).trim().slice(0, 200) : null,
      audience,
      role: roleRaw,
    },
  }
}
