/**
 * Stage 149 — SSOT payout release timing (thaw trigger + 24h hold + pool copy).
 *
 * Backend rules: `lib/escrow-thaw-rules.js`, `lib/partner/partner-payout-eligibility.js`.
 * Unified after thaw: 24h hold → withdrawable / READY_FOR_PAYOUT → Mon/Thu pools.
 */

import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules.js'
import { getEscrowThawBucketFromRegistry } from '@/lib/config/category-behavior.js'
import { PARTNER_WITHDRAWAL_HOLD_MS } from '@/lib/partner/partner-payout-eligibility.js'

/** @typedef {'check_in' | 'service_start' | 'check_out'} PayoutReleaseTrigger */
/** @typedef {'housing' | 'transport' | 'service'} EscrowThawBucket */
/** @typedef {'ru' | 'en' | 'zh' | 'th'} PayoutReleaseLang */

export const PAYOUT_HOLD_HOURS = PARTNER_WITHDRAWAL_HOLD_MS / (60 * 60 * 1000)

const LANGS = /** @type {PayoutReleaseLang[]} */ (['ru', 'en', 'zh', 'th'])

/**
 * @param {string | undefined | null} lang
 * @returns {PayoutReleaseLang}
 */
export function normalizePayoutReleaseLang(lang) {
  const l = String(lang || 'ru').toLowerCase().slice(0, 2)
  if (l === 'en' || l === 'zh' || l === 'th') return l
  return 'ru'
}

/**
 * @param {object | null | undefined} input
 * @returns {{ categorySlug: string, wizardProfile: string | null }}
 */
export function resolveBookingCategoryContext(input) {
  const meta = input?.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const listing = input?.listing || input?.listings || {}
  const cat = listing?.categories
  let slugFromRel = ''
  if (cat && typeof cat === 'object') {
    if (Array.isArray(cat)) slugFromRel = String(cat[0]?.slug || '').toLowerCase()
    else slugFromRel = String(cat.slug || '').toLowerCase()
  }
  const categorySlug = String(
    input?.categorySlug ||
      input?.category_slug ||
      meta.listing_category_slug ||
      listing?.category_slug ||
      input?.financial_snapshot?.category_slug ||
      slugFromRel ||
      '',
  )
    .toLowerCase()
    .trim()

  const wizardProfileRaw =
    input?.wizardProfile ??
    input?.wizard_profile ??
    (cat && !Array.isArray(cat) ? cat.wizard_profile : null) ??
    (Array.isArray(cat) ? cat[0]?.wizard_profile : null) ??
    null

  return {
    categorySlug,
    wizardProfile: wizardProfileRaw != null ? String(wizardProfileRaw) : null,
  }
}

/**
 * Dominant listing category from partner bookings (finances overview).
 * @param {object[] | null | undefined} bookings
 * @returns {string}
 */
export function inferDominantCategorySlug(bookings) {
  const counts = new Map()
  for (const b of bookings || []) {
    const { categorySlug } = resolveBookingCategoryContext(b)
    if (!categorySlug) continue
    counts.set(categorySlug, (counts.get(categorySlug) || 0) + 1)
  }
  let best = 'property'
  let max = 0
  for (const [slug, n] of counts) {
    if (n > max) {
      max = n
      best = slug
    }
  }
  return best
}

/**
 * @param {EscrowThawBucket} bucket
 * @returns {PayoutReleaseTrigger}
 */
function releaseTriggerForBucket(bucket) {
  if (bucket === 'housing') return 'check_in'
  return 'service_start'
}

/**
 * @param {EscrowThawBucket} bucket
 * @param {PayoutReleaseLang} lang
 * @returns {string}
 */
