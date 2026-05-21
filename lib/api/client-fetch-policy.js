/**
 * Stage 113.0 — TTL и ключи in-memory dedup для browser API clients (без TanStack Query).
 */

/** Сессия / me — короткий TTL, in-flight dedup. */
export const TTL_AUTH_ME_MS = 30_000

/** Чат: избранное, provider list — умеренный TTL. */
export const TTL_CHAT_FAVORITES_MS = 30_000
export const TTL_CHAT_PROVIDER_LIST_MS = 8_000

/** Inbox list: только collapse параллельных одинаковых запросов. */
export const TTL_CHAT_CONVERSATIONS_INFLIGHT_MS = 0

/** Публичная витрина (редко меняется). */
export const TTL_SITE_FEATURES_MS = 5 * 60_000
export const TTL_PUBLIC_STATS_MS = 5 * 60_000
export const TTL_SEARCH_LOCATIONS_MS = 10 * 60_000
export const TTL_CATEGORIES_MS = 10 * 60_000

/** FinTech bundle — только in-flight (после мутаций всегда свежий load). */
export const TTL_FINTECH_BUNDLE_MS = 0

/** Главная: search / count — только in-flight по query string. */
export const TTL_HOME_SEARCH_INFLIGHT_MS = 0

/** Partner calendar snapshot — in-flight по ключу диапазона. */
export const TTL_PARTNER_CALENDAR_INFLIGHT_MS = 0

export const CACHE_KEY = {
  authMe: 'auth:me',
  chatFavorites: 'chat:favorites',
  chatProviderList: 'chat:provider-list',
  siteFeatures: 'catalog:site-features',
  publicStats: 'catalog:public-stats',
  searchLocations: 'catalog:search-locations',
  categories: 'catalog:categories',
}
