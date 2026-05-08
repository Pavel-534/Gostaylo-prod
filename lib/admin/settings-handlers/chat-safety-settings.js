const defaultChatSafety = {
  autoShadowbanEnabled: false,
  strikeThreshold: 5,
  estimatedBookingValueThb: 8000,
}

export function buildChatSafetySettingsPatch(body, prev = {}) {
  const rawBody = body?.chatSafety && typeof body.chatSafety === 'object' ? body.chatSafety : {}
  const merged = {
    ...defaultChatSafety,
    ...(prev?.chatSafety && typeof prev.chatSafety === 'object' ? prev.chatSafety : {}),
    ...rawBody,
  }
  merged.autoShadowbanEnabled = merged.autoShadowbanEnabled === true
  const st = parseInt(String(merged.strikeThreshold ?? ''), 10)
  merged.strikeThreshold = Number.isFinite(st) && st >= 1 && st <= 999 ? st : defaultChatSafety.strikeThreshold
  const est = parseFloat(String(merged.estimatedBookingValueThb ?? ''))
  merged.estimatedBookingValueThb =
    Number.isFinite(est) && est >= 0 ? est : defaultChatSafety.estimatedBookingValueThb
  return { chatSafety: merged }
}
