/**
 * Fail CI if guest-facing copy uses «партнёр» / "the partner" instead of host SSOT (Stage 146.2).
 * Usage: node scripts/check-guest-terminology.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const SCAN_FILES = [
  'lib/translations/listings-public.js',
  'lib/translations/slices/profile-app-renter.js',
  'lib/translations/slices/order-flow.js',
]

const SCAN_DIRS = ['components/listing', 'components/orders']

/** Visible copy in string literals — not code identifiers. */
const BANNED = [
  /\bпартн[её]р/u,
  /\bпартнер/u,
  /\bthe partner\b/i,
  /\bmessage the partner\b/i,
  /\bcontact the partner\b/i,
  /合作伙伴/,
  /พาร์ทเนอร์/,
]

const ALLOW_LINE = [
  /\/\//,
  /\/\*/,
  /\*\//,
  /partnerId/,
  /onAskPartner/,
  /askPartner/,
  /showAskPartner/,
  /handleAskPartner/,
  /partner_id/,
  /partnerDashboard/,
  /partnerBookings/,
  /partnerNav/,
  /renterApplicationApproved/,
  /Partner portal/,
  /合作伙伴后台/,
  /partnerTrust_reliableHost/,
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules') continue
      walk(full, out)
    } else if (/\.(js|jsx|ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const violations = []

function scanFile(fileRel, text) {
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (ALLOW_LINE.some((re) => re.test(line))) return
    if (!/["'`]/.test(line)) return
    for (const re of BANNED) {
      if (re.test(line)) {
        violations.push(`${fileRel}:${i + 1}: ${line.trim().slice(0, 140)}`)
        break
      }
    }
  })
}

for (const rel of SCAN_FILES) {
  const abs = path.join(root, rel)
  if (fs.existsSync(abs)) scanFile(rel, fs.readFileSync(abs, 'utf8'))
}

for (const rel of SCAN_DIRS) {
  const abs = path.join(root, rel)
  for (const file of walk(abs)) {
    const fileRel = path.relative(root, file).replace(/\\/g, '/')
    scanFile(fileRel, fs.readFileSync(file, 'utf8'))
  }
}

if (violations.length) {
  console.error(
    'Guest terminology check failed (use {providerDative} + getUIText ctx listingCategorySlug):\n',
  )
  for (const v of violations) console.error(`  ${v}`)
  console.error('\nSSOT: lib/i18n/get-guest-provider-label.js')
  process.exit(1)
}

console.log('Guest terminology check OK')
