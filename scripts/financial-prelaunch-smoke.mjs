#!/usr/bin/env node
/**
 * Pre-launch financial smoke (Stage 100).
 * 1) Public engine-config (v2 rounding)
 * 2) Cron routes auth + financial pipeline jobs
 *
 * Usage:
 *   BASE_URL=https://gostaylo.com CRON_SECRET=xxx node scripts/financial-prelaunch-smoke.mjs
 *
 * Full booking cycle (manual): docs/FINANCIAL_SMOKE_E2E.md
 */

const base = (process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
)
const secret = process.env.CRON_SECRET || ''

const fail = (msg) => {
  console.error('✗', msg)
  return false
}

async function getJson(path) {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function postCron(path, body) {
  if (!secret) return { status: 0, json: { error: 'CRON_SECRET missing' } }
  const res = await fetch(`${base}/api/cron/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  console.log('Financial pre-launch smoke')
  console.log('BASE_URL:', base)
  console.log('CRON_SECRET:', secret ? '(set)' : '(missing)')
  console.log('---')

  let ok = true

  const cfg = await getJson('/api/v2/pricing/engine-config')
  if (cfg.status !== 200 || !cfg.json?.success) {
    ok = fail(`engine-config HTTP ${cfg.status}`) && ok
  } else {
    const mode = cfg.json?.data?.roundingMode || cfg.json?.roundingMode
    console.log('✓ engine-config roundingMode:', mode)
    if (process.env.EXPECT_PRICING_V2 === 'true' && mode !== 'integer') {
      ok = fail(`EXPECTED integer rounding (PRICING_ENGINE_V2), got ${mode}`) && ok
    }
  }

  if (!secret) {
    ok = fail('Set CRON_SECRET to test cron routes') && ok
  } else {
    const crons = [
      { path: 'escrow-thaw', body: undefined },
      { path: 'promote-ready-for-payout', body: undefined },
      { path: 'payout-batch-pools', body: { force: true } },
      { path: 'financial-health-monitor', body: undefined },
    ]
    for (const { path, body } of crons) {
      const r = await postCron(path, body)
      const pass = r.status >= 200 && r.status < 300 && r.json?.success !== false
      console.log(pass ? '✓' : '✗', `POST /api/cron/${path}`, r.status, JSON.stringify(r.json).slice(0, 200))
      if (!pass) ok = false
    }

    const denied = await fetch(`${base}/api/cron/escrow-thaw`, { method: 'POST' })
    if (denied.status !== 401) {
      ok = fail(`cron without secret should 401, got ${denied.status}`) && ok
    } else {
      console.log('✓ cron rejects unauthenticated POST (401)')
    }
  }

  console.log('---')
  if (ok) {
    console.log('PASS — see docs/FINANCIAL_SMOKE_E2E.md for booking → payment → ledger manual steps')
    process.exit(0)
  }
  console.log('FAIL')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
