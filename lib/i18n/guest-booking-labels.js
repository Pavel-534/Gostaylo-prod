/**
 * Stage 155.3 — guest-facing booking labels by vertical (warm tone, no legal jargon).
 * Used via getUIText ctx `{ listingCategorySlug, wizardProfile }` placeholders.
 */
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import { getGuestFacingProviderLabel } from '@/lib/i18n/get-guest-provider-label'
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver'
import { getSiteDisplayName } from '@/lib/site-url'

/** @typedef {'stay' | 'transport' | 'tour' | 'service'} GuestVerticalBucket */

const DATE_LABELS = {
  ru: {
    stay: { checkInLabel: 'Заезд', checkOutLabel: 'Выезд' },
    transport: { checkInLabel: 'Начало поездки', checkOutLabel: 'Окончание поездки' },
    tour: { checkInLabel: 'Начало', checkOutLabel: 'Окончание' },
    service: { checkInLabel: 'Начало', checkOutLabel: 'Окончание' },
  },
  en: {
    stay: { checkInLabel: 'Check-in', checkOutLabel: 'Check-out' },
    transport: { checkInLabel: 'Trip start', checkOutLabel: 'Trip end' },
    tour: { checkInLabel: 'Start', checkOutLabel: 'End' },
    service: { checkInLabel: 'Start', checkOutLabel: 'End' },
  },
  zh: {
    stay: { checkInLabel: '入住', checkOutLabel: '退房' },
    transport: { checkInLabel: '行程开始', checkOutLabel: '行程结束' },
    tour: { checkInLabel: '开始', checkOutLabel: '结束' },
    service: { checkInLabel: '开始', checkOutLabel: '结束' },
  },
  th: {
    stay: { checkInLabel: 'เช็คอิน', checkOutLabel: 'เช็คเอาท์' },
    transport: { checkInLabel: 'เริ่มเดินทาง', checkOutLabel: 'สิ้นสุดการเช่า' },
    tour: { checkInLabel: 'เริ่ม', checkOutLabel: 'สิ้นสุด' },
    service: { checkInLabel: 'เริ่ม', checkOutLabel: 'สิ้นสุด' },
  },
}

/**
 * @param {{ categorySlug?: string | null, wizardProfile?: string | null, language?: string }} params
 * @returns {GuestVerticalBucket}
 */
export function resolveGuestVerticalBucket({ categorySlug, wizardProfile }) {
  return inferListingServiceTypeFromCategorySlug(categorySlug, wizardProfile)
}

/**
 * Placeholders for getUIText / email templates: `{provider}`, `{providerDative}`, `{checkInLabel}`, …
 * @param {{ categorySlug?: string | null, wizardProfile?: string | null, language?: string }} params
 */
export function getGuestBookingLabelPlaceholders({ categorySlug, wizardProfile, language = 'ru' }) {
  const lang = normalizeUiLocaleCode(language)
  const bucket = resolveGuestVerticalBucket({ categorySlug, wizardProfile })
  const dateRow = (DATE_LABELS[lang] || DATE_LABELS.en)[bucket] || DATE_LABELS.en.stay
  const base = { categorySlug, wizardProfile, language: lang }

  return {
    provider: getGuestFacingProviderLabel({ ...base, context: 'default' }),
    providerDative: getGuestFacingProviderLabel({ ...base, context: 'dative' }),
    providerPossessive: getGuestFacingProviderLabel({ ...base, context: 'possessive' }),
    providerInstrumental: getGuestFacingProviderLabel({ ...base, context: 'instrumental' }),
    ...dateRow,
  }
}

/**
 * Single date label helper for components (DealDetailsCard, headers).
 * @param {'checkInLabel' | 'checkOutLabel'} field
 */
export function getGuestDateLabel(field, { categorySlug, wizardProfile, language = 'ru' }) {
  const ph = getGuestBookingLabelPlaceholders({ categorySlug, wizardProfile, language })
  return ph[field] || ph.checkInLabel
}

/**
 * @param {string} template
 * @param {Record<string, string>} placeholders
 * @param {{ brand?: string }} [opts]
 */
