/**
 * Stage 108.1 — блокировка legacy auto-payout (D-01).
 * Prod и ручной режим казначейства → только PayoutBatchService + банк.
 */

import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'
import {
  isTreasuryManualModeFromEnv,
  loadTreasuryOpsSettings,
} from '@/lib/treasury/treasury-ops-config.js'
import {
  recordTreasuryOpsAlert,
  TREASURY_ALERT_TYPES,
} from '@/lib/treasury/treasury-monitoring-alerts.js'

const BLOCK_MESSAGE =
  'Legacy payout disabled. Use PayoutBatchService (admin FinTech pool) instead of processPayout.'

/**
 * @param {{ fn?: string, bookingId?: string, bookingCount?: number }} [context]
 */
export async function assertLegacyPayoutAllowed(context = {}) {
  if (String(process.env.ALLOW_LEGACY_PAYOUT || '').trim() === '1') {
    return { allowed: true, reason: 'ALLOW_LEGACY_PAYOUT=1' }
  }

  let manualMode = isTreasuryManualModeFromEnv()
  try {
    const ops = await loadTreasuryOpsSettings()
    if (typeof ops?.treasuryManualMode === 'boolean') {
      manualMode = ops.treasuryManualMode
    }
  } catch {
    /* settings optional */
  }

  const isProd = isProductionPaymentEnvironment()
  if (!manualMode && !isProd) {
    return { allowed: true, reason: 'dev_non_manual' }
  }

  const fn = context.fn || 'processPayout'
  const bookingId = context.bookingId ? String(context.bookingId) : null
  const bookingCount = Number(context.bookingCount) || 0

  console.error(
    `[LEGACY PAYOUT BLOCKED] ${fn}` +
      (bookingId ? ` booking=${bookingId}` : '') +
      (bookingCount > 0 ? ` count=${bookingCount}` : '') +
      ` manualMode=${manualMode} production=${isProd}`,
  )

  const detailParts = [
    `Функция: ${fn}`,
    bookingId ? `Бронь: ${bookingId}` : null,
    bookingCount > 0 ? `Броней в пакете: ${bookingCount}` : null,
    manualMode ? 'TREASURY_MANUAL_MODE: да' : null,
    isProd ? 'Окружение: production' : null,
    'Используйте пул выплат в FinTech-пульте (PayoutBatchService).',
  ].filter(Boolean)

  await recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.LEGACY_PAYOUT_BLOCKED,
    severity: 'critical',
    title: 'Заблокирована legacy-выплата',
    detail: detailParts.join(' · '),
    meta: { fn, bookingId, bookingCount, manualMode, production: isProd },
    telegramHtml: [
      '<b>⚠️ Legacy payout заблокирован</b>',
      escapeHtml(detailParts.join('\n')),
      '<i>Нужен пул в /admin/settings/finances, не processPayout.</i>',
    ].join('\n'),
  }).catch((e) => {
    console.error('[LEGACY PAYOUT BLOCKED] alert failed', e)
  })

  return {
    allowed: false,
    error: BLOCK_MESSAGE,
    blocked: true,
    manualMode,
    production: isProd,
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
