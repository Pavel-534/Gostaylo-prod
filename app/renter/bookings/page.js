import { redirect } from 'next/navigation'

/**
 * Stage 138.3 — канонический список гостевых бронирований: /my-bookings.
 * Сохраняем query (например ?booking=) для deep link из push / email / Telegram.
 */
export default function RenterBookingsRedirectPage({ searchParams }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v))
    } else if (value != null && value !== '') {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  redirect(qs ? `/my-bookings?${qs}` : '/my-bookings')
}
