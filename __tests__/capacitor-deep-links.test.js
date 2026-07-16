/**
 * Stage 172.0 — Capacitor deep-link allowlist unit guard.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deepLinkPathFromPushData,
  resolveCapacitorDeepLinkPath,
} from '../lib/capacitor/deep-links.js'

describe('capacitor deep-links', () => {
  it('allows checkout and messages paths', () => {
    assert.equal(resolveCapacitorDeepLinkPath('/checkout/bk-1'), '/checkout/bk-1')
    assert.equal(resolveCapacitorDeepLinkPath('/messages/conv-1'), '/messages/conv-1')
    assert.equal(resolveCapacitorDeepLinkPath('/messages'), '/messages')
  })

  it('rejects arbitrary hosts/paths', () => {
    assert.equal(resolveCapacitorDeepLinkPath('https://evil.example/phish'), null)
    assert.equal(resolveCapacitorDeepLinkPath('/admin/users'), null)
  })

  it('maps push data to messages/checkout', () => {
    assert.equal(
      deepLinkPathFromPushData({ conversationId: 'c1' }),
      '/messages/c1',
    )
    assert.equal(
      deepLinkPathFromPushData({ bookingId: 'b1', openCheckout: '1' }),
      '/checkout/b1',
    )
  })
})
