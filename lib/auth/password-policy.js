/**
 * SSOT: правила пароля для регистрации, сброса и `POST /api/v2/auth/register`.
 * См. ARCHITECTURAL_DECISIONS.md (Password policy).
 */
export const AUTH_PASSWORD_MIN_LENGTH = 8;

/** Минимум одна латиница/кириллица и одна цифра (как на бэкенде регистрации). */
export const AUTH_PASSWORD_COMPLEXITY_RE = /^(?=.*[A-Za-z\u0400-\u04FF])(?=.*\d).+$/;

/**
 * @param {string} [password]
 * @returns {boolean}
 */
export function isAuthPasswordCompliant(password) {
  const p = String(password ?? '');
  return p.length >= AUTH_PASSWORD_MIN_LENGTH && AUTH_PASSWORD_COMPLEXITY_RE.test(p);
}