function buildOverviewText(bucket, lang) {
  const pool = lang === 'ru' ? 'пн/чт' : lang === 'zh' ? '周一/周四' : lang === 'th' ? 'จ.-พ.' : 'Mon/Thu'
  if (bucket === 'housing') {
    if (lang === 'en') {
      return `Funds unlock the day after check-in (6 PM listing time), then a ${PAYOUT_HOLD_HOURS}-hour hold before withdrawal. Payout pools run ${pool}.`
    }
    if (lang === 'zh') {
      return `入住次日 18:00（当地时间）解冻，再等待 ${PAYOUT_HOLD_HOURS} 小时后可提现。提现池：${pool}。`
    }
    if (lang === 'th') {
      return `ปลดเอสโครว์วันถัดจากเช็คอิน (18:00 เวลาท้องถิ่น) จากนั้นรอ ${PAYOUT_HOLD_HOURS} ชม. ก่อนถอน คิวจ่าย ${pool}`
    }
    return `Разморозка — на следующий день после заезда (18:00 по времени объекта), затем ${PAYOUT_HOLD_HOURS} ч до вывода. Пул выплат — ${pool}.`
  }
  if (bucket === 'transport') {
    if (lang === 'en') {
      return `Funds unlock when the rental starts, then a ${PAYOUT_HOLD_HOURS}-hour hold before withdrawal. Payout pools run ${pool}.`
    }
    if (lang === 'zh') {
      return `预订开始时解冻，再等待 ${PAYOUT_HOLD_HOURS} 小时后可提现。提现池：${pool}。`
    }
    if (lang === 'th') {
      return `ปลดเมื่อเริ่มเช่า จากนั้นรอ ${PAYOUT_HOLD_HOURS} ชม. ก่อนถอน คิวจ่าย ${pool}`
    }
    return `Разморозка — в момент начала бронирования, затем ${PAYOUT_HOLD_HOURS} ч до вывода. Пул — ${pool}.`
  }
  if (lang === 'en') {
    return `Funds unlock 2 hours after the service starts, then a ${PAYOUT_HOLD_HOURS}-hour hold before withdrawal. Payout pools run ${pool}.`
  }
  if (lang === 'zh') {
    return `服务开始后 2 小时解冻，再等待 ${PAYOUT_HOLD_HOURS} 小时后可提现。提现池：${pool}。`
  }
  if (lang === 'th') {
    return `ปลด 2 ชม. หลังเริ่มบริการ จากนั้นรอ ${PAYOUT_HOLD_HOURS} ชม. ก่อนถอน คิวจ่าย ${pool}`
  }
  return `Разморозка — через 2 часа после начала услуги, затем ${PAYOUT_HOLD_HOURS} ч до вывода. Пул — ${pool}.`
}

/**
 * Stage-specific UI / notification strings derived from bucket.
 * @param {EscrowThawBucket} bucket
 * @returns {Record<PayoutReleaseLang, Record<string, string>>}
 */
