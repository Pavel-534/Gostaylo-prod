import { supabaseAdmin } from '@/lib/supabase'

const OPS_TABLE_MISSING = "Could not find the table 'public.ops_job_runs'"
const MAX_DB_ATTEMPTS = 4

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True for typical Supabase/PostgREST/network blips (ECONNRESET, fetch failed, 5xx hints). */
function isTransientDbError(err) {
  if (!err) return false
  const msg = String(err.message ?? err.details ?? err).toLowerCase()
  const causeCode = err.cause?.code != null ? String(err.cause.code).toLowerCase() : ''
  if (['econnreset', 'etimedout', 'epipe', 'econnrefused', 'enetunreach'].includes(causeCode)) return true
  if (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('socket closed') ||
    msg.includes('network error') ||
    msg.includes('tls connection') ||
    msg.includes('premature close')
  ) {
    return true
  }
  if (/\b502\b|\b503\b|\b504\b/.test(msg)) return true
  if (msg.includes('cloudflare') && msg.includes('error')) return true
  return false
}

/**
 * Runs an async Supabase op up to MAX_DB_ATTEMPTS times with exponential backoff on transient failures.
 * @param {() => Promise<{ data?: unknown, error?: unknown }>} fn
 */
async function withDbRetry(fn) {
  let last = { data: null, error: null }
  for (let attempt = 0; attempt < MAX_DB_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(200 * 2 ** (attempt - 1))
    }
    try {
      last = await fn()
      if (!last.error) return last
      if (!isTransientDbError(last.error)) return last
    } catch (e) {
      last = { data: null, error: e }
      if (!isTransientDbError(e)) break
    }
  }
  return last
}

export async function startOpsJobRun(jobName, initialStats = {}) {
  if (!supabaseAdmin || !jobName) return null
  try {
    const startedAt = new Date().toISOString()
    const { data, error } = await withDbRetry(() =>
      supabaseAdmin
        .from('ops_job_runs')
        .insert({
          job_name: String(jobName),
          status: 'running',
          started_at: startedAt,
          stats: initialStats && typeof initialStats === 'object' ? initialStats : {},
        })
        .select('id, started_at')
        .single()
    )
    if (error) {
      if (!String(error.message || '').includes(OPS_TABLE_MISSING)) {
        console.warn('[ops_job_runs] start insert:', error.message)
      }
      return null
    }
    return {
      id: data?.id ?? null,
      started_at: data?.started_at || startedAt,
    }
  } catch (e) {
    console.warn('[ops_job_runs] start error:', e?.message || e)
    return null
  }
}

export async function finishOpsJobRun(run, { status, stats = {}, errorMessage = null } = {}) {
  if (!supabaseAdmin || !run?.id) return
  const startedMs = new Date(run.started_at || Date.now()).getTime()
  const durationMs = Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : null
  const mergedStats = {
    ...(stats && typeof stats === 'object' ? stats : {}),
    ...(durationMs == null ? {} : { duration_ms: durationMs }),
  }
  try {
    const { error } = await withDbRetry(() =>
      supabaseAdmin
        .from('ops_job_runs')
        .update({
          status: status || 'success',
          finished_at: new Date().toISOString(),
          stats: mergedStats,
          error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
        })
        .eq('id', run.id)
    )
    if (error && !String(error.message || '').includes(OPS_TABLE_MISSING)) {
      console.warn('[ops_job_runs] finish update:', error.message)
    }
  } catch (e) {
    console.warn('[ops_job_runs] finish error:', e?.message || e)
  }
}
