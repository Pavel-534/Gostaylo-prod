/**
 * Stage 54.0 — lazy wiring of channel helpers into notification handler clusters (avoids circular imports).
 */

/** @type {Record<string, Function> | null} */
let _deps = null

/**
 * @param {object} d
 */
export function setNotificationHandlerDeps(d) {
  _deps = d
}

export function getNotifyDeps() {
  if (!_deps) {
    throw new Error('[notify-deps] setNotificationHandlerDeps() not called (NotificationService.dispatch)')
  }
  return _deps
}
