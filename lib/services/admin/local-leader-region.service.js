import { LEADER_REGIONS, isValidRegionId } from '@/lib/config/leader-regions.js'

const REGION_KEY = 'local_leader_region_id'

async function recordAdminAuditSafe(payload) {
  const mod = await import('@/lib/services/audit/admin-audit')
  if (typeof mod?.recordAdminAudit === 'function') {
    return mod.recordAdminAudit(payload)
  }
  return { ok: false, error: 'AUDIT_HELPER_UNAVAILABLE' }
}

function cleanId(value) {
  return String(value || '').trim()
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function loadProfileForRegionEdit(supabase, userId) {
  const uid = cleanId(userId)
  if (!uid) throw new Error('USER_ID_REQUIRED')
  const { data, error } = await supabase.from('profiles').select('id, metadata').eq('id', uid).maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error('PROFILE_NOT_FOUND')
  return data
}

function withRegionMetadata(metadata, regionIdOrNull) {
  const next = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  if (regionIdOrNull == null) {
    delete next[REGION_KEY]
  } else {
    next[REGION_KEY] = regionIdOrNull
  }
  return next
}

export function listAvailableRegions() {
  return LEADER_REGIONS.map((row) => ({ id: row.id, i18nKey: row.i18nKey }))
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *  userId: string,
 *  regionId: string,
 *  adminId: string,
 *  adminRole?: string,
 *  requestId?: string | null,
 *  context?: object,
 *  idempotencyKey?: string | null,
 * }} params
 */
export async function assignRegion(supabase, params) {
  if (!supabase) throw new Error('SUPABASE_REQUIRED')
  const userId = cleanId(params?.userId)
  const regionId = cleanId(params?.regionId)
  const adminId = cleanId(params?.adminId)
  if (!userId) throw new Error('USER_ID_REQUIRED')
  if (!adminId) throw new Error('ADMIN_ID_REQUIRED')
  if (!isValidRegionId(regionId)) throw new Error('INVALID_REGION_ID')

  const profile = await loadProfileForRegionEdit(supabase, userId)
  const prev = cleanId(profile?.metadata?.[REGION_KEY]) || null
  const nextMetadata = withRegionMetadata(profile?.metadata, regionId)

  const { error: writeErr } = await supabase
    .from('profiles')
    .update({ metadata: nextMetadata })
    .eq('id', userId)
  if (writeErr) throw writeErr

  const auditFn = typeof params?.auditFn === 'function' ? params.auditFn : recordAdminAuditSafe
  await auditFn({
    actorId: adminId,
    actorRole: params?.adminRole || 'ADMIN',
    action: 'local_leader_region_assign',
    entityType: 'profile',
    entityId: userId,
    payload: {
      beforeRegionId: prev,
      afterRegionId: regionId,
      context: params?.context || {},
    },
    idempotencyKey: params?.idempotencyKey || null,
    requestId: params?.requestId || null,
  })

  return { ok: true, userId, regionId, previousRegionId: prev }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *  userId: string,
 *  adminId: string,
 *  adminRole?: string,
 *  requestId?: string | null,
 *  context?: object,
 *  idempotencyKey?: string | null,
 * }} params
 */
export async function clearRegion(supabase, params) {
  if (!supabase) throw new Error('SUPABASE_REQUIRED')
  const userId = cleanId(params?.userId)
  const adminId = cleanId(params?.adminId)
  if (!userId) throw new Error('USER_ID_REQUIRED')
  if (!adminId) throw new Error('ADMIN_ID_REQUIRED')

  const profile = await loadProfileForRegionEdit(supabase, userId)
  const prev = cleanId(profile?.metadata?.[REGION_KEY]) || null
  const nextMetadata = withRegionMetadata(profile?.metadata, null)

  const { error: writeErr } = await supabase
    .from('profiles')
    .update({ metadata: nextMetadata })
    .eq('id', userId)
  if (writeErr) throw writeErr

  const auditFn = typeof params?.auditFn === 'function' ? params.auditFn : recordAdminAuditSafe
  await auditFn({
    actorId: adminId,
    actorRole: params?.adminRole || 'ADMIN',
    action: 'local_leader_region_clear',
    entityType: 'profile',
    entityId: userId,
    payload: {
      beforeRegionId: prev,
      afterRegionId: null,
      context: params?.context || {},
    },
    idempotencyKey: params?.idempotencyKey || null,
    requestId: params?.requestId || null,
  })

  return { ok: true, userId, previousRegionId: prev }
}

