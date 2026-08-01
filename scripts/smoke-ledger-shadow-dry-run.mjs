#!/usr/bin/env node
/**
 * ADR-203 Phase 1 — shadow ledger financial dry run (FannRent via env).
 *
 *   npm run smoke:ledger-shadow-dry-run
 *   npm run smoke:ledger-shadow-dry-run -- --skip-payout
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
nextEnv.loadEnvConfig(root)

const argv = process.argv.slice(2)
const skipPayout = argv.includes('--skip-payout')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

async function loadRunner() {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { '@': root },
  })
  const mod = await jiti.import('../lib/smoke/ledger-shadow-dry-run-smoke.js')
  return mod.runLedgerShadowDryRun || mod.default?.runLedgerShadowDryRun
}

async function main() {
  console.log('')
  console.log(`${BOLD}Ledger shadow dry run (ADR-203 Phase 1)${RESET}`)
  console.log(`${DIM}${new Date().toISOString()}${RESET}`)
  console.log('')

  const run = await loadRunner()
  if (typeof run !== 'function') throw new Error('runLedgerShadowDryRun export missing')

  const result = await run({ skipPayout })
  const steps = result?.steps || []
  let passed = 0
  for (const s of steps) {
    const mark = s.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    console.log(`${mark} ${s.name}`)
    console.log(
      `  ${DIM}${s.detail}${RESET}${s.durationMs != null ? ` ${CYAN}(${s.durationMs}ms)${RESET}` : ''}`,
    )
    if (s.payload) {
      console.log(`  ${DIM}payload:${RESET} ${JSON.stringify(s.payload)}`)
    }
    if (s.ok) passed += 1
  }
  console.log('')
  console.log(
    result?.ok
      ? `${GREEN}PASS${RESET} ${passed}/${steps.length}`
      : `${RED}FAIL${RESET} ${passed}/${steps.length}`,
  )
  if (result?.context) {
    const ctx = {
      bookingId: result.context.bookingId,
      partnerId: result.context.partnerId,
      journalId: result.context.journalId,
      payoutId: result.context.payoutId,
      shadows: result.context.shadows,
      verdict: result.context.verdict,
      durationMs: result.context.durationMs,
    }
    console.log(`${DIM}context:${RESET}`)
    console.log(JSON.stringify(ctx, null, 2))
  }
  process.exit(result?.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
