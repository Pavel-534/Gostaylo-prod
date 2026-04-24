/**
 * Локализация транзакционных писем о брони (ru, en, zh, th).
 */

import { getListingDateTimeZone, anchorUtcMidnightToListingDayStartIso } from '@/lib/listing-date'

/** @param {unknown} lang */
export function normalizeEmailLang(lang) {
  const l = String(lang || 'en').toLowerCase().slice(0, 2)
  if (l === 'zh') return 'zh'
  if (l === 'th') return 'th'
  if (l === 'ru') return 'ru'
  return 'en'
}

/**
 * @param {unknown} d
 * @param {string} lang
 */
export function formatBookingEmailDate(d, lang) {
  const L = normalizeEmailLang(lang)
  const loc = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN', th: 'th-TH' }[L]
  try {
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return String(d)
    return x.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return String(d)
  }
}

/**
 * Даты/время брони для писем: календарь в часовом поясе объявлений (LISTING_DATE_TZ),
 * формат дд.мм.гггг и 24‑часовое время — без «сырого» ISO в UTC.
 * @param {string|Date|number} d
 * @param {string} lang
 * @param {{ includeTime?: boolean }} [opts]
 */
export function formatBookingEmailEuropean(d, lang, opts = {}) {
  const { includeTime = true } = opts
  const L = normalizeEmailLang(lang)
  const loc = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN', th: 'th-TH' }[L]
  const tz = getListingDateTimeZone()
  try {
    const raw = includeTime ? anchorUtcMidnightToListingDayStartIso(d) : d
    const x = new Date(raw)
    if (Number.isNaN(x.getTime())) return String(d)
    if (includeTime) {
      return x.toLocaleString(loc, {
        timeZone: tz,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return x.toLocaleDateString(loc, {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(d)
  }
}

/** Краткое имя часового пояса (ICT, GMT+7, …) для подписи в письмах. */
export function formatListingTimeZoneShort(lang) {
  const L = normalizeEmailLang(lang)
  const loc = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN', th: 'th-TH' }[L]
  const tz = getListingDateTimeZone()
  try {
    const parts = new Intl.DateTimeFormat(loc, {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value || tz
  } catch {
    return tz
  }
}

/**
 * Короткая подпись к времени в системном сообщении чата (не путать с локальным временем пользователя).
 * @param {string} lang
 * @param {string} [district]
 */
export function formatChatListingTimeFootnote(lang, district) {
  const L = normalizeEmailLang(lang)
  const tzShort = formatListingTimeZoneShort(L)
  const place = district && String(district).trim()
  if (L === 'ru') {
    return place
      ? `Время — по месту объекта (${place}, ${tzShort}), не по часам вашего устройства.`
      : `Время — по месту объявления (${tzShort}), не по часам вашего устройства.`
  }
  if (L === 'zh') {
    return place
      ? `时间为发布地点（${place}，${tzShort}），非您设备本地时间。`
      : `时间为发布地点（${tzShort}），非您设备本地时间。`
  }
  if (L === 'th') {
    return place
      ? `เวลาตามสถานที่รายการ (${place}, ${tzShort}) ไม่ใช่เวลาบนอุปกรณ์ของคุณ`
      : `เวลาตามสถานที่รายการ (${tzShort}) ไม่ใช่เวลาบนอุปกรณ์ของคุณ`
  }
  return place
    ? `Times are for the offer location (${place}, ${tzShort}), not your device clock.`
    : `Times are in the listing time zone (${tzShort}), not your device clock.`
}

export function buildBookingEmailTimeZoneNote(lang, district) {
  const L = normalizeEmailLang(lang)
  const tzShort = formatListingTimeZoneShort(L)
  const place = district && String(district).trim()
  if (L === 'ru') {
    if (place) {
      return `Время и даты — по месту объекта (${place}, ${tzShort}). Не путайте с часовым поясом вашего устройства.`
    }
    return `Время и даты — по месту объекта (${tzShort}). Не путайте с часовым поясом вашего устройства.`
  }
  if (L === 'zh') {
    return place
      ? `日期与时间均为发布地时间（${place}，${tzShort}），与您设备本地时间可能不同。`
      : `日期与时间为发布地时间（${tzShort}），与您设备本地时间可能不同。`
  }
  if (L === 'th') {
    return place
      ? `วันและเวลาตามสถานที่รายการ (${place}, ${tzShort}) อาจไม่ตรงกับเวลาบนอุปกรณ์ของคุณ`
      : `วันและเวลาตามสถานที่รายการ (${tzShort}) อาจไม่ตรงกับเวลาบนอุปกรณ์ของคุณ`
  }
  return place
    ? `Dates and times are shown in the listing’s location (${place}, ${tzShort}), not your device time zone.`
    : `Dates and times are in the listing’s time zone (${tzShort}), not your device time zone.`
}

/** @param {unknown} slug */
function categoryRentalKind(slug) {
  const s = String(slug || '').toLowerCase()
  if (s === 'property') return 'stay'
  if (s === 'vehicles') return 'vehicle'
  if (s === 'yachts') return 'yacht'
  if (s === 'tours') return 'tour'
  if (s === 'services') return 'service'
  return 'stay'
}

/** Склонение «день» для транспорта / не-жилья (RU). */
export function daysWordRu(n) {
  const k = Math.abs(Math.floor(Number(n))) || 0
  const mod10 = k % 10
  const mod100 = k % 100
  if (mod100 >= 11 && mod100 <= 14) return `${k} дней`
  if (mod10 === 1) return `${k} день`
  if (mod10 >= 2 && mod10 <= 4) return `${k} дня`
  return `${k} дней`
}

/** Склонение «час» (RU). */
export function hoursWordRu(h) {
  const k = Math.max(1, Math.round(Number(h)))
  const mod10 = k % 10
  const mod100 = k % 100
  if (mod100 >= 11 && mod100 <= 14) return `${k} часов`
  if (mod10 === 1) return `${k} час`
  if (mod10 >= 2 && mod10 <= 4) return `${k} часа`
  return `${k} часов`
}

/**
 * Длительность для строки в письме: жильё — ночи; транспорт/яхты/туры/услуги — часы или дни.
 * @param {unknown} checkIn
 * @param {unknown} checkOut
 * @param {string} lang
 * @param {unknown} categorySlug
 * @param {number} nightsFallback — legacy nights из ceil(дней)
 */
export function durationPhraseForBookingEmail(checkIn, checkOut, lang, categorySlug, nightsFallback) {
  const L = normalizeEmailLang(lang)
  const kind = categoryRentalKind(categorySlug)
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const nFallback = Math.max(1, Math.floor(Number(nightsFallback)) || 1)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    if (L === 'ru') return kind === 'stay' ? nightsWordRu(nFallback) : daysWordRu(nFallback)
    return L === 'en' ? `${nFallback} night(s)` : `${nFallback}`
  }

  const ms = end - start
  const hoursTotal = ms / 3600000

  if (kind === 'stay') {
    if (L === 'ru') return nightsWordRu(nFallback)
    if (L === 'th') return `${nFallback} คืน`
    if (L === 'zh') return `${nFallback} 晚`
    return `${nFallback} night${nFallback === 1 ? '' : 's'}`
  }

  // Транспорт, яхты, туры, услуги — без «ночей»
  if (hoursTotal < 24) {
    const h = Math.max(1, Math.round(hoursTotal))
    if (L === 'ru') return hoursWordRu(h)
    if (L === 'th') return `${h} ชม.`
    if (L === 'zh') return `${h} 小时`
    return h === 1 ? '1 hour' : `${h} hours`
  }

  const dayUnits = Math.max(1, Math.ceil(hoursTotal / 24))
  if (L === 'ru') return daysWordRu(dayUnits)
  if (L === 'th') return `${dayUnits} วัน`
  if (L === 'zh') return `${dayUnits} 天`
  return dayUnits === 1 ? '1 day' : `${dayUnits} days`
}

/**
 * Строка «начало — конец» для карточки в письме + длительность с учётом категории.
 * @param {unknown} checkIn
 * @param {unknown} checkOut
 * @param {string} lang
 * @param {number} nights
 * @param {string} [categorySlug]
 */
export function formatBookingRangeLineEmail(checkIn, checkOut, lang, nights, categorySlug) {
  const L = normalizeEmailLang(lang)
  const a = formatBookingEmailEuropean(checkIn, L, { includeTime: true })
  const b = formatBookingEmailEuropean(checkOut, L, { includeTime: true })
  const dur = durationPhraseForBookingEmail(checkIn, checkOut, L, categorySlug, nights)
  return `${a} — ${b} (${dur})`
}

/** Склонение «ночь» для русского (1 ночь / 2 ночи / 5 ночей). */
export function nightsWordRu(n) {
  const k = Math.abs(Math.floor(Number(n))) || 0
  const mod10 = k % 10
  const mod100 = k % 100
  if (mod10 === 1 && mod100 !== 11) return `${k} ночь`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${k} ночи`
  return `${k} ночей`
}

/**
 * Alt для фото объекта (дружелюбно, без пустых alt).
 * @param {{ listingTitle?: string, district?: string }} payload
 */
export function listingImageAltI18n(payload, lang) {
  const L = normalizeEmailLang(lang)
  const title = payload.listingTitle
  const district = payload.district
  const T = ALT_PREFIX[L]
  if (title && district) return `${T.withBoth} ${title}, ${district}`
  if (title) return `${T.withTitle} ${title}`
  return T.fallback
}

const ALT_PREFIX = {
  ru: {
    withBoth: 'Фото объекта для вашего отдыха —',
    withTitle: 'Фото объекта —',
    fallback: 'Фото жилья на GoStayLo для вашей поездки',
  },
  en: {
    withBoth: 'A welcoming photo of your stay —',
    withTitle: 'Photo of your stay —',
    fallback: 'Your GoStayLo stay photo — we’re glad you’re here',
  },
  zh: {
    withBoth: '您住宿的实景照片 —',
    withTitle: '住宿照片 —',
    fallback: 'GoStayLo 为您准备的温馨住宿照片',
  },
  th: {
    withBoth: 'ภาพที่พักของคุณ —',
    withTitle: 'ภาพที่พัก —',
    fallback: 'ภาพที่พักจาก GoStayLo ขอให้ทริปสนุกนะคะ/ครับ',
  },
}

/**
 * @param {object} payload
 * @param {string} lang
 * @param {(href: string) => string} absUrl
 */
export function buildStayCalendarDescriptionI18n(payload, lang, absUrl) {
  const L = normalizeEmailLang(lang)
  const lines = [CAL_DESC_LINE1[L]]
  if (payload.checkoutUrl) {
    lines.push(`${CAL_CHECKOUT[L]} ${absUrl(payload.checkoutUrl)}`)
  }
  if (payload.chatUrl) {
    lines.push(`${CAL_CHAT[L]} ${absUrl(payload.chatUrl)}`)
  }
  return lines.join('\n')
}

const CAL_DESC_LINE1 = {
  ru: 'Бронирование подтверждено в GoStayLo.',
  en: 'Your booking is confirmed on GoStayLo.',
  zh: '您的订单已在 GoStayLo 确认。',
  th: 'การจองของคุณได้รับการยืนยันบน GoStayLo แล้ว',
}

const CAL_CHECKOUT = {
  ru: 'Оплата:',
  en: 'Checkout:',
  zh: '支付/结账：',
  th: 'ชำระเงิน/เช็คเอาต์:',
}

const CAL_CHAT = {
  ru: 'Чат:',
  en: 'Messages:',
  zh: '消息：',
  th: 'แชท:',
}

/** Заголовок события в календаре */
export function calendarStayTitle(listingTitle, lang) {
  const L = normalizeEmailLang(lang)
  const t = listingTitle || '—'
  if (L === 'en') return `Stay: ${t}`
  if (L === 'zh') return `入住：${t}`
  if (L === 'th') return `การเข้าพัก: ${t}`
  return `Проживание: ${t}`
}

export function bookingConfirmedSubject(listingTitle, lang) {
  const L = normalizeEmailLang(lang)
  const t = listingTitle || OBJECT_FALLBACK[L]
  const P = {
    ru: 'Бронирование подтверждено:',
    en: 'Booking confirmed:',
    zh: '预订已确认：',
    th: 'ยืนยันการจองแล้ว:',
  }
  return `${P[L]} ${t}`
}

const OBJECT_FALLBACK = {
  ru: 'объект',
  en: 'listing',
  zh: '服务/房源',
  th: 'รายการ/บริการ',
}

export function bookingConfirmedCopy(lang) {
  const L = normalizeEmailLang(lang)
  return BOOKING_CONFIRMED[L]
}

const GUEST_NAME_FALLBACK = {
  ru: 'Путешественник',
  en: 'Traveler',
  zh: '用户',
  th: 'คุณ',
}

/**
 * Заголовок письма «Имя, бронирование подтверждено».
 */
export function bookingConfirmedEmailTitle(guestName, lang) {
  const L = normalizeEmailLang(lang)
  const g = (guestName && String(guestName).trim()) || GUEST_NAME_FALLBACK[L]
  const lines = {
    ru: `${g}, бронирование подтверждено`,
    en: `${g}, your booking is confirmed`,
    zh: `${g}，您的预订已确认`,
    th: `${g} ยืนยันการจองแล้ว`,
  }
  return lines[L] || lines.en
}

/** Короткая строка об эскроу для писем (все языки). */
export function escrowEmailLine(lang) {
  const L = normalizeEmailLang(lang)
  const lines = {
    ru: '🔒 Ваши средства защищены эскроу GoStayLo до выполнения условий бронирования.',
    en: '🔒 Your funds are protected by GoStayLo escrow until the booking is fulfilled as agreed.',
    zh: '🔒 您的款项由 GoStayLo 托管，按订单约定完成后才会结算给合作伙伴。',
    th: '🔒 เงินของคุณได้รับการคุ้มครองด้วย GoStayLo Escrow จนกว่าการจองจะเป็นไปตามข้อตกลง',
  }
  return lines[L] || lines.en
}

const BOOKING_CONFIRMED = {
  ru: {
    preheader: 'Оплатите бронь и напишите партнёру в чате',
    lead: 'Партнёр подтвердил вашу заявку. Перейдите к оплате, чтобы зафиксировать даты.',
    escrowDefault: 'Средства удерживаются в эскроу GoStayLo до выполнения условий бронирования.',
    checkout: 'Перейти к оплате',
    chat: 'Открыть чат',
    profile: 'Профиль',
    calCaption: 'Сохраните даты поездки в календаре',
    calGoogle: 'Google Календарь',
    calOutlook: 'Outlook',
    calIcs: 'Скачать .ics',
  },
  en: {
    preheader: 'Complete payment and message your partner',
    lead: 'The partner accepted your request. Complete checkout to secure your dates.',
    escrowDefault: 'Funds are held in GoStayLo escrow until the booking is fulfilled.',
    checkout: 'Go to checkout',
    chat: 'Open chat',
    profile: 'Profile',
    calCaption: 'Add your stay to your calendar',
    calGoogle: 'Google Calendar',
    calOutlook: 'Outlook',
    calIcs: 'Download .ics',
  },
  zh: {
    preheader: '完成支付并与合作伙伴在聊天中沟通',
    lead: '合作伙伴已接受您的申请。请尽快完成支付以锁定日期。',
    escrowDefault: '款项由 GoStayLo 托管，按约定完成后才会结算给合作伙伴。',
    checkout: '去支付',
    chat: '打开聊天',
    profile: '个人资料',
    calCaption: '建议优先下载 .ics 并导入本地日历（Google 在部分地区可能不可用）',
    calGoogle: 'Google 日历（可能不可用）',
    calOutlook: 'Outlook',
    calIcs: '首选：下载 .ics',
  },
  th: {
    preheader: 'ชำระเงินและคุยกับพาร์ทเนอร์ในแชท',
    lead: 'พาร์ทเนอร์ยืนยันคำขอแล้ว กรุณาชำระเงินเพื่อล็อกวันที่',
    escrowDefault: 'เงินจะถูกเก็บใน GoStayLo Escrow จนกว่าการจองจะเป็นไปตามข้อตกลง',
    checkout: 'ไปชำระเงิน',
    chat: 'เปิดแชท',
    profile: 'โปรไฟล์',
    calCaption: 'บันทึกวันเข้าพักในปฏิทิน',
    calGoogle: 'Google Calendar',
    calOutlook: 'Outlook',
    calIcs: 'ดาวน์โหลด .ics',
  },
}

export function paymentSuccessSubject(listingTitle, lang) {
  const L = normalizeEmailLang(lang)
  const t = listingTitle || OBJECT_FALLBACK[L]
  const P = {
    ru: 'Оплата получена:',
    en: 'Payment received:',
    zh: '付款已收到：',
    th: 'รับชำระเงินแล้ว:',
  }
  return `${P[L]} ${t}`
}

export function paymentSuccessCopy(lang) {
  const L = normalizeEmailLang(lang)
  return PAYMENT_SUCCESS[L] || PAYMENT_SUCCESS.en
}

const PAYMENT_SUCCESS = {
  ru: {
    preheader: 'Детали бронирования и контакты партнёра',
    title: 'Оплата успешно получена',
    lead: 'Здравствуйте, {name}! Спасибо — платёж прошёл. Ждём вас на Пхукете.',
    escrowDefault: 'Средства защищены эскроу GoStayLo.',
    method: 'Способ оплаты',
    bookings: 'Мои бронирования',
    chat: 'Чат с партнёром',
    profile: 'Профиль',
  },
  en: {
    preheader: 'Booking details and partner contacts',
    title: 'Payment received',
    lead: 'Hello, {name}! Your payment is confirmed. See you in Phuket.',
    escrowDefault: 'Your funds are protected by GoStayLo escrow.',
    method: 'Payment method',
    bookings: 'My bookings',
    chat: 'Message partner',
    profile: 'Profile',
  },
  zh: {
    preheader: '预订详情与合作伙伴联系方式',
    title: '付款已成功收到',
    lead: '{name}，您好！付款已确认，期待在普吉岛见到您。',
    escrowDefault: '您的款项由 GoStayLo 托管保护。',
    method: '支付方式',
    bookings: '我的预订',
    chat: '联系合作伙伴',
    profile: '个人资料',
  },
  th: {
    preheader: 'รายละเอียดการจองและข้อมูลติดต่อพาร์ทเนอร์',
    title: 'รับชำระเงินแล้ว',
    lead: 'สวัสดีค่ะ/ครับ {name} ชำระเงินเรียบร้อยแล้ว ยินดีต้อนรับสู่ภูเก็ต',
    escrowDefault: 'เงินของคุณได้รับการคุ้มครองด้วย GoStayLo Escrow',
    method: 'วิธีชำระเงิน',
    bookings: 'การจองของฉัน',
    chat: 'แชทกับพาร์ทเนอร์',
    profile: 'โปรไฟล์',
  },
}

export function paymentListingImageAltI18n(payload, lang) {
  return listingImageAltI18n(
    { listingTitle: payload.listingTitle, district: payload.district },
    lang,
  )
}
