/**
 * Исходящие User-Agent и ASCII-slug продукта для внешних HTTP (Nominatim, iCal, image fetch).
 * Отображаемое имя — SSOT `getSiteDisplayName()`; здесь только безопасные для заголовков токены.
 */

import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url'

const SLUG_MAX = 40

/**
 * @returns {string} Латиница/цифры/._- для суффиксов в User-Agent (пусто → `Platform`).
 */
export function getHttpProductSlug() {
  const s = String(getSiteDisplayName()).replace(/[^\w.-]/g, '').slice(0, SLUG_MAX)
  return s || 'Platform'
}

/** User-Agent для исходящих запросов к внешним iCal (Airbnb/Booking и т.д.). */
export function getIcalSyncUserAgent() {
  return `${getHttpProductSlug()}-Calendar-Sync/1.0`
}

/**
 * Nominatim Usage Policy: идентифицируемое приложение + контакт (URL сайта).
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export function getNominatimUserAgent() {
  const slug = getHttpProductSlug()
  const origin = getPublicSiteUrl()
  return `${slug}/1.0 (+${origin})`
}

/** Прокси картинок (напр. Unsplash) — короткий идентифицируемый клиент. */
export function getImageProxyUserAgent() {
  return `${getHttpProductSlug()}ImageProxy/1.0`
}

/** Загрузка внешних изображений в Storage (совместимый с ботами формат). */
export function getImageImporterUserAgent() {
  const slug = getHttpProductSlug()
  const origin = getPublicSiteUrl()
  return `Mozilla/5.0 (compatible; ${slug}ImageImporter/1.0; +${origin})`
}

/** Служебные запросы из админки (диагностика и т.п.). */
export function getAdminDiagnosticsUserAgent() {
  return `${getHttpProductSlug()}-Admin-Probe/1.0`
}
