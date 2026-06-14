/**
 * Stage 112.3 — iCal parse/sync (calendar-sync-manager).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function postIcalSync(body) {
  const res = await fetch('/api/ical/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, json, status: res.status }
}

/** Stage 140.4 — force-sync iCal for all listings owned by the current partner. */
export async function postIcalSyncPartnerAll() {
  return postIcalSync({ action: 'sync-partner-all' })
}
