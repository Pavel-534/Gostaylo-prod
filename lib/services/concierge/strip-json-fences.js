/**
 * ADR-210 Slice 7.1 — strip LLM markdown fences before JSON.parse.
 */

/**
 * Remove surrounding ``` / ```json / ```markdown fences (and optional language tag).
 * @param {string} raw
 * @returns {string}
 */
export function stripMarkdownJsonFences(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''

  // Full-document fence: ```json\n...\n``` or ```\n...\n```
  const full = s.match(/^```(?:json|markdown|js|javascript)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i)
  if (full) {
    return String(full[1] || '').trim()
  }

  // Leading fence only / trailing fence only (common LLM paste)
  s = s.replace(/^```(?:json|markdown|js|javascript)?\s*\r?\n?/i, '')
  s = s.replace(/\r?\n?```\s*$/i, '')
  return s.trim()
}
