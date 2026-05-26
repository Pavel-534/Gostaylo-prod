/**
 * Режим контактной безопасности в чате (сервер).
 * ENV: CONTACT_SAFETY_MODE = ADVISORY | REDACT | BLOCK
 *
 * Stage 116.1 rollback: по умолчанию везде **ADVISORY** (распознавание + предупреждение + strikes,
 * без автоматического скрытия контактов). REDACT/BLOCK — только при явном env.
 */

import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'

export const CONTACT_SAFETY_MODES = ['ADVISORY', 'REDACT', 'BLOCK']

/** Явный env override; без env — ADVISORY (включая production). */
export function resolveContactSafetyModeFromEnv() {
  const rawEnv = String(process.env.CONTACT_SAFETY_MODE || '').trim().toUpperCase()
  if (CONTACT_SAFETY_MODES.includes(rawEnv)) return rawEnv
  void isProductionPaymentEnvironment()
  return 'ADVISORY'
}

/**
 * @returns {'ADVISORY' | 'REDACT' | 'BLOCK'}
 */
export function getContactSafetyMode() {
  return resolveContactSafetyModeFromEnv()
}

/**
 * Маскировать контакты при чтении/записи только в REDACT/BLOCK.
 * @returns {boolean}
 */
export function shouldMaskContactsOnRead() {
  const mode = getContactSafetyMode()
  return mode === 'REDACT' || mode === 'BLOCK'
}

/** @returns {boolean} */
export function shouldMaskContactsOnWrite() {
  return getContactSafetyMode() === 'REDACT'
}