function buildUiTextCatalog(bucket) {
  /** @type {Record<PayoutReleaseLang, Record<string, string>>} */
  const out = { ru: {}, en: {}, zh: {}, th: {} }
  for (const lang of LANGS) {
    const overview = buildOverviewText(bucket, lang)
    out[lang] = {
      overview,
      protected: overview,
      releasing:
        lang === 'en'
          ? `Escrow released. A ${PAYOUT_HOLD_HOURS}-hour security hold is in progress — funds will be available to withdraw soon.`
          : lang === 'zh'
            ? `托管已解冻。${PAYOUT_HOLD_HOURS} 小时安全等待期进行中 — 即将可提现。`
            : lang === 'th'
              ? `ปลดเอสโครว์แล้ว อยู่ในช่วงรอความปลอดภัย ${PAYOUT_HOLD_HOURS} ชม. — เร็วๆ นี้ถอนได้`
              : `Эскроу разморожен. Идёт ${PAYOUT_HOLD_HOURS}-часовой период безопасности — скоро сумма будет доступна к выводу.`,
      ready:
        lang === 'en'
          ? 'Funds are available to withdraw — they will join the next payout pool (Mon/Thu).'
          : lang === 'zh'
            ? '资金可提现 — 将纳入最近提现池（周一/周四）。'
            : lang === 'th'
              ? 'พร้อมถอนแล้ว — จะเข้าคิวจ่ายถัดไป (จ.-พ.)'
              : 'Сумма доступна к выводу — попадёт в ближайший пул выплат (пн/чт).',
      escrowCard:
        lang === 'en'
          ? bucket === 'housing'
            ? 'Escrow holds paid bookings until release (day after check-in at 6 PM). Withdrawable after a 24-hour hold.'
            : bucket === 'transport'
              ? 'Escrow holds paid bookings until the rental starts, then a 24-hour hold before withdrawal.'
              : 'Escrow holds paid bookings until 2h after service start, then a 24-hour hold before withdrawal.'
          : bucket === 'housing'
            ? 'В эскроу — оплаченные брони до разморозки (след. день после заезда, 18:00). Вывод — после 24 ч ожидания.'
            : bucket === 'transport'
              ? 'В эскроу до начала бронирования; после разморозки — 24 ч до вывода.'
              : 'В эскроу до разморозки (2 ч после начала услуги); затем 24 ч до вывода.',
      thawHoldShort:
        lang === 'en'
          ? `${PAYOUT_HOLD_HOURS}h security hold after escrow release.`
          : lang === 'zh'
            ? `解冻后 ${PAYOUT_HOLD_HOURS} 小时安全等待。`
            : lang === 'th'
              ? `รอความปลอดภัย ${PAYOUT_HOLD_HOURS} ชม. หลังปลดเอสโครว์`
              : `${PAYOUT_HOLD_HOURS} ч ожидания после разморозки.`,
      thawHoldLong:
        lang === 'en'
          ? `Escrow released; ${PAYOUT_HOLD_HOURS}-hour hold before withdrawal.`
          : lang === 'zh'
            ? `已解冻；提现前需等待 ${PAYOUT_HOLD_HOURS} 小时。`
            : lang === 'th'
              ? `ปลดแล้ว — รอ ${PAYOUT_HOLD_HOURS} ชม. ก่อนถอน`
              : `Средства разморожены; через ${PAYOUT_HOLD_HOURS} ч станут доступны к выводу.`,
      payoutsInfo:
        lang === 'en'
          ? `${overview} Payout requests are processed within 2–3 business days.`
          : lang === 'zh'
            ? `${overview} 提现申请在 2–3 个工作日内处理。`
            : lang === 'th'
              ? `${overview} คำขอถอนดำเนินการภายใน 2–3 วันทำการ`
              : `${overview} Заявки на выплату обрабатываются в течение 2–3 рабочих дней.`,
      wizardBlurb: overview,
      thawNotificationTitle:
        lang === 'en'
          ? 'Escrow released'
          : lang === 'zh'
            ? '托管已解冻'
            : lang === 'th'
              ? 'ปลดเอสโครว์แล้ว'
              : 'Эскроу разморожен',
      thawNotificationBody:
        lang === 'en'
          ? `฿{amount} for «{listing}» — ${PAYOUT_HOLD_HOURS}-hour security hold before withdrawal.`
          : lang === 'zh'
            ? `「{listing}」฿{amount} — 提现前 ${PAYOUT_HOLD_HOURS} 小时安全等待。`
            : lang === 'th'
              ? `「{listing}」฿{amount} — รอความปลอดภัย ${PAYOUT_HOLD_HOURS} ชม. ก่อนถอน`
              : `฿{amount} по «{listing}» — ${PAYOUT_HOLD_HOURS} ч ожидания перед выводом.`,
      readyNotificationTitle:
        lang === 'en'
          ? 'Ready to withdraw'
          : lang === 'zh'
            ? '可提现'
            : lang === 'th'
              ? 'พร้อมถอน'
              : 'Готово к выводу',
      readyNotificationBody:
        lang === 'en'
          ? `฿{amount} for «{listing}» is available to withdraw (next pool Mon/Thu).`
          : lang === 'zh'
            ? `「{listing}」฿{amount} 可提现（最近池周一/周四）。`
            : lang === 'th'
              ? `「{listing}」฿{amount} พร้อมถอน (คิวจ.-พ.)`
              : `฿{amount} по «{listing}» доступны к выводу (пул пн/чт).`,
      statusThawHold:
        lang === 'en'
          ? `${PAYOUT_HOLD_HOURS}h hold after escrow release`
          : lang === 'zh'
            ? `解冻后 ${PAYOUT_HOLD_HOURS} 小时等待`
            : lang === 'th'
              ? `รอ ${PAYOUT_HOLD_HOURS} ชม. หลังปลดเอสโครว์`
              : `${PAYOUT_HOLD_HOURS} ч после разморозки`,
      conciergePayoutBody:
        lang === 'en'
          ? `{brand} processes transfers on pool days (typically Mon/Thu) after escrow release and the ${PAYOUT_HOLD_HOURS}-hour hold. Dashboard amounts are indicative; actual payout is in your act and history.`
          : lang === 'zh'
            ? `{brand} 在池日（通常为周一/周四）处理转账，须在解冻及 ${PAYOUT_HOLD_HOURS} 小时等待之后。后台金额为参考，实际到账以结算单与历史为准。`
            : lang === 'th'
              ? `{brand} โอนในวันพูล (มักจ.-พ.) หลังปลดเอสโครว์และรอ ${PAYOUT_HOLD_HOURS} ชม. ยอดในแดชบอร์ดเป็นตัวเลขอ้างอิง ยอดจริงในเอกสารและประวัติ`
              : `Перевод выполняет {brand} в дни пула (пн/чт) после разморозки и ${PAYOUT_HOLD_HOURS}-часового ожидания. Сумма в кабинете — ориентир; факт — в акте и истории.`,
    }
  }
  return out
}

