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

  var PUSH_ACK_TAG = 'airento-push-ack'

  /**
   * Premium Quiet Policy (v3): focused + visible tab of the same origin
   * — skip OS banner for NEW_MESSAGE (Realtime + in-app).
   * Unfocused / background / PWA hidden → do not suppress (Chromium needs a notification).
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
      if (!w || w.visibilityState !== 'visible' || !w.focused) return false
      return sameOrigin(String(w.url || ''), origin)
    })
  }

  /**
   * Chromium/Yandex inject "This site has been updated in the background" if a
   * push handler returns without showNotification. Show a silent tagged banner
   * and close it so the user never sees product-less noise.
   */
  function acknowledgePushWithoutUserBanner(registration) {
    if (!registration || typeof registration.showNotification !== 'function') {
      return Promise.resolve()
    }
    return Promise.resolve(
      registration.showNotification('\u200b', {
        tag: PUSH_ACK_TAG,
        silent: true,
        renotify: false,
        requireInteraction: false,
      }),
    )
      .then(function () {
        if (typeof registration.getNotifications !== 'function') return
        return registration.getNotifications({ tag: PUSH_ACK_TAG }).then(function (notes) {
          ;(notes || []).forEach(function (n) {
            try {
              n.close()
            } catch (_) {
              /* ignore */
            }
          })
        })
      })
      .catch(function () {
        /* still better than Chromium's default toast */
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
    acknowledgePushWithoutUserBanner: acknowledgePushWithoutUserBanner,
    PUSH_ACK_TAG: PUSH_ACK_TAG,
  }
})()
