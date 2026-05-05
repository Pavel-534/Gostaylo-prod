/**
 * Returns a safe internal path for redirects/navigation.
 * Rejects external/protocol-relative URLs and malformed values.
 */
export function safeInternalPath(raw, fallback = '/') {
  const defaultPath = normalizePath(fallback, '/')
  const input = String(raw || '').trim()
  if (!input) return defaultPath

  // Block protocol-relative and explicit protocol URLs.
  if (input.startsWith('//') || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(input)) {
    return defaultPath
  }

  // Must start from app root.
  if (!input.startsWith('/')) return defaultPath

  try {
    const parsed = new URL(input, 'https://gostaylo.local')
    if (parsed.origin !== 'https://gostaylo.local') return defaultPath
    return normalizePath(`${parsed.pathname}${parsed.search}${parsed.hash}`, defaultPath)
  } catch {
    return defaultPath
  }
}

function normalizePath(path, fallback) {
  const s = String(path || '').trim()
  if (!s || !s.startsWith('/') || s.startsWith('//')) return fallback
  return s
}
