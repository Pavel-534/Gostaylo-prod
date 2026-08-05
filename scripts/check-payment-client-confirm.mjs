/**
 * Fail build / CI if PAYMENT_ALLOW_CLIENT_CONFIRM is enabled for production.
 * Stage 200.42 — C3.
 *
 * Scans committed env files and process.env (Vercel injects env at build).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const DANGER = 'PAYMENT_ALLOW_CLIENT_CONFIRM'
const ENV_FILES = [
  '.env.production',
  '.env.production.local',
  '.env.prod',
  '.env',
]

function isEnabledValue(raw) {
  return String(raw || '').trim() === '1'
}

function scanEnvFile(relPath) {
  const full = path.join(root, relPath)
  if (!fs.existsSync(full)) return null
  const text = fs.readFileSync(full, 'utf8')
  const re = new RegExp(`^\\s*${DANGER}\\s*=\\s*(.+)$`, 'im')
  const m = text.match(re)
  if (!m) return null
  const val = m[1].trim().replace(/^["']|["']$/g, '')
  return isEnabledValue(val) ? relPath : null
}

const badFiles = ENV_FILES.map(scanEnvFile).filter(Boolean)
if (badFiles.length) {
  console.error(
    `[check:payment-client-confirm] CRITICAL: ${DANGER}=1 found in: ${badFiles.join(', ')}`,
  )
  process.exit(1)
}

const isProdBuild =
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

if (isProdBuild && isEnabledValue(process.env.PAYMENT_ALLOW_CLIENT_CONFIRM)) {
  console.error(
    `[check:payment-client-confirm] CRITICAL: ${DANGER}=1 is set in the build environment (production). Remove it from Vercel/env.`,
  )
  process.exit(1)
}

console.log('[check:payment-client-confirm] ok')
