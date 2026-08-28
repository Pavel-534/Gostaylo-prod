/**
 * Stage 202.15 — DB guardrails migration contract (file-only; not applied to prod by agent).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationPath = join(root, 'migrations/stage202_15_db_guardrails.sql')

test('stage202_15_db_guardrails.sql exists', () => {
  assert.equal(existsSync(migrationPath), true)
})

test('migration defines email lower unique index', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /profiles_email_lower_idx/)
  assert.match(sql, /LOWER\(email\)/)
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/)
})

test('migration guards paid money columns with break-glass GUC', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /airento_guard_booking_paid_money_columns/)
  assert.match(sql, /airento\.allow_paid_price_fix/)
  assert.match(sql, /PAID_ESCROW/)
  assert.match(sql, /price_thb/)
  assert.match(sql, /commission_thb/)
  assert.match(sql, /partner_earnings_thb/)
  assert.match(sql, /rounding_diff_pot/)
  assert.match(sql, /pricing_snapshot/)
  assert.match(sql, /trg_bookings_guard_paid_money_columns/)
})
