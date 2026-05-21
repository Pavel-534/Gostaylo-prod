/**
 * Stage 110.8 — клиентский SSOT для renter profile API.
 */

export async function fetchPartnerApplicationStatus() {
  const res = await fetch('/api/v2/partner/application-status', { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export async function submitPartnerApplication(payload) {
  const res = await fetch('/api/v2/partner/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.success !== false, data }
}

export async function patchPartnerApplicationKyc(verificationDocUrl) {
  const res = await fetch('/api/v2/partner/applications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ verificationDocUrl }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.success !== false, data }
}
