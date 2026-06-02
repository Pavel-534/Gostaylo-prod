/**
 * Stage 124.19 — in-process financial smoke: session for payment route handlers.
 * Active only when process.env.SMOKE_FINANCIAL_RUN === '1' (never on production deploy by default).
 */

let overrideUserId = null

export function setSmokeFinancialSessionUserId(userId) {
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    throw new Error('Smoke session override requires SMOKE_FINANCIAL_RUN=1')
  }
  overrideUserId = userId ? String(userId) : null
}

export function getSmokeFinancialSessionUserId() {
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') return null
  return overrideUserId
}

export function clearSmokeFinancialSessionUserId() {
  overrideUserId = null
}
