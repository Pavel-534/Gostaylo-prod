/**
 * Stage 118.6 — мемоизация проверки доступа в рамках одного HTTP-запроса (AsyncLocalStorage).
 */
import { AsyncLocalStorage } from 'node:async_hooks'

/** @typedef {{ accessByKey: Map<string, Promise<unknown>> }} RequestAccessStore */

const requestAccessAls = new AsyncLocalStorage()

/**
 * @returns {RequestAccessStore | undefined}
 */
export function getRequestAccessStore() {
  return requestAccessAls.getStore()
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 */
export function runWithRequestAccessCache(fn) {
  return requestAccessAls.run({ accessByKey: new Map() }, fn)
}

/**
 * @param {string} key
 * @param {() => Promise<unknown>} factory
 */
export function memoizeAccessCheck(key, factory) {
  const store = getRequestAccessStore()
  if (!store) return factory()
  if (!store.accessByKey.has(key)) {
    store.accessByKey.set(key, factory())
  }
  return store.accessByKey.get(key)
}
