#!/usr/bin/env node
/**
 * AUDIT_LEDGER_01 — first ledger posting staging smoke.
 *
 *   npm run smoke:ledger-first-posting
 *   npm run smoke:ledger-first-posting -- --skip-cleanup
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (+ URL). Does not mutate balance.service / escrow RPC.
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

async function loadRunner() {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { '@': root },
  })
  const mod = await jiti.import('../lib/smoke/ledger-first-posting-smoke.js')
  return mod.runLedgerFirstPostingSmoke || mod.default?.runLedgerFirstPostingSmoke
}

async function main() {
  console.log('')
  console.log(`${BOLD}Ledger first-posting smoke (AUDIT_LEDGER_01)${RESET}`)
  console.log(`${DIM}${new Date().toISOString()}${RESET}`)
  console.log('')

  const runLedgerFirstPostingSmoke = await loadRunner()
  if (typeof runLedgerFirstPostingSmoke !== 'function') {
    throw new Error('runLedgerFirstPostingSmoke export missing')
  }

  const result = await runLedgerFirstPostingSmoke({ skipCleanup })
  const steps = result?.steps || []
  let passed = 0
  for (const s of steps) {
    const mark = s.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    console.log(`${mark} ${s.name}`)
    console.log(
      `  ${DIM}${s.detail}${RESET}${s.durationMs != null ? ` ${CYAN}(${s.durationMs}ms)${RESET}` : ''}`,
    )
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
      journalId: result.context.journalId,
      disputeId: result.context.disputeId,
      auditSql: result.context.auditSql,
      durationMs: result.context.durationMs,
    }
    console.log(`${DIM}context:${RESET}`, JSON.stringify(ctx))
  }
  process.exit(result?.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
