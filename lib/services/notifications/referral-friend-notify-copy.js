/**
 * Stage 131.A2 — referral friend lifecycle copy (RU / EN / ZH / TH).
 * Pure helpers for handlers + unit tests.
 */

/** @param {string} lang */
function normalizeLang(lang) {
  const s = String(lang || 'ru').trim().toLowerCase()
  if (s.startsWith('en')) return 'en'
  if (s.startsWith('zh')) return 'zh'
  if (s.startsWith('th')) return 'th'
  return 'ru'
}

/**
 * @param {{ friendName: string, listingTitle: string, amountLabel: string, lang?: string }} p
 */
export function buildReferralFriendBookedCopy(p) {
  const lang = normalizeLang(p.lang)
  const friend = String(p.friendName || '').trim() || (lang === 'en' ? 'Friend' : lang === 'zh' ? '好友' : lang === 'th' ? 'เพื่อน' : 'Друг')
  const listing = String(p.listingTitle || '').trim() || (lang === 'en' ? 'listing' : lang === 'zh' ? '房源' : lang === 'th' ? 'ที่พัก' : 'объект')
  const amount = String(p.amountLabel || '').trim()

  if (lang === 'en') {
    const headline = `${friend} booked ${listing} — your ~${amount} bonus is coming`
    return { subject: `Friend booked — ~${amount} bonus pending`, headline, body: headline }
  }
  if (lang === 'zh') {
    const headline = `${friend} 预订了 ${listing} — 您的 ~${amount} 奖金即将到账`
    return { subject: `好友已预订 — ~${amount} 奖金待入账`, headline, body: headline }
  }
  if (lang === 'th') {
    const headline = `${friend} จอง ${listing} — โบนัส ~${amount} ของคุณกำลังจะมา`
    return { subject: `เพื่อนจองแล้ว — โบนัส ~${amount}`, headline, body: headline }
  }
  const headline = `${friend} забронировал(а) ${listing} — ваш бонус ~${amount} скоро появится`
  return { subject: `Друг забронировал — бонус ~${amount}`, headline, body: headline }
}

/**
 * @param {{ friendName: string, amountLabel: string, lang?: string }} p
 */
export function buildReferralFriendPaidCopy(p) {
  const lang = normalizeLang(p.lang)
  const friend = String(p.friendName || '').trim() || (lang === 'en' ? 'Friend' : lang === 'zh' ? '好友' : lang === 'th' ? 'เพื่อน' : 'Друг')
  const amount = String(p.amountLabel || '').trim()

  if (lang === 'en') {
    const headline = `${friend} paid for the booking — ${amount}`
    return { subject: `Friend paid — ${amount}`, headline, body: headline }
  }
  if (lang === 'zh') {
    const headline = `${friend} 已支付预订 — ${amount}`
    return { subject: `好友已付款 — ${amount}`, headline, body: headline }
  }
  if (lang === 'th') {
    const headline = `${friend} ชำระเงินจองแล้ว — ${amount}`
    return { subject: `เพื่อนชำระเงินแล้ว — ${amount}`, headline, body: headline }
  }
  const headline = `${friend} оплатил(а) бронирование — ${amount}`
  return { subject: `Друг оплатил — ${amount}`, headline, body: headline }
}

/**
 * @param {{ friendName: string, listingTitle: string, amountLabel: string, lang?: string }} p
 */
export function buildReferralFriendCompletedCopy(p) {
  const lang = normalizeLang(p.lang)
  const friend = String(p.friendName || '').trim() || (lang === 'en' ? 'Friend' : lang === 'zh' ? '好友' : lang === 'th' ? 'เพื่อน' : 'Друг')
  const listing = String(p.listingTitle || '').trim() || (lang === 'en' ? 'listing' : lang === 'zh' ? '房源' : lang === 'th' ? 'ที่พัก' : 'объект')
  const amount = String(p.amountLabel || '').trim()

  if (lang === 'en') {
    const headline = `${friend} completed their trip to ${listing}. Your ~${amount} bonus is almost there.`
    return { subject: `Trip completed — ~${amount} bonus soon`, headline, body: headline }
  }
  if (lang === 'zh') {
    const headline = `${friend} 完成了 ${listing} 的行程。您的 ~${amount} 奖金即将到账。`
    return { subject: `行程已完成 — ~${amount} 奖金即将到账`, headline, body: headline }
  }
  if (lang === 'th') {
    const headline = `${friend} เสร็จสิ้นการเดินทางไป ${listing} โบนัส ~${amount} ของคุณใกล้จะเข้าบัญชีแล้ว`
    return { subject: `เดินทางเสร็จสิ้น — โบนัส ~${amount}`, headline, body: headline }
  }
  const headline = `${friend} завершил(а) поездку в ${listing}. Ваш бонус ~${amount} уже скоро на кошельке.`
  return { subject: `Поездка завершена — бонус ~${amount}`, headline, body: headline }
}

/**
 * @param {{ email?: string | null, telegram_id?: string | null }} profile
 * @returns {('email' | 'push' | 'telegram')[]}
 */
export function planReferralFriendNotifyChannels(profile) {
  const channels = []
  if (String(profile?.email || '').trim()) channels.push('email')
  channels.push('push')
  if (String(profile?.telegram_id || '').trim()) channels.push('telegram')
  return channels
}
