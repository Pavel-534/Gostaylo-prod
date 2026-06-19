/**
 * Stage 168.2 — security headers + CSP (nonce in production).
 */

import { SITE_IMAGE_HOSTS } from '@/lib/site-url.js'

/**
 * @param {{ nonce?: string | null, isDev?: boolean }} [opts]
 */
export function buildContentSecurityPolicy(opts = {}) {
  const isDev = opts.isDev ?? process.env.NODE_ENV !== 'production'
  const nonce = opts.nonce ? String(opts.nonce).trim() : ''
  const siteOrigins = SITE_IMAGE_HOSTS.map((h) => `https://${h}`).join(' ')

  const scriptParts = ["'self'"]
  if (nonce) {
    scriptParts.push(`'nonce-${nonce}'`, "'strict-dynamic'")
  }
  if (isDev) {
    scriptParts.push("'unsafe-eval'", "'unsafe-inline'")
  }
  scriptParts.push('https://static.cloudflareinsights.com', ...siteOrigins.split(/\s+/).filter(Boolean))

  return [
    "default-src 'self'",
    `script-src ${scriptParts.join(' ')}`,
    `style-src 'self' 'unsafe-inline' https://unpkg.com ${siteOrigins}`,
    "font-src 'self' data:",
    "img-src 'self' data: blob: https: https://unpkg.com",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/**
 * @param {import('next/server').NextResponse} response
 * @param {{ nonce?: string | null, isDev?: boolean }} [opts]
 */
export function applySecurityHeaders(response, opts = {}) {
  const isProd = process.env.NODE_ENV === 'production'

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)',
  )
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site')

  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(opts))
  return response
}
