/**
 * Stage 202.45 — DB hardening migration contract.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-45-db-hardening.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.45 — DB hardening migration', () => {
  const sql = read('migrations/stage202_45_db_hardening.sql')

  it('adds hot-path FK indexes without dropping unused indexes', () => {
    assert.match(sql, /idx_payout_batch_items_batch_id/)
    assert.match(sql, /idx_wallet_transactions_wallet_id/)
    assert.match(sql, /idx_promo_codes_flash_sale_window/)
    assert.doesNotMatch(sql, /^\s*DROP INDEX\b/im)
  })

  it('splits categories staff FOR ALL and messages admin FOR ALL', () => {
    assert.match(sql, /stage202_45_categories_staff_insert/)
    assert.match(sql, /stage202_45_categories_staff_update/)
    assert.match(sql, /stage202_45_categories_staff_delete/)
    assert.match(sql, /DROP POLICY IF EXISTS stage121_messages_admin_all/)
    assert.match(sql, /stage202_45_messages_admin_delete/)
  })

  it('locks referral shadow view and revokes sensitive RPC from clients', () => {
    assert.match(sql, /referral_shadow_l2_monthly/)
    assert.match(sql, /REVOKE ALL ON TABLE public\.referral_shadow_l2_monthly FROM anon/)
    assert.match(sql, /purge_test_ledger_rows/)
    assert.match(sql, /admin_contact_leak_top_violators/)
    assert.match(sql, /listings_map_bbox_pin_count_v1/)
    assert.match(sql, /audit_booking_row/)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION .+ TO service_role/)
  })
})
