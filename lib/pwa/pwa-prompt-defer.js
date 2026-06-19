let deferCount = 0

export function deferPwaPrompt() {
  deferCount += 1
}

export function resumePwaPrompt() {
  deferCount = Math.max(0, deferCount - 1)
}

export function isPwaPromptDeferred() {
  return deferCount > 0
}
