;(function () {
  function sameOrigin(clientUrl, swOrigin) {
    if (!swOrigin) return false
    try {
      var cu = new URL(clientUrl)
      var so = new URL(swOrigin)
      return cu.origin === so.origin
    } catch (_) {
      return false
    }
  }

  /**
   * Premium Quiet Policy (v3): любая вкладка того же origin, что и SW, в состоянии `visible`
   * — не показываем системный баннер для NEW_MESSAGE (Realtime + in-app).
   * PWA / вкладка свернута: обычно `visibilityState !== 'visible'` → пуш не подавляется.
   */
  function shouldSuppressSystemNotificationForNewMessage(windows, swOrigin) {
    if (!Array.isArray(windows) || windows.length === 0) return false
    var origin = swOrigin
      ? String(swOrigin)
      : typeof self !== 'undefined' && self.location && self.location.origin
        ? self.location.origin
        : ''
    if (!origin) return false
    return windows.some(function (w) {
      if (!w || w.visibilityState !== 'visible') return false
      return sameOrigin(String(w.url || ''), origin)
    })
  }

  /** Legacy: подавление только при открытом URL того же треда (до v3). */
  function shouldSuppressPushForConversation(windows, conversationId) {
    if (!conversationId) return false
    if (!Array.isArray(windows) || windows.length === 0) return false
    return windows.some(function (w) {
      if (!w || w.visibilityState !== 'visible') return false
      var url = String((w && w.url) || '')
      var match = url.match(/\/messages\/([^/?#]+)/)
      var openCid = match && match[1] ? decodeURIComponent(match[1]) : null
      return !!openCid && String(openCid) === String(conversationId)
    })
  }

  self.GostayloPushPolicy = {
    shouldSuppressSystemNotificationForNewMessage: shouldSuppressSystemNotificationForNewMessage,
    shouldSuppressPushForConversation: shouldSuppressPushForConversation,
  }
})()
