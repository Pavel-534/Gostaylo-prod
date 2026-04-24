/**
 * Stage 27.0 — Подсказки по SLA / календарю в зависимости от доминирующей категории партнёра.
 * @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType
 */

import { normalizeUiLang } from '@/lib/config/lang-normalize'

/** @type {Record<ListingServiceType, Record<'ru'|'en'|'zh'|'th', string>>} */
const SLA_RESPONSE_CONTEXT = {
  stay: {
    ru: 'Для жилья гости часто сравнивают варианты параллельно — быстрый ответ в чате повышает шанс брони.',
    en: 'For stays, guests often compare options in parallel — replying quickly in chat improves conversion.',
    zh: '住宿场景下客人常并行对比房源 — 聊天中尽快回复有助于成交。',
    th: 'ที่พัก: แขกมักเปรียบเทียบหลายรายการพร้อมกัน — ตอบแชทเร็วช่วยเพิ่มโอกาสจอง',
  },
  transport: {
    ru: 'Для транспорта критичны точное время и согласование выдачи — долгий «тишина» в чате часто означает отказ клиента.',
    en: 'For transport, timing and pickup coordination matter — long silence in chat often means a lost booking.',
    zh: '车辆场景下时间与取车协调很关键 — 聊天长时间无回复常导致客户流失。',
    th: 'ยานพาหนะ: เวลาและนัดรับส่งสำคัญ — แชทเงียบนานมักทำให้เสียดีล',
  },
  service: {
    ru: 'Для услуг важен почти моментальный ответ: клиент может выбрать другого специалиста за минуты.',
    en: 'For services, near-instant replies matter — clients can pick another professional within minutes.',
    zh: '服务场景下响应要快：客人可能在几分钟内转向其他服务者。',
    th: 'บริการ: ควรตอบเกือบทันที — ลูกค้าอาจเปลี่ยนไปใช้ผู้ให้บริการอื่นในไม่กี่นาที',
  },
  tour: {
    ru: 'Для туров гость ждёт подтверждения времени старта и состава — быстрые ответы снижают риск ухода к конкуренту.',
    en: 'For tours, guests wait for start time and itinerary confirmation — fast replies reduce churn to competitors.',
    zh: '行程/体验：客人等待集合时间与路线确认 — 快速回复可降低流失。',
    th: 'ทัวร์/กิจกรรม: แขกรอยืนยันเวลาเริ่มและรายละเอียด — ตอบเร็วลดโอกาสไปคู่แข่ง',
  },
}

/** Короче для полоски над календарём (можно заменить отдельными строками позже). */
const CALENDAR_BANNER = SLA_RESPONSE_CONTEXT

/**
 * Доп. абзац под блоком скорости ответа в PartnerHealthWidget.
 * @param {ListingServiceType} kind
 * @param {unknown} language
 */
export function getPartnerSlaResponseContextLine(kind, language) {
  const L = normalizeUiLang(language)
  const k = kind && SLA_RESPONSE_CONTEXT[kind] ? kind : 'stay'
  return SLA_RESPONSE_CONTEXT[k][L] || SLA_RESPONSE_CONTEXT.stay.en
}

/**
 * Подсказка на странице мастер-календаря (dominant category).
 * @param {ListingServiceType} kind
 * @param {unknown} language
 */
export function getPartnerCalendarDominantHint(kind, language) {
  const L = normalizeUiLang(language)
  const k = kind && CALENDAR_BANNER[kind] ? kind : 'stay'
  return CALENDAR_BANNER[k][L] || CALENDAR_BANNER.stay.en
}
