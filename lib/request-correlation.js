/**
 * Stage 56.0 — AsyncLocalStorage correlation id for one Node request chain
 * (booking / payment / notification logs). Set at API boundary via `withCorrelationFromRequest`.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

const correlationAls = new AsyncLocalStorage()

/**
 * @returns {string | null}
 */
export function getCorrelationId() {
  const s = correlationAls.getStore()
  return s?.correlationId ?? null
}

/**
 * @param {string} correlationId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function runWithCorrelationId(correlationId, fn) {
  const id = String(correlationId || '').trim() || randomUUID()
  return correlationAls.run({ correlationId: id }, fn)
}

/**
 * @param {Request} request
 * @param {(cid: string) => Promise<Response | unknown>} fn — receives resolved correlation id
 */
export function withCorrelationFromRequest(request, fn) {
  const incoming = request.headers?.get?.('x-correlation-id')
  const id = incoming && String(incoming).trim() ? String(incoming).trim() : randomUUID()
  return runWithCorrelationId(id, () => fn(id))
}
