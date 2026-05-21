/**
 * Stage 112.3 — публичные referral API (профиль, лидерборд).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchReferralLeaderboard() {
  const res = await fetch('/api/v2/referral/leaderboard', {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, data: json.data ?? null, json, status: res.status }
}

export async function fetchReferralActivity(params) {
  const qs = params instanceof URLSearchParams ? params : new URLSearchParams(params)
  const res = await fetch(`/api/v2/referral/activity?${qs}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, data: json.data ?? null, json, status: res.status }
}
