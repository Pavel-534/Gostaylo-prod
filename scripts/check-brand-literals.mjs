/**
 * Fail CI if product brand literals appear in user-facing copy (ADR §7a).
 * Usage: node scripts/check-brand-literals.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const SCAN_DIRS = ['app', 'components', 'lib/translations', 'lib/seo', 'lib/analytics/export', 'lib/admin', 'emails']

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
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(full, out)
    } else if (/\.(js|jsx|ts|tsx|mdx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const violations = []

for (const rel of SCAN_DIRS) {
  const abs = path.join(root, rel)
  for (const file of walk(abs)) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!BRAND_RE.test(line)) return
      if (ALLOW_LINE.some((re) => re.test(line))) return
      violations.push(`${path.relative(root, file)}:${i + 1}: ${line.trim().slice(0, 120)}`)
    })
  }
}

if (violations.length) {
  console.error('Brand literal check failed (use {brand} + getSiteDisplayName()):\n')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('Brand literal check OK')
