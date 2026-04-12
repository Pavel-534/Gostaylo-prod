/**
 * Инкремент contact_leak_strikes в profiles (RPC).
 */

const hdr = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
})

/**
 * @param {string} userId
 * @returns {Promise<boolean>} true if RPC succeeded
 */
export async function incrementContactLeakStrikes(userId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey || !userId) return false
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/increment_contact_leak_strikes`, {
      method: 'POST',
      headers: hdr(serviceKey),
      body: JSON.stringify({ p_user_id: String(userId) }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[contact-leak-strikes] RPC failed', res.status, t.slice(0, 200))
      return false
    }
    return true
  } catch (e) {
    console.warn('[contact-leak-strikes]', e?.message || e)
    return false
  }
}