export function interpolateGuestLabelTemplate(template, placeholders, opts = {}) {
  let s = String(template || '')
  for (const [key, value] of Object.entries(placeholders || {})) {
    s = s.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''))
  }
  if (opts.brand != null) {
    s = s.replace(/\{brand\}/g, String(opts.brand))
  }
  return s
}

/** Stage 155.6 — guest payment/escrow notify copy by vertical (email/push/TG). */
const GUEST_PAYMENT_ESCROW_COPY = {
  ru: {
    stay: {
      lead: 'Здравствуйте, {name}! Оплата успешно получена. Средства защищены эскроу {brand} до заезда — напишите {providerDative} в чате, чтобы согласовать встречу.',
      escrow: 'Деньги на счёте эскроу и будут переведены {providerDative} только после выполнения условий брони.',
      chat: 'Чат с {providerInstrumental}',
      pushBody: 'Средства защищены эскроу {siteName}. Напишите {providerDative} в чате · {listing}',
    },
    transport: {
      lead: 'Здравствуйте, {name}! Оплата за транспорт успешно получена. Средства защищены эскроу до встречи с {providerInstrumental}.',
      escrow: 'Средства защищены эскроу {brand} до завершения поездки. Согласуйте детали с {providerInstrumental} в чате.',
      chat: 'Чат с {providerInstrumental}',
      pushBody: 'Оплата за транспорт в эскроу {siteName}. Свяжитесь с {providerInstrumental} · {listing}',
    },
    tour: {
      lead: 'Здравствуйте, {name}! Оплата за тур успешно получена. Средства защищены эскроу до встречи с {providerInstrumental}.',
      escrow: 'Средства защищены эскроу {brand} до завершения программы. Детали встречи — в чате с {providerInstrumental}.',
      chat: 'Чат с {providerInstrumental}',
      pushBody: 'Оплата тура в эскроу {siteName}. Напишите {providerDative} · {listing}',
    },
    service: {
      lead: 'Здравствуйте, {name}! Оплата успешно получена. Средства защищены эскроу до начала услуги с {providerInstrumental}.',
      escrow: 'Средства защищены эскроу {brand} до завершения услуги. Согласуйте детали с {providerInstrumental} в чате.',
      chat: 'Чат с {providerInstrumental}',
      pushBody: 'Оплата в эскроу {siteName}. Свяжитесь с {providerDative} · {listing}',
    },
  },
  en: {
    stay: {
      lead: 'Hello, {name}! Payment received. Funds are held in {brand} escrow until check-in — message {providerDative} in chat to coordinate arrival.',
      escrow: 'Funds stay in escrow until the stay is completed per booking terms.',
      chat: 'Message {providerInstrumental}',
      pushBody: 'Funds protected by {siteName} escrow. Message {providerDative} · {listing}',
    },
    transport: {
      lead: 'Hello, {name}! Your transport payment is confirmed. Funds are protected in escrow until you meet {providerInstrumental}.',
      escrow: 'Funds are held in {brand} escrow until the trip ends. Coordinate pickup with {providerInstrumental} in chat.',
      chat: 'Message {providerInstrumental}',
      pushBody: 'Transport payment in {siteName} escrow. Contact {providerInstrumental} · {listing}',
    },
    tour: {
      lead: 'Hello, {name}! Your tour payment is confirmed. Funds are protected until you meet {providerInstrumental}.',
      escrow: 'Funds are held in {brand} escrow until the tour is completed.',
      chat: 'Message {providerInstrumental}',
      pushBody: 'Tour payment in {siteName} escrow. Message {providerDative} · {listing}',
    },
    service: {
      lead: 'Hello, {name}! Payment received. Funds are protected in escrow until your service with {providerInstrumental}.',
      escrow: 'Funds are held in {brand} escrow until the service is completed.',
      chat: 'Message {providerInstrumental}',
      pushBody: 'Payment in {siteName} escrow. Contact {providerDative} · {listing}',
    },
  },
  zh: {
    stay: {
      lead: '{name}，您好！付款已收到。资金由 {brand} 托管保护至入住前 — 请在聊天中联系{providerDative}确认见面细节。',
      escrow: '资金在托管账户中，按预订条款完成后才会结算。',
      chat: '联系{providerInstrumental}',
      pushBody: '资金由 {siteName} 托管保护。联系{providerDative} · {listing}',
    },
    transport: {
      lead: '{name}，您好！交通预订付款已收到。资金托管保护至与{providerInstrumental}见面。',
      escrow: '资金由 {brand} 托管至行程结束。请在聊天中与{providerInstrumental}确认取车细节。',
      chat: '联系{providerInstrumental}',
      pushBody: '交通付款已托管 · {listing}',
    },
    tour: { lead: '{name}，您好！行程付款已收到。', escrow: '资金由 {brand} 托管保护。', chat: '联系{providerInstrumental}', pushBody: '{listing}' },
    service: { lead: '{name}，您好！服务付款已收到。', escrow: '资金由 {brand} 托管保护。', chat: '联系{providerInstrumental}', pushBody: '{listing}' },
  },
  th: {
    stay: {
      lead: 'สวัสดี {name}! รับชำระเงินแล้ว เงินอยู่ใน escrow {brand} จนเช็คอิน — เขียนถึง{providerDative}ในแชท',
      escrow: 'เงินอยู่ใน escrow จนกว่าการเข้าพักจะเสร็จสมบูรณ์',
      chat: 'แชทกับ{providerInstrumental}',
      pushBody: 'เงินใน escrow {siteName} · {listing}',
    },
    transport: {
      lead: 'สวัสดี {name}! ชำระค่าเช่าพาหนะแล้ว เงินอยู่ใน escrow จนพบ{providerInstrumental}',
      escrow: 'เงินอยู่ใน escrow {brand} จนจบการเดินทาง',
      chat: 'แชทกับ{providerInstrumental}',
      pushBody: 'ชำระค่าเช่าใน escrow · {listing}',
    },
    tour: { lead: 'สวัสดี {name}! ชำระทัวร์แล้ว', escrow: 'เงินใน escrow {brand}', chat: 'แชทกับ{providerInstrumental}', pushBody: '{listing}' },
    service: { lead: 'สวัสดี {name}! ชำระบริการแล้ว', escrow: 'เงินใน escrow {brand}', chat: 'แชทกับ{providerInstrumental}', pushBody: '{listing}' },
  },
}

