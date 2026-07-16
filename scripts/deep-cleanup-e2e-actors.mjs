#!/usr/bin/env node
/**
 * Deep E2E actor cleanup (ESM entry for Playwright teardown).
 *
 *   node scripts/deep-cleanup-e2e-actors.mjs
 *   node scripts/deep-cleanup-e2e-actors.mjs --execute
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import nextEnv from '@next/env'
import { deepCleanupE2eTestActors } from '../lib/e2e/deep-cleanup-e2e-actors.js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(path.resolve(process.cwd()))

const execute = process.argv.includes('--execute')
const dryRun = !execute

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRole) {
  console.error('[deep-cleanup-e2e-actors] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  const report = await deepCleanupE2eTestActors(sb, { dryRun })
  console.log('[deep-cleanup-e2e-actors]', { mode: dryRun ? 'dry-run' : 'execute', ...report })
  process.exit(0)
} catch (e) {
  console.error('[deep-cleanup-e2e-actors] failed:', e?.message || e)
  process.exit(1)
}
