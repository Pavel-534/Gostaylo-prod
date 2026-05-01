#!/usr/bin/env node
/**
 * migrate-global-pivot.mjs
 * ------------------------
 * Applies /app/supabase/migrations/20260201_global_pivot.sql to Supabase.
 *
 * Strategy:
 *   1) If process.env.SUPABASE_DB_URL is set → direct PG connection (preferred).
 *   2) Else → POST to Supabase Management API /database/query (requires SUPABASE_ACCESS_TOKEN).
 *   3) Else → write SQL to stdout with a clear instruction to apply via Dashboard SQL Editor.
 *
 * Usage:
 *   node /app/scripts/migrate-global-pivot.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL_FILE = path.resolve(__dirname, '../supabase/migrations/20260201_global_pivot.sql')

async function readSql() {
  return fs.readFile(SQL_FILE, 'utf8')
}

async function viaDirectPg(sql) {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
  if (!url) return { tried: false }
  try {
    const { default: pg } = await import('pg')
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    console.log('[migrate] connected via direct PG')
    await client.query(sql)
    await client.end()
    console.log('[migrate] OK ✅ migration applied via direct PG')
    return { tried: true, ok: true }
  } catch (err) {
    console.error('[migrate] direct PG failed:', err.message)
    return { tried: true, ok: false, err }
  }
}

async function viaManagementApi(sql) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = process.env.SUPABASE_PROJECT_REF
  if (!accessToken || !projectRef) return { tried: false }
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    })
    if (!r.ok) {
      const t = await r.text()
      console.error('[migrate] Management API HTTP', r.status, t)
      return { tried: true, ok: false }
    }
    console.log('[migrate] OK ✅ migration applied via Management API')
    return { tried: true, ok: true }
  } catch (err) {
    console.error('[migrate] Management API failed:', err.message)
    return { tried: true, ok: false, err }
  }
}

async function main() {
  const sql = await readSql()
  console.log(`[migrate] SQL loaded (${sql.length} bytes)`)

  let r = await viaDirectPg(sql)
  if (r.ok) return

  r = await viaManagementApi(sql)
  if (r.ok) return

  // Fallback — print instruction
  console.log('\n========================================================')
  console.log(' MIGRATION NOT APPLIED AUTOMATICALLY')
  console.log('========================================================')
  console.log('Set one of the following and re-run:')
  console.log('  • SUPABASE_DB_URL  (direct PG connection string)')
  console.log('  • SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (Management API)')
  console.log('')
  console.log('OR open Supabase Dashboard → SQL Editor → paste & Run:')
  console.log(`  ${SQL_FILE}`)
  console.log('========================================================')
  process.exitCode = 2
}

main().catch((e) => {
  console.error('[migrate] FATAL:', e)
  process.exit(1)
})
