/**
 * Partner booking detail fetch + unified order mapping (Stage 186.2b).
 */
import { buildPartnerUnifiedOrder } from '@/lib/partner/partner-unified-order'

export function mapPartnerBookingDetailResponse(data) {
  if (!data) return null
  return {
    ...data,
    _unified: buildPartnerUnifiedOrder(data),
  }
}

export async function fetchPartnerBookingDetailApi(bookingId, fetchImpl = fetch) {
  const res = await fetchImpl(`/api/v2/partner/bookings/${encodeURIComponent(bookingId)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok || json.status === 'error') {
    throw new Error(json.error || 'Failed to load booking')
  }
  return mapPartnerBookingDetailResponse(json.data)
}
