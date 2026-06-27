/**
 * Stage 128.0 — TanStack Query key factories (SSOT для новых и мигрируемых хуков).
 *
 * Конвенция:
 * - Первый сегмент — домен (`catalog`, `home`, `auth`, `partner`, …).
 * - Authenticated ключи включают `scopeId` (profile id); публичные — `PUBLIC_SCOPE`.
 * - Параметры фильтров — стабильный объект в конце (сериализуется RQ).
 * - После logout весь кэш сбрасывается (`clearClientQueryCache`); не полагаться на ручной перебор ключей.
 *
 * Существующие фабрики в хуках (`partnerBookingsKeys`, …) постепенно переезжают сюда.
 */

/** Сегмент для анонимного / публичного кэша (без привязки к user id). */
export const PUBLIC_SCOPE = 'public'

/**
 * Нормализует id профиля для query key. На сервере / до login — `PUBLIC_SCOPE`.
 * @param {string | null | undefined} profileId
 */
export function queryScopeId(profileId) {
  const id = profileId != null ? String(profileId).trim() : ''
  return id || PUBLIC_SCOPE
}

/** @param {unknown} value */
function stableParams(value) {
  if (value == null) return {}
  if (typeof value === 'object') return value
  return { value }
}

export const queryKeys = {
  auth: {
    all: ['auth'],
    me: (scopeId = PUBLIC_SCOPE) => [...queryKeys.auth.all, 'me', queryScopeId(scopeId)],
  },

  /** Публичные справочники и сущности без привязки к сессии (главная + каталог). */
  public: {
    all: ['public'],
    categories: () => [...queryKeys.public.all, 'categories', PUBLIC_SCOPE],
  },

  listing: {
    all: ['listing'],
    detail: (listingId) => [
      ...queryKeys.listing.all,
      'detail',
      PUBLIC_SCOPE,
      String(listingId),
    ],
    calendar: (listingId, params = {}) => [
      ...queryKeys.listing.all,
      'calendar',
      PUBLIC_SCOPE,
      String(listingId),
      stableParams(params),
    ],
    availability: (listingId, params = {}) => [
      ...queryKeys.listing.all,
      'availability',
      PUBLIC_SCOPE,
      String(listingId),
      stableParams(params),
    ],
  },

  catalog: {
    all: ['catalog'],
    /** @deprecated Используйте `queryKeys.public.categories()` — тот же ключ. */
    categories: () => queryKeys.public.categories(),
    siteFeatures: () => [...queryKeys.catalog.all, 'site-features', PUBLIC_SCOPE],
    publicStats: () => [...queryKeys.catalog.all, 'public-stats', PUBLIC_SCOPE],
    searchLocations: () => [...queryKeys.catalog.all, 'search-locations', PUBLIC_SCOPE],
    search: (params) => [...queryKeys.catalog.all, 'search', PUBLIC_SCOPE, stableParams(params)],
    mapPins: (params) => [...queryKeys.catalog.all, 'map-pins', PUBLIC_SCOPE, stableParams(params)],
  },

  home: {
    all: ['home'],
    categories: () => queryKeys.public.categories(),
    featured: (params) => [...queryKeys.home.all, 'featured', PUBLIC_SCOPE, stableParams(params)],
    liveCount: (params) => [...queryKeys.home.all, 'live-count', PUBLIC_SCOPE, stableParams(params)],
  },

  fx: {
    all: ['fx'],
    rates: (opts = {}) => [...queryKeys.fx.all, 'rates', PUBLIC_SCOPE, stableParams(opts)],
  },

  profile: {
    all: ['profile'],
    me: (scopeId) => [...queryKeys.profile.all, 'me', queryScopeId(scopeId)],
    partnerApplicationStatus: (scopeId) => [
      ...queryKeys.profile.all,
      'partner-application-status',
      queryScopeId(scopeId),
    ],
  },

  wallet: {
    all: ['wallet'],
    /** Совместимо с legacy `['wallet-me']` в `use-wallet-me.js` (миграция ключа — отдельный PR). */
    me: (scopeId) => [...queryKeys.wallet.all, 'me', queryScopeId(scopeId)],
  },

  referral: {
    all: ['referral'],
    me: (scopeId, opts = {}) => [
      ...queryKeys.referral.all,
      'me',
      queryScopeId(scopeId),
      stableParams(opts),
    ],
  },

  partner: {
    all: ['partner'],
    bookings: {
      all: (scopeId) => [...queryKeys.partner.all, 'bookings', queryScopeId(scopeId)],
      list: (scopeId, filters) => [
        ...queryKeys.partner.bookings.all(scopeId),
        'list',
        stableParams(filters),
      ],
      detail: (scopeId, bookingId) => [
        ...queryKeys.partner.bookings.all(scopeId),
        'detail',
        String(bookingId),
      ],
    },
    calendar: {
      all: (scopeId) => [...queryKeys.partner.all, 'calendar', queryScopeId(scopeId)],
      data: (scopeId, dateRange, listingId) => [
        ...queryKeys.partner.calendar.all(scopeId),
        'data',
        stableParams(dateRange),
        listingId != null ? String(listingId) : 'all',
      ],
    },
    listings: {
      all: (scopeId) => [...queryKeys.partner.all, 'listings', queryScopeId(scopeId)],
      list: (scopeId) => [...queryKeys.partner.listings.all(scopeId), 'list'],
    },
    stats: {
      all: (scopeId) => [...queryKeys.partner.all, 'stats', queryScopeId(scopeId)],
      data: (scopeId, params) => [...queryKeys.partner.stats.all(scopeId), 'data', stableParams(params)],
    },
    finances: {
      all: (scopeId) => [...queryKeys.partner.all, 'finances', queryScopeId(scopeId)],
      summary: (scopeId) => [...queryKeys.partner.finances.all(scopeId), 'summary'],
    },
  },

  renter: {
    all: ['renter'],
    bookings: (scopeId) => [...queryKeys.renter.all, 'bookings', queryScopeId(scopeId)],
  },

  chat: {
    all: ['chat'],
    inbox: (scopeId, tab, opts = {}) => [
      ...queryKeys.chat.all,
      'inbox',
      queryScopeId(scopeId),
      tab,
      stableParams(opts),
    ],
    thread: (scopeId, conversationId) => [
      ...queryKeys.chat.all,
      'thread',
      queryScopeId(scopeId),
      String(conversationId),
    ],
    favorites: (scopeId) => [...queryKeys.chat.all, 'favorites', queryScopeId(scopeId)],
  },

  checkout: {
    all: ['checkout'],
    booking: (bookingId) => [...queryKeys.checkout.all, 'booking', String(bookingId)],
    invoice: (bookingId) => [...queryKeys.checkout.all, 'invoice', String(bookingId)],
  },

  admin: {
    all: ['admin'],
    fi: (period) => [...queryKeys.admin.all, 'fi', stableParams(period)],
    roi: (window) => [...queryKeys.admin.all, 'roi', stableParams(window)],
    fintechBundle: (params) => [...queryKeys.admin.all, 'fintech-bundle', stableParams(params)],
  },
}
