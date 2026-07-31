/**
 * Concierge settle single-flight (Stage 201.02 / 201.03).
 * SSOT: Postgres RPC try_claim / refresh / release_payout_batch_settle_lock (metadata CAS + TTL).
 * Ledger settle keys remain independently idempotent.
 *
 * Exit paths:
 * - return / throw → `finally` releases by token
 * - process kill / OOM → lock expires after TTL (reclaim); no separate lock table rows
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * Default lock TTL (seconds).
 * Settle wall-clock: ledger/item loop + partner PDF acts — typically < 3–5 min for mid pools;
 * Vercel/serverless route caps often 60–300s (up to ~800s on higher plans).
 * 1800s headroom + heartbeat refresh keeps long PDF batches from being stolen.
 */
export const PAYOUT_BATCH_SETTLE_LOCK_TTL_SEC = 1800

/** Refresh lock timestamp at least this often during settle (ms). */
export const PAYOUT_BATCH_SETTLE_LOCK_HEARTBEAT_MS = 45_000

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

/**
 * @param {string} batchId
 * @param {{ owner?: string | null, ttlSeconds?: number }} [opts]
 */
export async function tryClaimPayoutBatchSettleLock(batchId, opts = {}) {
  const id = String(batchId || '').trim()
  if (!id) return { claimed: false, reason: 'BATCH_ID_REQUIRED' }
  if (!supabaseAdmin) return { claimed: false, reason: 'no_db', error: 'Database not configured' }

  const ttl = Number(opts.ttlSeconds)
  const { data, error } = await supabaseAdmin.rpc('try_claim_payout_batch_settle_lock', {
    p_batch_id: id,
    p_owner: opts.owner != null ? String(opts.owner) : null,
    p_ttl_seconds: Number.isFinite(ttl) && ttl > 0 ? Math.trunc(ttl) : PAYOUT_BATCH_SETTLE_LOCK_TTL_SEC,
  })

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('does not exist') || error.code === '42883') {
      return {
        claimed: false,
        reason: 'settle_lock_unavailable',
        error: 'Apply migrations stage201_02 (+ stage201_03 refresh)',
      }
    }
    return { claimed: false, reason: 'lock_rpc_failed', error: msg }
  }

  const row = firstRow(data)
  if (!row) return { claimed: false, reason: 'lock_rpc_empty' }

  return {
    claimed: row.claimed === true,
    reason: String(row.reason || ''),
    status: row.batch_status != null ? String(row.batch_status) : null,
    settleInProgressAt: row.settle_in_progress_at || null,
    settleLockOwner: row.settle_lock_owner != null ? String(row.settle_lock_owner) : null,
    settleLockToken: row.settle_lock_token != null ? String(row.settle_lock_token) : null,
  }
}

/**
 * Heartbeat — bump settle_in_progress_at so TTL does not reclaim mid-settle.
 * @param {string} batchId
 * @param {string | null | undefined} token
 */
export async function refreshPayoutBatchSettleLock(batchId, token = null) {
  const id = String(batchId || '').trim()
  const tok = token != null ? String(token).trim() : ''
  if (!id || !tok || !supabaseAdmin) return { refreshed: false, reason: 'skip' }

  const { data, error } = await supabaseAdmin.rpc('refresh_payout_batch_settle_lock', {
    p_batch_id: id,
    p_token: tok,
  })

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('does not exist') || error.code === '42883') {
      return { refreshed: false, reason: 'RPC_MISSING' }
    }
    console.warn('[PayoutBatch] refresh settle lock', id, msg)
    return { refreshed: false, reason: msg }
  }

  const row = firstRow(data)
  return {
    refreshed: row?.refreshed === true,
    reason: String(row?.reason || ''),
    settleInProgressAt: row?.settle_in_progress_at || null,
  }
}

/**
 * @param {string} batchId
 * @param {string | null | undefined} token
 */
export async function releasePayoutBatchSettleLock(batchId, token = null) {
  const id = String(batchId || '').trim()
  if (!id || !supabaseAdmin) return { released: false, reason: 'skip' }

  if (token == null || String(token).trim() === '') {
    return { released: true, reason: 'no_token' }
  }

  const { data, error } = await supabaseAdmin.rpc('release_payout_batch_settle_lock', {
    p_batch_id: id,
    p_token: String(token),
  })

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('does not exist') || error.code === '42883') {
      return { released: true, reason: 'RPC_MISSING_FALLBACK' }
    }
    console.error('[PayoutBatch] release settle lock', id, msg)
    return { released: false, reason: msg }
  }

  const row = firstRow(data)
  return {
    released: row?.released === true,
    reason: String(row?.reason || ''),
  }
}

/**
 * @param {Record<string, unknown>} meta
 * @param {{ settleInProgressAt?: string | null, settleLockOwner?: string | null, settleLockToken?: string | null }} lock
 */
export function withSettleLockMeta(meta, lock) {
  const base = meta && typeof meta === 'object' ? { ...meta } : {}
  if (!lock?.settleLockToken) return base
  return {
    ...base,
    settle_in_progress_at: lock.settleInProgressAt || base.settle_in_progress_at || new Date().toISOString(),
    settle_lock_owner: lock.settleLockOwner ?? base.settle_lock_owner ?? '',
    settle_lock_token: lock.settleLockToken,
  }
}

/**
 * Call inside settle loops; refreshes at most every HEARTBEAT_MS.
 * @param {{ batchId: string, token?: string | null, lastBeatAt: { ms: number }, lock?: object }} ctx
 */
export async function maybeHeartbeatSettleLock(ctx) {
  const now = Date.now()
  if (!ctx?.lastBeatAt || now - ctx.lastBeatAt.ms < PAYOUT_BATCH_SETTLE_LOCK_HEARTBEAT_MS) {
    return
  }
  ctx.lastBeatAt.ms = now
  const r = await refreshPayoutBatchSettleLock(ctx.batchId, ctx.token)
  if (r.refreshed && ctx.lock && r.settleInProgressAt) {
    ctx.lock.settleInProgressAt = r.settleInProgressAt
  }
}
