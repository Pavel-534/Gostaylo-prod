/**
 * Stage 27.0 — Подписи критериев отзыва по типу услуги (ключи API не меняются: cleanliness, accuracy, …).
 * @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType
 */

import { normalizeUiLang } from '@/lib/config/lang-normalize'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'

export const REVIEW_RATING_KEYS = ['cleanliness', 'accuracy', 'communication', 'location', 'value']

/** @type {Record<string, string>} */
const ICONS_DEFAULT = {
  cleanliness: '🧹',
  accuracy: '📸',
  communication: '💬',
  location: '📍',
  value: '💰',
}

/** @type {Record<ListingServiceType, Record<string, string>>} */
const ICONS_BY_KIND = {
  stay: ICONS_DEFAULT,
  transport: {
    cleanliness: '🧽',
    accuracy: '🔧',
    communication: '🔑',
    location: '📍',
    value: '💰',
  },
  service: {
    cleanliness: '✨',
    accuracy: '⭐',
    communication: '🙂',
    location: '⏱️',
    value: '💰',
  },
  tour: {
    cleanliness: '🎒',
    accuracy: '🗺️',
    communication: '🙂',
    location: '⏱️',
    value: '💰',
  },
}

/**
 * @type {Record<ListingServiceType, Record<'ru'|'en'|'zh'|'th', Record<string, string>>>}
 * Ключи = поля ratings в API.
 */
const LABELS_BY_KIND = {
  stay: {
    ru: {
      cleanliness: 'Чистота',
      accuracy: 'Комфорт и соответствие описанию',
      communication: 'Коммуникация с партнёром',
      location: 'Расположение',
      value: 'Соотношение цена / качество',
    },
    en: {
      cleanliness: 'Cleanliness',
      accuracy: 'Comfort & match to description',
      communication: 'Communication with host',
      location: 'Location',
      value: 'Value for money',
    },
    zh: {
      cleanliness: '清洁度',
      accuracy: '舒适度与描述一致',
      communication: '与房东/服务方沟通',
      location: '位置',
      value: '性价比',
    },
    th: {
      cleanliness: 'ความสะอาด',
      accuracy: 'ความสบายและตรงตามคำอธิบาย',
      communication: 'การสื่อสารกับเจ้าของ/พาร์ทเนอร์',
      location: 'ทำเล',
      value: 'ความคุ้มค่า',
    },
  },
  transport: {
    ru: {
      cleanliness: 'Чистота салона',
      accuracy: 'Техническое состояние',
      communication: 'Скорость и ясность передачи / выдачи',
      location: 'Удобство места выдачи',
      value: 'Соотношение цена / качество',
    },
    en: {
      cleanliness: 'Interior cleanliness',
      accuracy: 'Mechanical / technical condition',
      communication: 'Pickup handover speed & clarity',
      location: 'Pickup location convenience',
      value: 'Value for money',
    },
    zh: {
      cleanliness: '车内清洁',
      accuracy: '车况 / 机械状态',
      communication: '交车速度与沟通清晰度',
      location: '取车地点便利性',
      value: '性价比',
    },
    th: {
      cleanliness: 'ความสะอาดในห้องโดยสาร',
      accuracy: 'สภาพเครื่องยนต์/เทคนิค',
      communication: 'ความรวดเร็วและชัดเจนตอนส่งมอบ',
      location: 'ความสะดวกของจุดรับรถ',
      value: 'ความคุ้มค่า',
    },
  },
  service: {
    ru: {
      cleanliness: 'Аккуратность и презентация',
      accuracy: 'Качество услуги',
      communication: 'Общительность и ясность',
      location: 'Пунктуальность и логистика',
      value: 'Соотношение цена / качество',
    },
    en: {
      cleanliness: 'Neatness & presentation',
      accuracy: 'Quality of service',
      communication: 'Friendliness & clarity',
      location: 'Punctuality & logistics',
      value: 'Value for money',
    },
    zh: {
      cleanliness: '整洁与呈现',
      accuracy: '服务质量',
      communication: '亲和力与表达清晰度',
      location: '守时与行程安排',
      value: '性价比',
    },
    th: {
      cleanliness: 'ความเรียบร้อยและการนำเสนอ',
      accuracy: 'คุณภาพบริการ',
      communication: 'เป็นกันเองและชัดเจน',
      location: 'ตรงเวลาและลอจิสติกส์',
      value: 'ความคุ้มค่า',
    },
  },
  tour: {
    ru: {
      cleanliness: 'Организация и экипировка',
      accuracy: 'Качество программы / маршрута',
      communication: 'Общительность гида / партнёра',
      location: 'Пунктуальность старта и логистика',
      value: 'Соотношение цена / впечатление',
    },
    en: {
      cleanliness: 'Organization & gear',
      accuracy: 'Program / route quality',
      communication: 'Guide communication',
      location: 'Start punctuality & logistics',
      value: 'Value vs experience',
    },
    zh: {
      cleanliness: '组织与装备',
      accuracy: '行程/路线质量',
      communication: '向导沟通',
      location: '集合守时与安排',
      value: '价格与体验',
    },
    th: {
      cleanliness: 'การจัดการและอุปกรณ์',
      accuracy: 'คุณภาพโปรแกรม/เส้นทาง',
      communication: 'การสื่อสารของไกด์',
      location: 'ตรงเวลาเริ่มและลอจิสติกส์',
      value: 'ความคุ้มกับประสบการณ์',
    },
  },
}

/**
 * Строки для ReviewModal: те же ключи API, подписи и иконки по category_slug → service type.
 * @param {unknown} categorySlug
 * @param {unknown} language
 * @param {(key: string) => string} txUniversal — например (k) => getUIText(`reviewForm_dim_${k}`, language)
 * @returns {{ key: string, icon: string, label: string }[]}
 */
export function getReviewCriteriaRows(categorySlug, language, txUniversal) {
  const kind = inferListingServiceTypeFromCategorySlug(categorySlug)
  const L = normalizeUiLang(language)
  const icons = ICONS_BY_KIND[kind] || ICONS_DEFAULT
  const pack = LABELS_BY_KIND[kind]?.[L] || LABELS_BY_KIND[kind]?.en

  return REVIEW_RATING_KEYS.map((key) => ({
    key,
    icon: icons[key] || ICONS_DEFAULT[key],
    label: (pack && pack[key]) || txUniversal(key),
  }))
}
