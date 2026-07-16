/**
 * Preload Auth modal chunk on first open (Stage 171.34).
 * @returns {Promise<{ AuthModalShell: import('@/components/auth/modals/AuthModalShell').AuthModalShell }>}
 */
let preloadPromise = null

export function preloadAuthModalShell() {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import('@/lib/translations/register-auth-i18n'),
      import('@/lib/translations/register-errors-i18n'),
      import('@/components/auth/modals/AuthModalShell'),
    ]).then(([, , mod]) => mod)
  }
  return preloadPromise
}

export function resetAuthModalPreloadForTests() {
  preloadPromise = null
}
