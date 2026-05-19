/**
 * Stage 106.1 — optional IP allowlist for payment webhooks (YooKassa).
 */

import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'

function ipv4ToInt(ip) {
  const parts = String(ip).trim().split('.').map((x) => parseInt(x, 10))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function matchCidr(ip, cidr) {
  const [base, bitsStr] = String(cidr).split('/')
  const bits = parseInt(bitsStr, 10)
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt == null || baseInt == null) return false
  if (bits === 0) return true
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

/**
 * @param {Request} request
 */
export function getWebhookClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return String(fwd).split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return String(real).trim()
  return ''
}

/**
 * @param {string} ip
 * @param {string} entry
 */
function ipMatchesEntry(ip, entry) {
  const e = String(entry || '').trim()
  if (!e || !ip) return false
  if (e.includes('/')) return matchCidr(ip, e)
  return ip === e
}

/**
 * Default YooKassa notification subnets (override via YOOKASSA_WEBHOOK_IP_ALLOWLIST).
 * @see https://yookassa.ru/developers/using-api/webhooks
 */
const DEFAULT_YOOKASSA_CIDRS = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
]

/**
 * @param {{ adapterKey: string, request: Request }} params
 */
export function verifyPaymentWebhookIp({ adapterKey, request }) {
  const provider = String(adapterKey || '').toUpperCase()
  if (provider !== 'MIR_RU') {
    return { ok: true, skipped: true }
  }

  const enforce =
    String(process.env.YOOKASSA_WEBHOOK_ENFORCE_IP || '').trim() === '1' ||
    (isProductionPaymentEnvironment() &&
      String(process.env.YOOKASSA_WEBHOOK_ENFORCE_IP || '').trim() !== '0')

  if (!enforce) {
    return { ok: true, skipped: true, reason: 'ip_check_disabled' }
  }

  const ip = getWebhookClientIp(request)
  if (!ip) {
    return { ok: false, error: 'missing_client_ip' }
  }

  const rawList = String(process.env.YOOKASSA_WEBHOOK_IP_ALLOWLIST || '').trim()
  const entries = rawList
    ? rawList.split(/[,\s]+/).filter(Boolean)
    : DEFAULT_YOOKASSA_CIDRS

  for (const entry of entries) {
    if (entry.includes(':')) {
      if (ip === entry || ip.toLowerCase() === entry.toLowerCase()) return { ok: true, ip }
      continue
    }
    if (ipMatchesEntry(ip, entry)) return { ok: true, ip }
  }

  return { ok: false, error: 'ip_not_allowlisted', ip }
}
