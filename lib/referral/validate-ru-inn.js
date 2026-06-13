/**
 * Stage 132.0 — shared RU bank field validation (browser + Node).
 */

export function digitsOnly(value) {
  return String(value || '').replace(/\s/g, '')
}

/**
 * @param {string | null | undefined} innRaw
 * @returns {boolean}
 */
export function validateRuInnChecksum(innRaw) {
  const inn = digitsOnly(innRaw)
  if (!/^\d{10}$/.test(inn) && !/^\d{12}$/.test(inn)) return false

  const modCheck = (coeffs) => {
    let sum = 0
    for (let i = 0; i < coeffs.length; i++) {
      sum += parseInt(inn[i], 10) * coeffs[i]
    }
    let check = sum % 11
    if (check === 10) check = 0
    return check
  }

  if (inn.length === 10) {
    const coeffs = [2, 4, 10, 3, 5, 9, 4, 6, 8]
    return modCheck(coeffs) === parseInt(inn[9], 10)
  }

  const coeffs11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  if (modCheck(coeffs11) !== parseInt(inn[10], 10)) return false
  const coeffs12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  return modCheck(coeffs12) === parseInt(inn[11], 10)
}

/**
 * @param {string | null | undefined} bikRaw
 * @returns {boolean}
 */
export function validateRuBik(bikRaw) {
  const bik = digitsOnly(bikRaw)
  return /^\d{9}$/.test(bik)
}

/**
 * @param {string | null | undefined} accountRaw
 * @returns {boolean}
 */
export function validateRuAccountNumber(accountRaw) {
  const account = digitsOnly(accountRaw)
  return /^\d{20}$/.test(account) || (/^\d{16,20}$/.test(account) && account.length >= 16)
}

/**
 * @param {string | null | undefined} innRaw
 * @returns {string | null} i18n key (stage1322_errInn*) or null if ok / empty
 */
export function validateRuInnField(innRaw) {
  const inn = digitsOnly(innRaw)
  if (!inn) return null
  if (!/^\d{10}$/.test(inn) && !/^\d{12}$/.test(inn)) {
    return 'stage1322_errInnLength'
  }
  if (!validateRuInnChecksum(inn)) return 'stage1322_errInnChecksum'
  return null
}

/**
 * @param {string | null | undefined} bikRaw
 * @returns {string | null} i18n key or null if ok / empty
 */
export function validateRuBikField(bikRaw) {
  const bik = digitsOnly(bikRaw)
  if (!bik) return null
  if (!validateRuBik(bik)) return 'stage1322_ruProfileErrBik'
  return null
}

/**
 * @param {string | null | undefined} accountRaw
 * @returns {string | null} i18n key or null if ok / empty
 */
export function validateRuAccountField(accountRaw) {
  const account = digitsOnly(accountRaw)
  if (!account) return null
  if (!validateRuAccountNumber(account)) return 'stage1322_ruProfileErrAccount'
  return null
}

export default {
  digitsOnly,
  validateRuInnChecksum,
  validateRuBik,
  validateRuAccountNumber,
  validateRuInnField,
  validateRuBikField,
  validateRuAccountField,
}
