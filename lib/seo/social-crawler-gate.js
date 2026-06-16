/**
 * Stage 149.2 — SSOT: social / messenger preview crawlers (OG Guest-Gate).
 */

const SOCIAL_PREVIEW_CRAWLER_MARKERS = [
  'telegrambot',
  'whatsapp',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'embedly',
  'vkshare',
  'pinterest',
  'bingpreview',
]

/**
 * @param {string | null | undefined} userAgent
 * @returns {boolean}
 */
export function isSocialPreviewCrawler(userAgent) {
  const ua = String(userAgent || '').toLowerCase().trim()
  if (!ua) return false
  return SOCIAL_PREVIEW_CRAWLER_MARKERS.some((marker) => ua.includes(marker))
}
