/**
 * Stage 52.0 — плейсхолдеры `{key}` в title/body пушей.
 */

export function interpolatePushTemplate(template, data) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) =>
    data[key] !== undefined ? data[key] : match,
  )
}
