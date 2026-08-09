import { describe, expect, it } from 'vitest'
import {
  PARTNER_RESPONSE_SLA_HOURS,
  formatPartnerResponseDeadlineLabel,
  resolvePartnerResponseExpiresAtIso,
} from '../lib/booking/partner-response-sla.js'

describe('partner-response-sla', () => {
  it('exports 24h SLA', () => {
    expect(PARTNER_RESPONSE_SLA_HOURS).toBe(24)
  })

  it('resolves expires_at = created_at + 24h', () => {
    const created = '2026-08-09T10:00:00.000Z'
    const ends = resolvePartnerResponseExpiresAtIso(created)
    expect(ends).toBe('2026-08-10T10:00:00.000Z')
  })

  it('returns null for missing created_at', () => {
    expect(resolvePartnerResponseExpiresAtIso(null)).toBeNull()
    expect(resolvePartnerResponseExpiresAtIso('')).toBeNull()
  })

  it('formats a short deadline label', () => {
    const label = formatPartnerResponseDeadlineLabel('2026-08-10T10:00:00.000Z', 'en')
    expect(label).toBeTruthy()
    expect(String(label)).toMatch(/10/)
  })
})
