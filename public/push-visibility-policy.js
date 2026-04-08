(function () {
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
    shouldSuppressPushForConversation: shouldSuppressPushForConversation,
  }
})()

