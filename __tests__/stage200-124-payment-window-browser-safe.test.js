/**
 * Stage 200.124 — payment-window-policy must stay browser-safe for checkout client.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-124-payment-window-browser-safe.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Stage 200.124 — payment-window browser-safe', () => {
  it('payment-window-policy has no node: builtins', () => {
    const src = readFileSync(join(root, 'lib/booking/payment-window-policy.js'), 'utf8')
    assert.doesNotMatch(src, /node:module|createRequire|node:async_hooks/)
    assert.doesNotMatch(src, /buildInvoicePaymentWindowSystemMessage/)
  })

  it('system message lives in a separate server-oriented module', () => {
    const msg = readFileSync(
      join(root, 'lib/booking/payment-window-system-message.js'),
      'utf8',
    )
    assert.ok(msg.includes('export function buildInvoicePaymentWindowSystemMessage'))
    const chat = readFileSync(join(root, 'lib/chat/post-chat-invoice.server.js'), 'utf8')
    assert.ok(chat.includes("from '@/lib/booking/payment-window-system-message.js'"))
  })

  it('CheckoutHoldTimer still uses checkout-hold-policy (pure helpers)', () => {
    const timer = readFileSync(
      join(root, 'components/checkout/CheckoutHoldTimer.jsx'),
      'utf8',
    )
    assert.ok(timer.includes("from '@/lib/booking/checkout-hold-policy.js'"))
    const hold = readFileSync(join(root, 'lib/booking/checkout-hold-policy.js'), 'utf8')
    assert.ok(hold.includes("from '@/lib/booking/payment-window-policy.js'"))
  })
})
