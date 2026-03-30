/**
 * Восстанавливает символы из «двойного» экранирования, когда в строке видны
 * литералы вида \uD83D\uDCD6 вместо эмодзи (часто после JSON в БД/логах).
 */
export function decodeTelegramText(text) {
  if (text == null || typeof text !== 'string') return text
  if (!text.includes('\\u')) return text

  try {
    let s = text
    // Пара суррогатов UTF-16 → одна кодовая точка (эмодзи и т.п.)
    s = s.replace(/\\u([dD][89aAbB][0-9a-fA-F]{2})\\u([0-9a-fA-F]{4})/g, (_, hi, lo) => {
      const high = parseInt(hi, 16)
      const low = parseInt(lo, 16)
      const cp = (high - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000
      return String.fromCodePoint(cp)
    })
    s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    return s
  } catch {
    return text
  }
}
