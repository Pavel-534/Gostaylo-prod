/**
 * Единственное место, где читаются env-строки для аварийных FX/комиссии без данных в БД/API.
 * В `currency.service.js` не хранить числовые литералы fallback — только вызовы отсюда + `system_settings`.
 */

function parseEnvPositiveFloat(name) {
  const v = process.env[name]
  if (v == null || v === '') return null
  const n = parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** THB за 1 USDT из env (FALLBACK_THB_PER_USDT). */
export function lastResortThbPerUsdtFromEnv() {
  return parseEnvPositiveFloat('FALLBACK_THB_PER_USDT')
}

/** Процент комиссии из env (DEFAULT_COMMISSION_PERCENT), 0–100. */
export function lastResortCommissionPercentFromEnv() {
  const n = parseEnvPositiveFloat('DEFAULT_COMMISSION_PERCENT')
  if (n == null) return null
  return n <= 100 ? n : null
}

/**
 * Опционально: `system_settings.general.value.fallbackThbPerUsdt` (число).
 * @param {unknown} supabaseAdmin — service-role Supabase client или null
 * @returns {Promise<number|null>}
 */
export async function lastResortThbPerUsdtFromGeneralSettings(supabaseAdmin) {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
  if (error || !data?.value || typeof data.value !== 'object') return null
  const raw = data.value.fallbackThbPerUsdt ?? data.value.emergencyThbPerUsdt
  if (raw == null || raw === '') return null
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Множитель к THB↔USDT для счетов в чате (надбавка к курсу). Только env.
 * @returns {number|null}
 */
export function lastResortChatInvoiceRateMultiplierFromEnv() {
  const n = parseEnvPositiveFloat('CHAT_INVOICE_RATE_MULTIPLIER')
  if (n == null) return null
  return n >= 1 && n <= 1.5 ? n : null
}

/** Платформенный дефолт, если нет ни `general.chatInvoiceRateMultiplier`, ни env (см. ADR). */
export function platformDefaultChatInvoiceRateMultiplier() {
  return 1.02
}
