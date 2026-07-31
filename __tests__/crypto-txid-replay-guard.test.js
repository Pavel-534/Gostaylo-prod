/**
 * AUDIT_03 C3.2 — crypto txid replay guard (no DB).
 * Run: node --test __tests__/crypto-txid-replay-guard.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('crypto-txid-replay-guard', () => {
  it('builds idempotency key', async () => {
    const { cryptoPaymentIdempotencyKey, normalizeCryptoTxid } = await import(
      '../lib/payment/crypto-txid-replay-guard.js'
    )
    assert.equal(normalizeCryptoTxid('  abc  '), 'abc')
    assert.equal(cryptoPaymentIdempotencyKey('tx1', 'bk1'), 'crypto_payment:tx1:bk1')
    assert.equal(cryptoPaymentIdempotencyKey('', 'bk1'), null)
  })

  it('returns ALREADY_PROCESSED for same booking tx', async () => {
    const { assertCryptoTxidAvailable } = await import('../lib/payment/crypto-txid-replay-guard.js')
    const supabase = {
      from(table) {
        if (table === 'payments') {
          return {
            select() {
              return {
                eq() {
                  return {
                    limit: async () => ({
                      data: [{ id: 'p1', booking_id: 'bk-a', status: 'CONFIRMED', tx_id: 'tx-1' }],
                      error: null,
                    }),
                  }
                },
              }
            },
          }
        }
        return {
          select() {
            return {
              contains() {
                return { limit: async () => ({ data: [], error: null }) }
              },
            }
          },
        }
      },
    }
    const r = await assertCryptoTxidAvailable(supabase, { txid: 'tx-1', bookingId: 'bk-a' })
    assert.equal(r.ok, false)
    assert.equal(r.status, 409)
    assert.equal(r.code, 'ALREADY_PROCESSED')
  })

  it('returns TXID_ALREADY_USED for other booking', async () => {
    const { assertCryptoTxidAvailable } = await import('../lib/payment/crypto-txid-replay-guard.js')
    const supabase = {
      from(table) {
        if (table === 'payments') {
          return {
            select() {
              return {
                eq() {
                  return {
                    limit: async () => ({
                      data: [{ id: 'p1', booking_id: 'bk-other', status: 'CONFIRMED', tx_id: 'tx-1' }],
                      error: null,
                    }),
                  }
                },
              }
            },
          }
        }
        return {
          select() {
            return {
              contains() {
                return { limit: async () => ({ data: [], error: null }) }
              },
            }
          },
        }
      },
    }
    const r = await assertCryptoTxidAvailable(supabase, { txid: 'tx-1', bookingId: 'bk-a' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'TXID_ALREADY_USED')
  })
})
