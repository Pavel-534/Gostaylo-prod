#!/usr/bin/env node
/**
 * ADR-100 — App Shell inset guard (Wave 5 / Stage 170.7).
 * Scans app/ + components/ for legacy hardcoded chrome offsets.
 * Usage: node scripts/check-shell-insets.js
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const SCAN_DIRS = ['app', 'components']

/** Surfaces with their own shell contract (chat, admin tables, legacy bars). */
const SKIP_PATH_RE = [
  /^app\/messages\//,
  /^components\/chat\//,
  /^components\/app-header\/ChatTopBar\.jsx$/,
  /^components\/sticky-chat-header\.jsx$/,
  /^components\/calendar\//,
  /^components\/admin\/finances\//,
  /^components\/role-bar\.js$/,
]

const RULES = [
  {
    id: 'bottom-tabbar-hardcode',
    re: /\bbottom-\[(?:80px|5rem)\]\b|\bpb-24\b/,
    hint: '.app-fixed-above-bottom-nav или .pb-bottom-nav',
  },
  {
    id: 'sticky-below-header-hardcode',
    re: /\bsticky\s+top-(?:0|12|16)\b/,
    hint: '.app-sticky-below-header',
  },
]

const ALLOW_LINE_RE = [
  /shell-inset-ok/,
  /\bDialogHeader\b/,
  /\bthead\b/,
  /app-sticky-below-header/,
  /app-fixed-above-bottom-nav/,
  /app-shell-main/,
  /app-workspace-sidebar/,
]

const WARN =
  'Внимание! Нарушен контракт SSOT (ADR-100). Используйте системные утилиты .app-sticky-below-header или .app-fixed-above-bottom-nav'

function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/')
}

function shouldSkipFile(relPosix) {
  return SKIP_PATH_RE.some((re) => re.test(relPosix))
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(full, out)
    } else if (/\.(js|jsx|ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const violations = []

for (const relDir of SCAN_DIRS) {
  const absDir = path.join(root, relDir)
  for (const file of walk(absDir)) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    if (shouldSkipFile(rel)) continue

    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (isCommentLine(line)) return
      if (ALLOW_LINE_RE.some((re) => re.test(line))) return

      for (const rule of RULES) {
        if (!rule.re.test(line)) continue
        violations.push({
          file: rel,
          line: index + 1,
          rule: rule.id,
          hint: rule.hint,
          excerpt: line.trim().slice(0, 140),
        })
      }
    })
  }
}

if (violations.length) {
  console.error(`${WARN}\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] → ${v.hint}`)
    console.error(`    ${v.excerpt}`)
  }
  console.error(`\n${violations.length} violation(s). Fix or add shell-inset-ok on the line with a documented exception.`)
  process.exit(1)
}

console.log('App Shell inset check OK (ADR-100)')
