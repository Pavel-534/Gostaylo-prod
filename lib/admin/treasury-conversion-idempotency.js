/**
 * AUDIT_MONEY_FLOW_04 P2 — stable treasury conversion idempotency keys.
 * Avoids Date.now()+random keys that never dedupe retries / double-submit.
 */

import { createHash } from 'crypto'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {{
 *   clientKey?: string | null
 *   externalTxReference?: string | null
 *   operationType: string
 *   fromCurrency: string
 *   toCurrency: string
 *   amountFrom: number
 *   amountTo: number
 *   rateUsed: number
 *   conversionFeeThb: number
 *   conversionLossThb: number
 *   createdBy?: string | null
 *   dayUtc?: string | null
 * }} input
 * @returns {{ idempotencyKey: string, conversionId: string, journalId: string, source: string }}
 */
export function buildTreasuryConversionIds(input) {
  const clientKey = String(input.clientKey || '').trim()
  if (clientKey) {
    const safe = clientKey.slice(0, 128).replace(/[^a-zA-Z0-9._:-]/g, '_')
    const idempotencyKey = `treasury_conversion:client:${safe}`
    const short = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)
    return {
      idempotencyKey,
      conversionId: `cnv-${short}`,
      journalId: `lj-fx-conv-${short}`,
      source: 'client',
    }
  }

  const ext = String(input.externalTxReference || '').trim()
  if (ext) {
    const safe = ext.slice(0, 200).replace(/[^a-zA-Z0-9._:-]/g, '_')
    const idempotencyKey = `treasury_conversion:ext:${safe}`
    const short = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)
    return {
      idempotencyKey,
      conversionId: `cnv-${short}`,
      journalId: `lj-fx-conv-${short}`,
      source: 'external_tx',
    }
  }

  // Same-day content fingerprint: dedupes accidental double-submit; next UTC day can repeat.
  const dayUtc = String(input.dayUtc || new Date().toISOString().slice(0, 10))
  const payload = [
    dayUtc,
    String(input.operationType || '').toUpperCase(),
    String(input.fromCurrency || '').toUpperCase(),
    String(input.toCurrency || '').toUpperCase(),
    round2(input.amountFrom),
    round2(input.amountTo),
    Number(input.rateUsed),
    round2(input.conversionFeeThb),
    round2(input.conversionLossThb),
    String(input.createdBy || ''),
  ].join('|')
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 32)
  const idempotencyKey = `treasury_conversion:fp:${dayUtc}:${hash}`
  const short = hash.slice(0, 16)
  return {
    idempotencyKey,
    conversionId: `cnv-${short}`,
    journalId: `lj-fx-conv-${short}`,
    source: 'fingerprint',
  }
}
