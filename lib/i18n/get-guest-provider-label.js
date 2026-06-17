/**
 * Guest-facing counterparty label (renter UI).
 * Code/API uses Partner; guests see host / landlord / provider by vertical.
 */
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver'

/** @typedef {'default' | 'dative' | 'possessive' | 'instrumental' | 'message'} GuestProviderLabelContext */

const LABELS = {
  ru: {
    stay: {
      default: 'хозяин',
      dative: 'хозяину',
      possessive: 'хозяина',
      instrumental: 'хозяином',
      message: 'хозяину',
    },
    transport: {
      default: 'владелец',
      dative: 'владельцу',
      possessive: 'владельца',
      instrumental: 'владельцем',
      message: 'владельцу',
    },
    tour: {
      default: 'организатор',
      dative: 'организатору',
      possessive: 'организатора',
      instrumental: 'организатором',
      message: 'организатору',
    },
    service: {
      default: 'организатор',
      dative: 'организатору',
      possessive: 'организатора',
      instrumental: 'организатором',
      message: 'организатору',
    },
  },
  en: {
    stay: {
      default: 'host',
      dative: 'the host',
      possessive: "the host's",
      instrumental: 'the host',
      message: 'the host',
    },
    transport: {
      default: 'owner',
      dative: 'the owner',
      possessive: "the owner's",
      instrumental: 'the owner',
      message: 'the owner',
    },
    tour: {
      default: 'organizer',
      dative: 'the organizer',
      possessive: "the organizer's",
      instrumental: 'the organizer',
      message: 'the organizer',
    },
    service: {
      default: 'provider',
      dative: 'the provider',
      possessive: "the provider's",
      instrumental: 'the provider',
      message: 'the provider',
    },
  },
  zh: {
    stay: {
      default: '房东',
      dative: '房东',
      possessive: '房东',
      instrumental: '房东',
      message: '房东',
    },
    transport: {
      default: '车主',
      dative: '车主',
      possessive: '车主',
      instrumental: '车主',
      message: '车主',
    },
    tour: {
      default: '组织者',
      dative: '组织者',
      possessive: '组织者',
      instrumental: '组织者',
      message: '组织者',
    },
    service: {
      default: '服务方',
      dative: '服务方',
      possessive: '服务方',
      instrumental: '服务方',
      message: '服务方',
    },
  },
  th: {
    stay: {
      default: 'เจ้าของ',
      dative: 'เจ้าของ',
      possessive: 'เจ้าของ',
      instrumental: 'เจ้าของ',
      message: 'เจ้าของ',
    },
    transport: {
      default: 'เจ้าของรถ',
      dative: 'เจ้าของรถ',
      possessive: 'เจ้าของรถ',
      instrumental: 'เจ้าของรถ',
      message: 'เจ้าของรถ',
    },
    tour: {
      default: 'ผู้จัด',
      dative: 'ผู้จัด',
      possessive: 'ผู้จัด',
      instrumental: 'ผู้จัด',
      message: 'ผู้จัด',
    },
    service: {
      default: 'ผู้ให้บริการ',
      dative: 'ผู้ให้บริการ',
      possessive: 'ผู้ให้บริการ',
      instrumental: 'ผู้ให้บริการ',
      message: 'ผู้ให้บริการ',
    },
  },
}

/**
 * @param {{
 *   categorySlug?: string | null,
 *   wizardProfile?: string | null,
 *   language?: string,
 *   context?: GuestProviderLabelContext,
 * }} params
 */
export function getGuestFacingProviderLabel({
  categorySlug,
  wizardProfile,
  language = 'ru',
  context = 'default',
}) {
  const lang = normalizeUiLocaleCode(language)
  const serviceType = inferListingServiceTypeFromCategorySlug(categorySlug, wizardProfile)
  const bucket = LABELS[lang] || LABELS.en
  const row = bucket[serviceType] || bucket.stay
  return row[context] || row.default
}
