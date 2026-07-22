/**
 * Stage 192.0 — presentation-only UTM builder for Ambassador Creator Pack.
 * Does not change attribution engine; track API already accepts utm_* query params.
 */

/** @typedef {'telegram' | 'instagram' | 'youtube' | 'vk'} AmbassadorUtmChannel */

/** @type {readonly AmbassadorUtmChannel[]} */
export const AMBASSADOR_UTM_CHANNELS = Object.freeze(['telegram', 'instagram', 'youtube', 'vk'])

/**
 * @param {AmbassadorUtmChannel | string} channel
 * @returns {{ utm_source: string, utm_medium: string }}
 */
export function resolveAmbassadorUtmParts(channel) {
  const c = String(channel || '').toLowerCase()
  switch (c) {
    case 'instagram':
      return { utm_source: 'instagram', utm_medium: 'referral' }
    case 'youtube':
      return { utm_source: 'youtube', utm_medium: 'referral' }
    case 'vk':
    case 'vkontakte':
      return { utm_source: 'vk', utm_medium: 'referral' }
    case 'telegram':
    default:
      return { utm_source: 'telegram', utm_medium: 'referral' }
  }
}

/**
 * Append channel UTMs to an ambassador invite / landing URL.
 * Preserves existing query/hash; overwrites conflicting utm_* keys.
 *
 * @param {string} baseUrl
 * @param {{
 *   channel?: AmbassadorUtmChannel | string,
 *   campaign?: string,
 * }} [opts]
 * @returns {string}
 */
export function buildAmbassadorUtmLink(baseUrl, opts = {}) {
  const raw = String(baseUrl || '').trim()
  if (!raw) return ''
  const channel = opts.channel || 'telegram'
  const campaign = String(opts.campaign || 'ambassador')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'ambassador'

  let url
  try {
    url = new URL(raw)
  } catch {
    return raw
  }

  const { utm_source, utm_medium } = resolveAmbassadorUtmParts(channel)
  url.searchParams.set('utm_source', utm_source)
  url.searchParams.set('utm_medium', utm_medium)
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}
