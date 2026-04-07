/**
 * Локализация транзакционных писем о брони (ru, en, zh, th).
 */

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
  en: 'property',
  zh: '房源',
  th: 'ที่พัก',
}

export function bookingConfirmedCopy(lang) {
  const L = normalizeEmailLang(lang)
  return BOOKING_CONFIRMED[L]
}

const GUEST_NAME_FALLBACK = {
  ru: 'Гость',
  en: 'Guest',
  zh: '客人',
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
    en: `${g}, your stay is confirmed`,
    zh: `${g}，您的预订已确认`,
    th: `${g} ยืนยันการจองแล้ว`,
  }
  return lines[L] || lines.en
}

/** Короткая строка об эскроу для писем (все языки). */
export function escrowEmailLine(lang) {
  const L = normalizeEmailLang(lang)
  const lines = {
    ru: '🔒 Ваши средства защищены эскроу GoStayLo до подтверждения заселения.',
    en: '🔒 Your funds are protected by GoStayLo escrow until check-in is confirmed.',
    zh: '🔒 您的款项由 GoStayLo 托管，入住确认后才会结算给房东。',
    th: '🔒 เงินของคุณได้รับการคุ้มครองด้วย GoStayLo Escrow จนกว่าจะยืนยันการเช็คอิน',
  }
  return lines[L] || lines.en
}

const BOOKING_CONFIRMED = {
  ru: {
    preheader: 'Оплатите бронь и напишите хозяину в чате',
    lead: 'Владелец подтвердил вашу заявку. Перейдите к оплате, чтобы зафиксировать даты.',
    escrowDefault: 'Средства удерживаются в эскроу GoStayLo до заселения.',
    checkout: 'Перейти к оплате',
    chat: 'Открыть чат',
    profile: 'Профиль',
    calCaption: 'Сохраните даты поездки в календаре',
    calGoogle: 'Google Календарь',
    calOutlook: 'Outlook',
    calIcs: 'Скачать .ics',
  },
  en: {
    preheader: 'Complete payment and message your host',
    lead: 'The host accepted your request. Complete checkout to secure your dates.',
    escrowDefault: 'Funds are held in GoStayLo escrow until check-in.',
    checkout: 'Go to checkout',
    chat: 'Open chat',
    profile: 'Profile',
    calCaption: 'Add your stay to your calendar',
    calGoogle: 'Google Calendar',
    calOutlook: 'Outlook',
    calIcs: 'Download .ics',
  },
  zh: {
    preheader: '完成支付并与房东在聊天中沟通',
    lead: '房东已接受您的申请。请尽快完成支付以锁定日期。',
    escrowDefault: '款项由 GoStayLo 托管，入住前不会结算给房东。',
    checkout: '去支付',
    chat: '打开聊天',
    profile: '个人资料',
    calCaption: '把入住日期加入日历',
    calGoogle: 'Google 日历',
    calOutlook: 'Outlook',
    calIcs: '下载 .ics',
  },
  th: {
    preheader: 'ชำระเงินและคุยกับเจ้าของที่พักในแชท',
    lead: 'เจ้าของที่ยืนยันการจองแล้ว กรุณาชำระเงินเพื่อล็อกวันที่',
    escrowDefault: 'เงินจะถูกเก็บใน GoStayLo Escrow จนกว่าจะเช็คอิน',
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
    preheader: 'Детали бронирования и контакты хозяина',
    title: 'Оплата успешно получена',
    lead: 'Здравствуйте, {name}! Спасибо — платёж прошёл. Ждём вас на Пхукете.',
    escrowDefault: 'Средства защищены эскроу GoStayLo.',
    method: 'Способ оплаты',
    bookings: 'Мои бронирования',
    chat: 'Чат с хозяином',
    profile: 'Профиль',
  },
  en: {
    preheader: 'Booking details and host contacts',
    title: 'Payment received',
    lead: 'Hello, {name}! Your payment is confirmed. See you in Phuket.',
    escrowDefault: 'Your funds are protected by GoStayLo escrow.',
    method: 'Payment method',
    bookings: 'My bookings',
    chat: 'Message host',
    profile: 'Profile',
  },
  zh: {
    preheader: '预订详情与房东联系方式',
    title: '付款已成功收到',
    lead: '{name}，您好！付款已确认，期待在普吉岛见到您。',
    escrowDefault: '您的款项由 GoStayLo 托管保护。',
    method: '支付方式',
    bookings: '我的预订',
    chat: '联系房东',
    profile: '个人资料',
  },
  th: {
    preheader: 'รายละเอียดการจองและข้อมูลติดต่อเจ้าของที่พัก',
    title: 'รับชำระเงินแล้ว',
    lead: 'สวัสดีค่ะ/ครับ {name} ชำระเงินเรียบร้อยแล้ว ยินดีต้อนรับสู่ภูเก็ต',
    escrowDefault: 'เงินของคุณได้รับการคุ้มครองด้วย GoStayLo Escrow',
    method: 'วิธีชำระเงิน',
    bookings: 'การจองของฉัน',
    chat: 'แชทกับเจ้าของที่พัก',
    profile: 'โปรไฟล์',
  },
}

export function paymentListingImageAltI18n(payload, lang) {
  return listingImageAltI18n(
    { listingTitle: payload.listingTitle, district: payload.district },
    lang,
  )
}
