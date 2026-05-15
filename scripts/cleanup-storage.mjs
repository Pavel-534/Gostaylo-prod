#!/usr/bin/env node
/**
 * Daily storage orphan cleanup (Stage 95.1).
 *
 * По умолчанию — dry-run (только отчёт). Реальное удаление: `--execute`.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Примеры:
 *   node scripts/cleanup-storage.mjs
 *   node scripts/cleanup-storage.mjs --execute
 *   node scripts/cleanup-storage.mjs --min-age-days=14
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import nextEnv from '@next/env'
import { runStorageCleanup } from '../lib/storage/storage-cleanup.service.js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(path.resolve(process.cwd()))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRole) {
  console.error('[cleanup-storage] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const execute = process.argv.includes('--execute')
const minAgeArg = process.argv.find((a) => a.startsWith('--min-age-days='))
const minAgeDays = minAgeArg ? Number(minAgeArg.split('=')[1]) : undefined
const graceArg = process.argv.find((a) => a.startsWith('--grace-hours='))
const graceHours = graceArg ? Number(graceArg.split('=')[1]) : undefined

const sb = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const result = await runStorageCleanup({
  supabaseAdmin: sb,
  dryRun: !execute,
  minAgeDays,
  graceHours,
})

console.log(JSON.stringify(result, null, 2))
console.log(
  execute
    ? `[cleanup-storage] Deleted ${result.deleted} object(s), errors: ${result.deleteErrors}`
    : `[cleanup-storage] Dry-run: ${result.candidateCount} candidate(s). Pass --execute to delete.`,
)

if (result.deleteErrors > 0) process.exit(1)