/**
 * @param {{ categorySlug?: string | null, wizardProfile?: string | null, language?: string }} params
 */
export function getGuestPaymentEscrowNotifyCopy({ categorySlug, wizardProfile, language = 'ru' }) {
  const lang = normalizeUiLocaleCode(language)
  const bucket = resolveGuestVerticalBucket({ categorySlug, wizardProfile })
  const ph = getGuestBookingLabelPlaceholders({ categorySlug, wizardProfile, language: lang })
  const brand = getSiteDisplayName()
  const raw =
    GUEST_PAYMENT_ESCROW_COPY[lang]?.[bucket] ||
    GUEST_PAYMENT_ESCROW_COPY.en[bucket] ||
    GUEST_PAYMENT_ESCROW_COPY.en.stay

  return {
    leadTemplate: raw.lead,
    escrowTemplate: raw.escrow,
    chatLabel: interpolateGuestLabelTemplate(raw.chat, ph, { brand }),
    pushBodyTemplate: raw.pushBody,
    placeholders: ph,
    brand,
  }
}

/**
 * @param {'lead' | 'escrow' | 'pushBody'} field
 * @param {{ guestName?: string, categorySlug?: string | null, wizardProfile?: string | null, language?: string }} params
 */
export function formatGuestPaymentEscrowLine(field, { guestName = '', categorySlug, wizardProfile, language = 'ru' }) {
  const pack = getGuestPaymentEscrowNotifyCopy({ categorySlug, wizardProfile, language })
  const ph = { ...pack.placeholders, name: String(guestName || '').trim() || pack.placeholders.provider }
  const key =
    field === 'lead' ? 'leadTemplate' : field === 'escrow' ? 'escrowTemplate' : 'pushBodyTemplate'
  return interpolateGuestLabelTemplate(pack[key], ph, { brand: pack.brand })
}
