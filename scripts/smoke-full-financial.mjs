#!/usr/bin/env node
/**
 * Stage 104 — полный финансовый E2E smoke (DB + сервисы), рельс RUB Direct / KG·USDT.
 *
 *   npm run smoke:full-financial
 *   npm run smoke:full-financial -- --rail=rub
 *   npm run smoke:full-financial -- --rail=intl --amount=12000
 *   npm run smoke:full-financial -- --rail=all
 *   npm run smoke:full-financial -- --http
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const argv = process.argv.slice(2)
const useHttp = argv.includes('--http')
const base = (process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
)

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function icon(ok) {
  return ok ? `${GREEN}✅${RESET}` : `${RED}❌${RESET}`
}

function fmtMs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1000) return `${Math.round(n)} ms`
  return `${(n / 1000).toFixed(2)} s`
}

function padRight(str, len) {
  const s = String(str)
  if (s.length >= len) return s.slice(0, len - 1) + '…'
  return s + ' '.repeat(len - s.length)
}

function printStage149MigrationWarning() {
  console.log(
    `${BOLD}${YELLOW}⚠ Важно для продакшена:${RESET} миграции ${BOLD}stage149_2${RESET} и ${BOLD}stage149_3${RESET} должны быть применены.`,
  )
}

function printHeader(modeLabel) {
  console.log('')
  console.log(`${BOLD}╔══════════════════════════════════════════════════════════════════╗${RESET}`)
  console.log(`${BOLD}║     GoStayLo — Financial E2E Smoke (Stage 104)                  ║${RESET}`)
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════════════╝${RESET}`)
  console.log(`${DIM}Режим:${RESET} ${modeLabel}`)
  console.log(`${DIM}Время:${RESET} ${new Date().toLocaleString('ru-RU')}`)
  console.log('')
  printStage149MigrationWarning()
}

function printReport(result, railLabel) {
  const steps = result?.steps || []
  const ctx = result?.context || {}
  let passed = 0

  if (railLabel) {
    console.log(`${BOLD}Рельс:${RESET} ${CYAN}${railLabel}${RESET} (${ctx.payoutRail || '—'})`)
    if (ctx.simulation) {
      const s = ctx.simulation
      console.log(
        `${DIM}Сумма:${RESET} ฿${s.priceThb} · гость платит ฿${s.guestTotalThb} (${s.guestPayCurrency}) · партнёру ฿${s.partnerNet} (${s.partnerPayoutCurrency})`,
      )
    }
    console.log('')
  }

  const nameWidth = Math.min(52, Math.max(28, ...steps.map((s) => (s.name || '').length)))

  console.log(`${DIM}${padRight('Шаг', nameWidth)}  Время      Результат${RESET}`)
  console.log(`${DIM}${'─'.repeat(nameWidth + 24)}${RESET}`)

  for (const s of steps) {
    if (s.ok) passed += 1
    const name = padRight(s.name || 'шаг', nameWidth)
    const time = padRight(fmtMs(s.durationMs), 10)
    const detail = s.detail ? `${DIM}${s.detail}${RESET}` : ''
    console.log(`${icon(s.ok)} ${name}  ${CYAN}${time}${RESET}  ${detail}`)
  }

  console.log('')
  const total = result?.totalDurationMs ?? steps.reduce((a, s) => a + (s.durationMs || 0), 0)
  console.log(
    `${BOLD}Итого:${RESET} ${passed}/${steps.length} шагов · ${CYAN}${fmtMs(total)}${RESET} ${
      result?.ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`
    }`,
  )

  if (Object.keys(ctx).length > 1) {
    console.log('')
    console.log(`${BOLD}Контекст:${RESET}`)
    if (ctx.payoutRailLabel) console.log(`  ${DIM}рельс:${RESET}     ${ctx.payoutRailLabel}`)
    if (ctx.bookingId) console.log(`  ${DIM}бронь:${RESET}   ${ctx.bookingId}`)
    if (ctx.batchId) console.log(`  ${DIM}пул:${RESET}     ${ctx.batchId}`)
    if (ctx.zipBytes) console.log(`  ${DIM}ZIP:${RESET}      ~${Math.round(ctx.zipBytes / 1024)} KB`)
    if (ctx.bankPackageUrl) console.log(`  ${DIM}URL ZIP:${RESET}  ${ctx.bankPackageUrl}`)
  }
  printStage149MigrationWarning()
  console.log('')
}

async function loadRunner() {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { '@': root },
  })
  const mod = await jiti.import('../lib/smoke/financial-smoke-run.js')
  return {
    runFinancialSmoke: mod.runFinancialSmoke || mod.default?.runFinancialSmoke,
    parseFinancialSmokeCliArgs: mod.parseFinancialSmokeCliArgs || mod.default?.parseFinancialSmokeCliArgs,
    validateDualRailSmokeResults:
      mod.validateDualRailSmokeResults || mod.default?.validateDualRailSmokeResults,
  }
}

async function runViaHttp(cliOpts, rail) {
  const cookie = process.env.GOSTAYLO_SESSION_COOKIE || process.env.ADMIN_SESSION_COOKIE || ''
  if (!cookie.trim()) {
    console.error(`${RED}Для --http задайте GOSTAYLO_SESSION_COOKIE (сессия ADMIN).${RESET}`)
    process.exit(1)
  }

  const res = await fetch(`${base}/api/admin/smoke/financial-run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie.trim(),
    },
    body: JSON.stringify({
      skipCleanup: cliOpts.skipCleanup,
      rail,
      priceThb: cliOpts.priceThb,
      commissionRate: cliOpts.commissionRate,
      guestPayCurrency: cliOpts.guestPayCurrency,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || json.message || `HTTP ${res.status}`)
  }
  return json.data || json
}

async function runDirect(runFinancialSmoke, cliOpts, rail) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`${RED}Нет Supabase env. Задайте .env.local или используйте --http.${RESET}`)
    process.exit(1)
  }
  return runFinancialSmoke({
    skipCleanup: cliOpts.skipCleanup,
    rail,
    priceThb: cliOpts.priceThb,
    commissionRate: cliOpts.commissionRate,
    guestPayCurrency: cliOpts.guestPayCurrency,
  })
}

async function main() {
  const { runFinancialSmoke, parseFinancialSmokeCliArgs, validateDualRailSmokeResults } =
    await loadRunner()
  if (typeof runFinancialSmoke !== 'function' || typeof parseFinancialSmokeCliArgs !== 'function') {
    throw new Error('financial-smoke-run exports missing')
  }

  const cliOpts = parseFinancialSmokeCliArgs(argv)
  const railArg = argv.find((a) => a.startsWith('--rail='))?.split('=')[1] || 'TBANK_RU'
  const runAll = String(railArg).toLowerCase() === 'all'

  const rails = runAll ? ['TBANK_RU', 'KG_CRYPTO'] : [cliOpts.rail]

  const modeLabel = useHttp
    ? 'HTTP → /api/admin/smoke/financial-run'
    : 'прямой (Supabase + сервисы)'

  printHeader(modeLabel)

  let allOk = true
  const wallStart = Date.now()
  const runResults = []

  for (let i = 0; i < rails.length; i += 1) {
    const rail = rails[i]
    if (runAll && i > 0) {
      console.log(`\n${BOLD}${'═'.repeat(66)}${RESET}\n`)
    }

    let result
    try {
      result = useHttp ? await runViaHttp(cliOpts, rail) : await runDirect(runFinancialSmoke, cliOpts, rail)
    } catch (e) {
      console.error(`${RED}Ошибка запуска (${rail}):${RESET}`, e.message)
      process.exit(1)
    }

    if (!result.totalDurationMs) {
      result.totalDurationMs = Date.now() - wallStart
    }

    printReport(result, result?.context?.payoutRailLabel || rail)
    runResults.push(result)
    if (!result?.ok) allOk = false
  }

  if (runAll && typeof validateDualRailSmokeResults === 'function') {
    console.log(`\n${BOLD}${'─'.repeat(66)}${RESET}`)
    const dual = validateDualRailSmokeResults(runResults)
    const dualIcon = dual.ok ? `${GREEN}✅${RESET}` : `${RED}❌${RESET}`
    console.log(
      `${dualIcon} ${BOLD}16. Два рельса одновременно${RESET}  ${DIM}${dual.detail}${RESET}`,
    )
    if (!dual.ok && !dual.skipped) allOk = false
  }

  console.log('')
  if (!allOk) {
    console.log(`${RED}Симуляция прервана. См. шаг с ❌ выше.${RESET}`)
    console.log(`${DIM}Доки: docs/PRE_REAL_PAYMENTS_CHECKLIST.md · docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md §14${RESET}`)
    process.exit(1)
  }

  console.log(`${GREEN}Симуляция пройдена${runAll ? ' по обоим рельсам' : ''} (учёт, акты, ZIP).${RESET}`)
  console.log(
    `${YELLOW}До реальных денег:${RESET} docs/PRE_REAL_PAYMENTS_CHECKLIST.md (ЮKassa, ОсОО, биржа)`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
