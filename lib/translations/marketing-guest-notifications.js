/**
 * Stage 41.0 — Telegram (plain text) for guests after Flash Sale booking.
 * Used by MarketingNotificationsService; keys are not merged into public getUIText bundle.
 */

const LANGS = ['ru', 'en', 'zh', 'th']

/** @type {Record<string, { body: string; listingLine: string }>} */
export const marketingGuestFlashSaleBookingCongrats = {
  ru: {
    body: '🎉 Поздравляем! Вы успели забронировать по спеццене Flash Sale.',
    listingLine: 'Объект: {{listingTitle}}',
  },
  en: {
    body: '🎉 Congratulations! You secured a booking at the Flash Sale special price.',
    listingLine: 'Listing: {{listingTitle}}',
  },
  zh: {
    body: '🎉 恭喜！您已成功以 Flash Sale 特价完成预订。',
    listingLine: '房源：{{listingTitle}}',
  },
  th: {
    body: '🎉 ยินดีด้วย! คุณจองที่พักในราคา Flash Sale สำเร็จแล้ว',
    listingLine: 'ที่พัก: {{listingTitle}}',
  },
}

/**
 * @param {string | null | undefined} raw — `profiles.preferred_language` or `profiles.language`
 * @returns {'ru'|'en'|'zh'|'th'}
 */
export function normalizeGuestNotifyLang(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 12)
  if (LANGS.includes(s)) return /** @type {'ru'|'en'|'zh'|'th'} */ (s)
  return 'en'
}

/**
 * @param {string | null | undefined} lang
 * @param {{ listingTitle?: string | null }} opts
 */
export function buildFlashSaleGuestCongratsTelegramText(lang, opts = {}) {
  const lg = normalizeGuestNotifyLang(lang)
  const pack = marketingGuestFlashSaleBookingCongrats[lg] || marketingGuestFlashSaleBookingCongrats.en
  const title = opts.listingTitle ? String(opts.listingTitle).trim() : ''
  let text = pack.body
  if (title) {
    text += `\n\n${pack.listingLine.replace(/\{\{listingTitle\}\}/g, title)}`
  }
  return text
}
