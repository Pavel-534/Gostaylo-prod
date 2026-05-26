#!/usr/bin/env node
/**
 * Cleanup orphaned E2E / smoke listings (title/id patterns + [E2E_TEST_DATA]).
 *
 * Default: dry-run (no DB/storage changes).
 *   node scripts/cleanup-test-data.mjs
 *   node scripts/cleanup-test-data.mjs --execute
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import nextEnv from '@next/env'
import { runCleanupTestData } from '../lib/e2e/cleanup-test-data.service.js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(path.resolve(process.cwd()))

const execute = process.argv.includes('--execute')
const dryRun = !execute

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRole) {
  console.error('[cleanup-test-data] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const protectListingIds = String(process.env.CLEANUP_TEST_DATA_PROTECT_LISTING_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const sb = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function logOpsJobRun(payload) {
  const { error } = await sb.from('ops_job_runs').insert(payload)
  if (error && !String(error.message || '').includes('Could not find the table')) {
    console.warn('[cleanup-test-data] ops_job_runs:', error.message)
  }
}

const startedAt = new Date().toISOString()

try {
  const report = await runCleanupTestData(sb, { dryRun, protectListingIds })

  console.log('[cleanup-test-data]', {
    mode: dryRun ? 'dry-run' : 'execute',
    listingCount: report.listingCount,
    bookingCount: report.bookingCount,
    testUserCount: report.testUserCount,
    storagePathsPlanned: report.storagePathsPlanned,
    deleted: report.deleted,
  })

  if (typeof report.testUserCount === 'number') {
    if (dryRun) {
      console.log(`[cleanup-test-data] Найдено ${report.testUserCount} тестовых пользователей (будут удалены с --execute)`)
    } else {
      console.log(`[cleanup-test-data] Удалено ${report.deleted.testUsers ?? 0} тестовых пользователей (auth.users: ${report.deleted.authUsers ?? 0})`)
    }
  }

  if (typeof report.chatStressGarbageCount === 'number') {
    if (dryRun) {
      console.log(
        `[cleanup-test-data] Найдено ${report.chatStressGarbageCount} мусорных сообщений в чатах (st*-seq-* / E2E_CHAT_STRESS; будут удалены с --execute)`,
      )
    } else {
      console.log(
        `[cleanup-test-data] Удалено ${report.deleted?.chatStressMessages ?? report.chatStressGarbageCount ?? 0} мусорных сообщений из чатов`,
      )
    }
  }

  if (typeof report.marketingReferralCount === 'number') {
    const ledgerDeleted =
      (report.deleted?.referral_ledger ?? 0) +
      (report.deleted?.marketing_promo_tank_ledger ?? 0) +
      (report.deleted?.wallet_transactions ?? 0)
    if (dryRun) {
      console.log(
        `[cleanup-test-data] Найдено ${report.marketingReferralCount} записей referral ledger / marketing budget (будут удалены с --execute)`,
      )
    } else {
      console.log(
        `[cleanup-test-data] Удалено ${ledgerDeleted} записей из referral ledger / marketing budget (referral: ${report.deleted?.referral_ledger ?? 0}, tank: ${report.deleted?.marketing_promo_tank_ledger ?? 0}, wallet: ${report.deleted?.wallet_transactions ?? 0})`,
      )
    }
  }

  if (report.candidates?.length) {
    console.log('[cleanup-test-data] listing candidates:')
    for (const row of report.candidates.slice(0, 50)) {
      console.log(`  - ${row.id} [${row.status}] ${row.title}`)
    }
    if (report.candidates.length > 50) {
      console.log(`  … +${report.candidates.length - 50} more listings`)
    }
  } else {
    console.log('[cleanup-test-data] no test listings matched')
  }

  if (report.testUserCandidates?.length) {
    console.log('[cleanup-test-data] test user candidates:')
    for (const row of report.testUserCandidates.slice(0, 50)) {
      console.log(`  - ${row.id} ${row.email || ''} ${row.first_name || ''}`)
    }
    if (report.testUserCandidates.length > 50) {
      console.log(`  … +${report.testUserCandidates.length - 50} more users`)
    }
  }

  if (dryRun) {
    console.log('[cleanup-test-data] dry-run — pass --execute to delete')
  }

  if (!dryRun) {
    await logOpsJobRun({
      job_name: 'cleanup-test-data',
      status: 'success',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      stats: {
        listingCount: report.listingCount,
        testUserCount: report.testUserCount,
        deleted: report.deleted,
        protectListingIds,
      },
      error_message: null,
    })
  }
} catch (e) {
  const msg = e?.message || String(e)
  console.error('[cleanup-test-data] failed:', msg)
  if (!dryRun) {
    await logOpsJobRun({
      job_name: 'cleanup-test-data',
      status: 'error',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      stats: { protectListingIds },
      error_message: msg.slice(0, 1000),
    })
  }
  process.exit(1)
}
