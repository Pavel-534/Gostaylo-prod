/**
 * Stage 153.1 — append-only admin audit + HTTP idempotency helpers.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { getCorrelationId } from '@/lib/request-correlation.js'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'

const FINANCIAL_DISPUTE_ACTIONS = new Set(['force_refund', 'split', 'freeze_payment', 'close_dispute'])

/**
 * @param {import('next/server').NextRequest | Request} request
 * @returns {string | null}
 */
export function readIdempotencyKeyFromRequest(request) {
  const raw = request?.headers?.get?.('Idempotency-Key') || request?.headers?.get?.('idempotency-key')
  const key = String(raw || '').trim()
  if (!key || key.length > 200) return null
  return key
}

/**
 * @param {string} idempotencyKey
 * @returns {Promise<object | null>}
 */
export async function findAdminAuditByIdempotencyKey(idempotencyKey) {
  const key = String(idempotencyKey || '').trim()
  if (!key || !supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('id, action, entity_type, entity_id, created_at, payload_json')
    .eq('idempotency_key', key)
    .maybeSingle()
  if (error) {
    console.error('[admin_audit_logs] idempotency lookup failed:', error.message)
    return null
  }
  return data || null
}

/**
 * Duplicate operational request — return 200 skipped without re-running ledger.
 * @param {string} idempotencyKey
 */
export async function buildIdempotentSkippedResponse(idempotencyKey) {
  const prior = await findAdminAuditByIdempotencyKey(idempotencyKey)
  return NextResponse.json({
    success: true,
    skipped: true,
    msg: 'Duplicate operational request intercepted',
    prior: prior
      ? {
          id: prior.id,
          action: prior.action,
          entityType: prior.entity_type,
          entityId: prior.entity_id,
          createdAt: prior.created_at,
        }
      : null,
  })
}

/**
 * @param {string} idempotencyKey
 * @returns {Promise<NextResponse | null>}
 */
export async function interceptDuplicateIdempotencyKey(idempotencyKey) {
  const key = String(idempotencyKey || '').trim()
  if (!key) return null
  const prior = await findAdminAuditByIdempotencyKey(key)
  if (!prior) return null
  return buildIdempotentSkippedResponse(key)
}

/**
 * @param {string} action
 */
export function isDisputeFinancialAction(action) {
  return FINANCIAL_DISPUTE_ACTIONS.has(String(action || '').trim().toLowerCase())
}

/**
 * Financial levers — ADMIN only (MODERATOR may read / take_in_review).
 * @param {{ profile?: { role?: string } | null }} access
 * @returns {NextResponse | null}
 */
export function denyUnlessAdminFinancialRole(access) {
  const role = normalizeAdminRole(access?.profile?.role)
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error_code: AuthErrorCode.AUTH_ACCESS_FORBIDDEN },
      { status: 403 },
    )
  }
  return null
}

/**
 * @param {{
 *   actorId?: string | null,
 *   actorRole?: string | null,
 *   action: string,
 *   entityType: string,
 *   entityId: string,
 *   reason?: string | null,
 *   payload?: object | null,
 *   idempotencyKey?: string | null,
 *   requestId?: string | null,
 * }} args
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function recordAdminAudit(args) {
  if (!supabaseAdmin) {
    console.error('[admin_audit_logs] supabaseAdmin unavailable')
    recordCriticalSignal('ADMIN_AUDIT_WRITE_FAILED', {
      threshold: 1,
      windowMs: 60 * 1000,
      detailLines: ['reason=no_db', `action=${args?.action || '—'}`],
      persistDetail: { action: args?.action, entityType: args?.entityType, entityId: args?.entityId },
    })
    return { ok: false, error: 'no_db' }
  }

  const row = {
    actor_id: args.actorId ? String(args.actorId) : null,
    actor_role: String(args.actorRole || 'UNKNOWN').slice(0, 64),
    action: String(args.action || '').slice(0, 128),
    entity_type: String(args.entityType || '').slice(0, 64),
    entity_id: String(args.entityId || '').slice(0, 256),
    reason: args.reason ? String(args.reason).slice(0, 2000) : null,
    payload_json: args.payload && typeof args.payload === 'object' ? args.payload : {},
    idempotency_key: args.idempotencyKey ? String(args.idempotencyKey).slice(0, 200) : null,
    request_id: args.requestId ? String(args.requestId).slice(0, 128) : getCorrelationId() || null,
  }

  if (!row.action || !row.entity_type || !row.entity_id) {
    return { ok: false, error: 'invalid_row' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('admin_audit_logs')
      .insert(row)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === '23505' && row.idempotency_key) {
        const prior = await findAdminAuditByIdempotencyKey(row.idempotency_key)
        return { ok: true, id: prior?.id, duplicate: true }
      }
      throw error
    }

    return { ok: true, id: data?.id }
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[admin_audit_logs] insert failed:', msg)
    recordCriticalSignal('ADMIN_AUDIT_WRITE_FAILED', {
      threshold: 1,
      windowMs: 60 * 1000,
      detailLines: [
        `action=${row.action}`,
        `entity=${row.entity_type}:${row.entity_id}`,
        `error=${msg.slice(0, 500)}`,
      ],
      persistDetail: {
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actorId: row.actor_id,
      },
    })
    return { ok: false, error: msg }
  }
}
