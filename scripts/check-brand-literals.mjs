/**
 * Fail CI if product brand literals appear in user-facing copy (ADR §7a).
 * Usage: node scripts/check-brand-literals.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const SCAN_DIRS = [
  'app',
  'components',
  'lib/translations',
  'lib/seo',
  'lib/analytics/export',
  'lib/admin',
  'emails',
  'docs',
]

/** Subdirs under docs/ skipped (historical archives, legal entity names). */
const DOCS_SKIP_SUBDIRS = new Set(['history', 'legal'])

const BRAND_RE = /\b(GoStayLo|Gostaylo)\b/

/** Lines that may contain legacy internal identifiers — not user copy. */
const ALLOW_LINE = [
  /gostaylo_/,
  /gostaylo-/,
  /gostaylo\./,
  /attachGostaylo/,
  /clearGostaylo/,
  /GostayloPushPolicy/,
  /\[GoStayLo Realtime\]/,
  /\/\*\*?\s*GoStayLo/,
  /\/\/\s*GoStayLo/,
  /pay\.mock\.gostaylo/,
  /gostaylo-push/,
  /gostaylo-smoke/,
  /@test\.gostaylo/,
  /gostaylo-fix-/,
  /gostaylo-frontend/,
  /gostaylo\.local/,
  /gostaylo\.ru/,
  /gostaylo\.com/,
  /gostaylo-production/,
  /GoStayLo -/,
  /GoStayLo —/,
  /GoStayLo PDP/,
  /GoStayLo Partner/,
  /UUID категории GoStayLo/,
  /Price Calculator for GoStayLo/,
  /GoStayLo translations/,
  // docs: historical stage changelog + internal component names
  /\*\*Stage \d+/,
  /Stage \d+\.\d+/,
  /GostayloListingCard/,
  /GostayloHomeContent/,
  /GostayloCalendar/,
  /GostayloSearchCalendar/,
  /SENDER_EMAIL=Gostaylo/,
  /Gostaylo footer/,
  /Gostaylo project/,
  /Gostaylo KG/,
  /Gostaylo Platform/,
  /Gostaylo Favorites/,
  /Gostaylo Telegram/,
  /Gostaylo Premium/,
  /Gostaylo is now/,
  /Gostaylo - Implementation/,
  /Gostaylo - Reviews/,
  /Gostaylo - Automated/,
  /Gostaylo Phase/,
  /Gostaylo v2/,
  /Implementation Summary/,
  /test_reports/,
  /Technical Manifesto \(Stage/,
]

function walk(dir, out = [], skipDocsSubdirs = false) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      if (skipDocsSubdirs && DOCS_SKIP_SUBDIRS.has(name)) continue
      walk(full, out, skipDocsSubdirs)
    } else if (/\.(js|jsx|ts|tsx|mdx|md)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const violations = []

for (const rel of SCAN_DIRS) {
  const abs = path.join(root, rel)
  for (const file of walk(abs, [], rel === 'docs')) {
    const fileRel = path.relative(root, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!BRAND_RE.test(line)) return
      if (ALLOW_LINE.some((re) => re.test(line))) return
      violations.push(`${fileRel}:${i + 1}: ${line.trim().slice(0, 120)}`)
    })
  }
}

if (violations.length) {
  console.error('Brand literal check failed (use {brand} + getSiteDisplayName()):\n')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('Brand literal check OK')
