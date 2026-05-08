import {
  resolveSilentForPushDelivery,
  isWebSurface,
  isWebActiveRecently,
} from '@/lib/services/push/push-policy.js'

export { resolveSilentForPushDelivery, isWebSurface, isWebActiveRecently }

export function pickRecipientTimezone(tokenRows) {
  const rows = Array.isArray(tokenRows) ? tokenRows : []
  for (const r of rows) {
    const z = r?.device_info?.timezone
    if (typeof z === 'string' && z.trim().length > 2) return z.trim()
  }
  return 'UTC'
}
