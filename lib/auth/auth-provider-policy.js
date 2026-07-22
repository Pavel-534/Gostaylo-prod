/**
 * Stage 189.0 / 189.3.1 — Smart Auth Gateway provider visibility (SSOT).
 *
 * Domestic methods (Yandex, VK, phone, email) — always visible worldwide.
 * Foreign login SSO (Google, Apple, Telegram Login Widget) — hidden when `isRussia`.
 *
 * Telegram dual-mode (Stage 189.3 / 189.3.1):
 * - Login Widget on `/auth/*` → gated by `isAuthProviderVisible('telegram')` (RU = hidden).
 * - AccountConnections deep-link (`t.me/?start=link_<userId>`) → NOT gated here; always
 *   available post-login for transactional notify linking.
 */

/** @typedef {'google' | 'apple' | 'yandex' | 'vk' | 'telegram' | 'phone' | 'email'} AuthProviderId */

/** Primary SSO via foreign identity providers — blocked for RU IP segment. */
export const AUTH_FOREIGN_SSO_PROVIDERS = Object.freeze(['google', 'apple', 'telegram'])

export const AUTH_DOMESTIC_SSO_PROVIDERS = Object.freeze(['yandex', 'vk'])

/** Always offered on auth screens (not geo-gated). */
export const AUTH_UNIVERSAL_PROVIDERS = Object.freeze(['phone', 'email'])

/** Supabase OAuth provider ids (Dashboard must enable each). Telegram uses Login Widget, not Supabase. */
export const SUPABASE_OAUTH_PROVIDER_MAP = Object.freeze({
  google: 'google',
  apple: 'apple',
  yandex: 'yandex',
  vk: 'vk',
})

/**
 * Visible providers for immersive `/auth/*` login/register (primary SSO surface).
 * @param {{ isRussia?: boolean }} opts
 * @returns {AuthProviderId[]}
 */
export function resolveVisibleAuthProviders({ isRussia = false } = {}) {
  const list = [
    'phone',
    'email',
    ...AUTH_DOMESTIC_SSO_PROVIDERS,
  ]
  if (!isRussia) {
    list.push(...AUTH_FOREIGN_SSO_PROVIDERS)
  }
  return list
}

/**
 * Primary auth-screen visibility (Login Widget / OAuth buttons).
 * Do **not** use this to hide Telegram deep-link linking in AccountConnections.
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
