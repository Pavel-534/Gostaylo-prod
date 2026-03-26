'use client'

/**
 * Подсветка вхождений поиска в тексте сообщения.
 * Вынесено из chat-search-bar, чтобы избежать циклических импортов с message-bubble.
 */
export function highlightText(text, query) {
  if (!query || !query.trim()) return text
  const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text).split(new RegExp(`(${safeQ})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
