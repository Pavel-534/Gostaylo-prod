/**
 * Stage 189.0 — Smart Auth Gateway provider visibility (SSOT).
 *
 * Domestic methods (Yandex, VK, phone, email) — always visible worldwide.
 * Google / Apple — hidden only when user is on a Russian IP (`isRussia`).
 * Telegram Login — always visible.
 */

/** @typedef {'google' | 'apple' | 'yandex' | 'vk' | 'telegram' | 'phone' | 'email'} AuthProviderId */

export const AUTH_FOREIGN_SSO_PROVIDERS = Object.freeze(['google', 'apple'])

export const AUTH_DOMESTIC_SSO_PROVIDERS = Object.freeze(['yandex', 'vk'])

export const AUTH_UNIVERSAL_PROVIDERS = Object.freeze(['telegram', 'phone', 'email'])

/** Supabase OAuth provider ids (Dashboard must enable each). */
export const SUPABASE_OAUTH_PROVIDER_MAP = Object.freeze({
  google: 'google',
  apple: 'apple',
  yandex: 'yandex',
  vk: 'vk',
})

/**
 * @param {{ isRussia?: boolean }} opts
 * @returns {AuthProviderId[]}
 */
export function resolveVisibleAuthProviders({ isRussia = false } = {}) {
  const list = [
    'phone',
    'email',
    'telegram',
    ...AUTH_DOMESTIC_SSO_PROVIDERS,
  ]
  if (!isRussia) {
    list.push(...AUTH_FOREIGN_SSO_PROVIDERS)
  }
  return list
}

/**
 * @param {AuthProviderId} provider
 * @param {{ isRussia?: boolean }} opts
 */
export function isAuthProviderVisible(provider, { isRussia = false } = {}) {
  const id = String(provider || '').toLowerCase()
  if (AUTH_UNIVERSAL_PROVIDERS.includes(id)) return true
  if (AUTH_DOMESTIC_SSO_PROVIDERS.includes(id)) return true
  if (AUTH_FOREIGN_SSO_PROVIDERS.includes(id)) return !isRussia
  return false
}
