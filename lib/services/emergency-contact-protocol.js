/**
 * Stage 23.0 — Emergency contact SMS channel (stub).
 * Real provider wiring (Twilio, etc.) belongs here later.
 */

/**
 * @param {{ partnerPhone?: string | null }} params
 */
export function sendEmergencySMS({ partnerPhone }) {
  const phone = partnerPhone != null ? String(partnerPhone) : 'n/a'
  console.log(`DEBUG: SMS Escalation triggered for [${phone}]`)
}