/** @type {Map<EscrowThawBucket, Record<PayoutReleaseLang, Record<string, string>>>} */
const UI_CATALOG_CACHE = new Map()

/**
 * @param {EscrowThawBucket} bucket
 */
function getUiCatalogForBucket(bucket) {
  if (!UI_CATALOG_CACHE.has(bucket)) {
    UI_CATALOG_CACHE.set(bucket, buildUiTextCatalog(bucket))
  }
  return UI_CATALOG_CACHE.get(bucket)
}

/**
 * @param {object | null | undefined} bookingOrContext
 * @returns {{
 *   releaseTrigger: PayoutReleaseTrigger,
 *   holdHoursAfterTrigger: number,
 *   displayText: Record<PayoutReleaseLang, string>,
 *   isHousing: boolean,
 *   thawAt: Date | null,
 *   bucket: EscrowThawBucket,
 *   categorySlug: string,
 *   wizardProfile: string | null,
 * }}
 */
export function getPayoutReleaseConfig(bookingOrContext) {
  const { categorySlug, wizardProfile } = resolveBookingCategoryContext(bookingOrContext || {})
  const bucket = getEscrowThawBucketFromRegistry(categorySlug || 'property', wizardProfile)
  const releaseTrigger = releaseTriggerForBucket(bucket)
  const checkInRaw =
    bookingOrContext?.check_in ?? bookingOrContext?.checkIn ?? null
  const thawAtRaw =
    bookingOrContext?.escrow_thaw_at ??
    (bookingOrContext?.metadata &&
    typeof bookingOrContext.metadata === 'object' &&
    bookingOrContext.metadata.escrow_thaw_at
      ? bookingOrContext.metadata.escrow_thaw_at
      : null)

  let thawAt = null
  if (thawAtRaw) {
    const ms = Date.parse(String(thawAtRaw))
    if (Number.isFinite(ms)) thawAt = new Date(ms)
  } else if (checkInRaw) {
    const iso = computeEscrowThawAt({
      checkInRaw,
      categorySlug,
      wizardProfile,
      escrowAtIso: new Date().toISOString(),
    })
    const ms = Date.parse(iso)
    if (Number.isFinite(ms)) thawAt = new Date(ms)
  }

  /** @type {Record<PayoutReleaseLang, string>} */
  const displayText = {}
  for (const lang of LANGS) {
    displayText[lang] = buildOverviewText(bucket, lang)
  }

  return {
    releaseTrigger,
    holdHoursAfterTrigger: PAYOUT_HOLD_HOURS,
    displayText,
    isHousing: bucket === 'housing',
    thawAt,
    bucket,
    categorySlug,
    wizardProfile,
  }
}

/**
 * @param {ReturnType<typeof getPayoutReleaseConfig>} config
 * @param {string} [language]
 * @returns {Record<string, string>}
 */
export function getPayoutReleaseUiTexts(config, language = 'ru') {
  const lang = normalizePayoutReleaseLang(language)
  const catalog = getUiCatalogForBucket(config.bucket)
  return catalog[lang] || catalog.ru
}

/**
 * @param {ReturnType<typeof getPayoutReleaseConfig>} config
 * @param {string} [language]
 * @param {string} [variant] — overview | protected | releasing | ready | …
 */
export function getPayoutReleaseDisplayText(config, language = 'ru', variant = 'overview') {
  const texts = getPayoutReleaseUiTexts(config, language)
  return texts[variant] || texts.overview || config.displayText[normalizePayoutReleaseLang(language)]
}

/**
 * @param {ReturnType<typeof getPayoutReleaseConfig>} config
 * @param {string} language
 * @param {'thaw'|'ready'} kind
 * @param {{ amount?: string, listing?: string, brand?: string }} [vars]
 */
export function formatPayoutNotificationCopy(config, language, kind, vars = {}) {
  const texts = getPayoutReleaseUiTexts(config, language)
  const template =
    kind === 'ready' ? texts.readyNotificationBody : texts.thawNotificationBody
  const title =
    kind === 'ready' ? texts.readyNotificationTitle : texts.thawNotificationTitle
  let body = template
    .replace(/\{amount\}/g, vars.amount ?? '—')
    .replace(/\{listing\}/g, vars.listing ?? '—')
    .replace(/\{brand\}/g, vars.brand ?? '')
  return { title, body }
}
