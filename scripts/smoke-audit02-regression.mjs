#!/usr/bin/env node
/**
 * AUDIT_02 critical-path regression smoke.
 *
 *   npm run smoke:audit02
 *   npm run smoke:audit02 -- --skip-cleanup
 *
 * Manual checklist: docs/runbooks/AUDIT_02_REGRESSION_E2E.md
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
nextEnv.loadEnvConfig(root)

const argv = process.argv.slice(2)
const skipCleanup = argv.includes('--skip-cleanup')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

async function main() {
  console.log('')
  console.log(`${BOLD}AUDIT_02 regression smoke${RESET}`)
  console.log(`${DIM}${new Date().toISOString()}${RESET}`)
  console.log('')

  const { runAudit02RegressionSmoke } = await import('../lib/smoke/audit02-regression-smoke.js')
  const result = await runAudit02RegressionSmoke({ skipCleanup })
  const steps = result?.steps || []
  let passed = 0
  for (const s of steps) {
    const mark = s.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    console.log(`${mark} ${s.name}`)
    console.log(`  ${DIM}${s.detail}${RESET}${s.durationMs != null ? ` ${CYAN}(${s.durationMs}ms)${RESET}` : ''}`)
    if (s.ok) passed += 1
  }
  console.log('')
  console.log(
    result?.ok
      ? `${GREEN}PASS${RESET} ${passed}/${steps.length}`
      : `${RED}FAIL${RESET} ${passed}/${steps.length}`,
  )
  if (result?.context) {
    console.log(`${DIM}context:${RESET}`, JSON.stringify(result.context, null, 0).slice(0, 500))
  }
  process.exit(result?.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
