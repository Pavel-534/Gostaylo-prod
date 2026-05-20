/**
 * Stage 108.4 / P0-3 — проверка колонок миграции stage103_2 на Supabase.
 * Не меняет данные. Exit 0 = все колонки доступны.
 *
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run verify:schema-103-2
 *
 * Применение: migrations/stage103_2_payout_batches_lifecycle_columns.sql
 * (или по частям: migrations/stage103_2_payout_batches_lifecycle_columns_SPLIT.md)
 */

import { createClient } from '@supabase/supabase-js'

const CHECKS = [
  { table: 'payout_batches', column: 'locked_at', label: 'payout_batches.locked_at' },
  { table: 'payout_batches', column: 'exported_at', label: 'payout_batches.exported_at' },
  { table: 'payout_batches', column: 'settled_at', label: 'payout_batches.settled_at' },
  { table: 'payout_batch_items', column: 'updated_at', label: 'payout_batch_items.updated_at' },
  { table: 'payout_batch_items', column: 'ledger_journal_id', label: 'payout_batch_items.ledger_journal_id' },
  { table: 'payouts', column: 'updated_at', label: 'payouts.updated_at' },
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    'Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (как у Next.js API).',
  )
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function columnExists(table, column) {
  const { error } = await supabase.from(table).select(column).limit(0)
  if (!error) return true
  const msg = String(error.message || '')
  if (msg.includes('column') && msg.includes('does not exist')) return false
  if (msg.includes('Could not find')) return false
  throw new Error(`${table}.${column}: ${msg}`)
}

console.log('Проверка Stage 103.2 schema (payout lifecycle columns)…\n')

let ok = 0
let missing = 0

for (const { table, column, label } of CHECKS) {
  try {
    const exists = await columnExists(table, column)
    if (exists) {
      console.log(`  ✅ ${label}`)
      ok += 1
    } else {
      console.log(`  ❌ ${label} — колонка отсутствует`)
      missing += 1
    }
  } catch (e) {
    console.log(`  ⚠️  ${label} — ${e.message}`)
    missing += 1
  }
}

console.log(`\nИтого: ${ok}/${CHECKS.length} OK`)

if (missing > 0) {
  console.log(
    '\nПримените migrations/stage103_2_payout_batches_lifecycle_columns.sql в Supabase SQL Editor.',
  )
  console.log('См. migrations/stage103_2_payout_batches_lifecycle_columns_SPLIT.md при timeout.')
  process.exit(1)
}

console.log('\nСхема 103.2 в порядке для этого окружения.')
process.exit(0)
