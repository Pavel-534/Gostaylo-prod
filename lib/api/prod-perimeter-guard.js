/**
 * Stage 111.1b / 111.1c — dev-only maintenance & test routes; 404 on production.
 */

import { NextResponse } from 'next/server'
import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'

/** True on Vercel production or NODE_ENV=production (see production-env.js). */
export function isProductionDeployment() {
  return isProductionPaymentEnvironment()
}

/** @returns {NextResponse | null} 404 JSON when route must not exist on prod */
export function prodPerimeterBlockedResponse() {
  if (!isProductionDeployment()) return null
  return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 })
}

const SUPABASE_URL_IN_TEXT =
  /https?:\/\/[^\s"'<>]*supabase\.co[^\s"'<>]*/gi

/**
 * Strip Supabase / project URLs from error payloads (dev/staging responses).
 * @param {unknown} message
 * @returns {string}
 */
export function sanitizeExternalErrorMessage(message) {
  if (message == null || message === '') return 'Request failed'
  let text = String(message)
  text = text.replace(SUPABASE_URL_IN_TEXT, '[redacted]')
  const configured = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  if (configured) {
    try {
      const host = new URL(configured).host
      if (host) text = text.split(host).join('[redacted]')
    } catch {
      /* ignore */
    }
  }
  return text
}
