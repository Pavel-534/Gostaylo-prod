#!/usr/bin/env node
/**
 * Run financial crons in sequence (staging smoke).
 * Usage: BASE_URL=https://staging.example CRON_SECRET=xxx node scripts/financial-smoke-cron.mjs
 */

const base = (process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
)
const secret = process.env.CRON_SECRET || ''
if (!secret) {
  console.error('Set CRON_SECRET')
  process.exit(1)
}

const routes = [
  'escrow-thaw',
  'promote-ready-for-payout',
  'payout-batch-pools',
  'financial-health-monitor',
]

async function post(path, body) {
  const res = await fetch(`${base}/api/cron/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { path, status: res.status, json }
}

let failed = 0
for (const path of routes) {
  const body = path === 'payout-batch-pools' ? { force: true } : undefined
  const r = await post(path, body)
  const ok = r.status >= 200 && r.status < 300 && r.json?.success !== false
  console.log(ok ? '✓' : '✗', path, r.status, JSON.stringify(r.json))
  if (!ok) failed += 1
}
process.exit(failed ? 1 : 0)
