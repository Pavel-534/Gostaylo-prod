/** Stage 109.0 — SSOT для Admin FinTech пульта (форматирование, тарифы, симулятор). */

export const FINTECH_MINT = '#0D9488'
export const FINTECH_NAVY = '#0F172A'

export const emptyPricingProfile = {
  id: '',
  name: '',
  guest_fee_pct: 15,
  host_fee_pct: 0,
  fx_markup_pct: 3,
  ru_agent_share_pct: 7,
  kr_service_share_pct: 8,
  insurance_fund_pct: 0,
  tax_rate_pct: 0,
  is_active: true,
}

export function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function currentMonthRange() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export function feeSplitValid(p) {
  const g = Number(p.guest_fee_pct)
  const ru = Number(p.ru_agent_share_pct)
  const kr = Number(p.kr_service_share_pct)
  return Number.isFinite(g) && Number.isFinite(ru) && Number.isFinite(kr) && Math.abs(ru + kr - g) < 0.01
}
