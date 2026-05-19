/**
 * SSOT: реквизиты оператора платформы для публичных юридических страниц (/legal/*).
 * Публичный email поддержки — см. getPublicSupportEmail() (NEXT_PUBLIC_SUPPORT_EMAIL).
 */
import { getPublicSupportEmail } from '@/lib/config/public-support-email'

export const LEGAL_PUBLISHER_STATIC = {
  companyName: 'ИП Беломестнов Павел Васильевич',
  inn: '753612213548',
  ogrnip: '316753600085478',
  address: 'Забайкальский край, г. Чита, ул. Славянская, д. 12-150',
  /** Строкой для человекочитаемого отображения (шапки документов) */
  lastUpdated: '18 мая 2026',
}

/**
 * Реквизиты + email для юр. страниц и блока «Оператор платформы».
 */
export function getLegalPublisherDetails() {
  return {
    ...LEGAL_PUBLISHER_STATIC,
    email: getPublicSupportEmail(),
  }
}
