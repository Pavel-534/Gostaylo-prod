/**
 * @file lib/chat/message-filters.js
 *
 * Утилиты фильтрации и группировки сообщений чата.
 *
 * Вынесены из PartnerMessages и RenterMessages page.js для устранения
 * дублирования. Каждая функция — чистая (pure), без side-эффектов.
 */

// ─── Текстовый поиск ─────────────────────────────────────────────────────────

/**
 * Фильтрует список сообщений по строке поискового запроса.
 *
 * Совпадение ищется в полях message/content (case-insensitive).
 * Группы изображений (_imageGroup: true) — фильтруются по caption
 * первого вложенного сообщения.
 *
 * @param {Array<Object>} messages — список ChatMessage или image-group объектов
 * @param {string}        query    — строка поиска
 * @returns {Array<Object>} отфильтрованный список (оригинальные объекты, без мутации)
 */
export function filterMessagesByQuery(messages, query) {
  if (!query || !query.trim()) return messages
  const q = query.trim().toLowerCase()

  return messages.filter((item) => {
    if (item._imageGroup) {
      // Группа изображений: ищем в caption любого вложенного сообщения
      return item.messages?.some((m) => {
        const text = m.message || m.content || ''
        return text.toLowerCase().includes(q)
      })
    }
    const text = item.message || item.content || ''
    return text.toLowerCase().includes(q)
  })
}

/**
 * Подсчитывает количество совпадений в тексте сообщений.
 * Используется для отображения счётчика результатов в ChatSearchBar.
 *
 * @param {Array<Object>} messages — исходный (полный) список
 * @param {string}        query
 * @returns {number}
 */
export function countSearchResults(messages, query) {
  if (!query || !query.trim()) return 0
  return filterMessagesByQuery(messages, query).length
}

// ─── Группировка изображений ─────────────────────────────────────────────────

/**
 * Объединяет подряд идущие сообщения с типом 'image' в группы-коллажи.
 *
 * Каждая группа 2+ изображений заменяется объектом:
 * ```
 * {
 *   _imageGroup: true,
 *   id: '<id первого сообщения>_group',
 *   messages: [ChatMessage, ...],
 * }
 * ```
 *
 * Одиночное изображение НЕ группируется — остаётся обычным сообщением.
 *
 * @param {Array<Object>} messages
 * @returns {Array<Object>}
 */
export function groupConsecutiveImages(messages) {
  if (!Array.isArray(messages) || !messages.length) return []

  const result = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]
    const type = String(msg.type || '').toLowerCase()
    const hasUrl = Boolean(msg.metadata?.image_url || msg.metadata?.url)

    if (type === 'image' && hasUrl) {
      const group = [msg]
      // Группируем только подряд идущие изображения от того же отправителя
      while (
        i + 1 < messages.length &&
        String(messages[i + 1].type || '').toLowerCase() === 'image' &&
        Boolean(messages[i + 1].metadata?.image_url || messages[i + 1].metadata?.url) &&
        messages[i + 1].sender_id === msg.sender_id
      ) {
        i++
        group.push(messages[i])
      }
      if (group.length >= 2) {
        result.push({ _imageGroup: true, id: `_grp_${msg.id}`, messages: group })
      } else {
        result.push(msg)
      }
    } else {
      result.push(msg)
    }
    i++
  }

  return result
}

// ─── Проверка типа сообщения ─────────────────────────────────────────────────

/**
 * Возвращает true если сообщение должно отображаться как «пузырь» (bubble).
 * Инвойсы, системные, голосовые рендерятся отдельными компонентами.
 *
 * @param {Object} msg — ChatMessage
 * @returns {boolean}
 */
export function isBubbleMessage(msg) {
  const type = String(msg?.type || '').toLowerCase()
  return ['text', 'image', 'file', 'rejection', ''].includes(type) || !msg?.type
}

/**
 * Возвращает true если тип сообщения — системное (milestone/info card).
 *
 * @param {Object} msg
 * @returns {boolean}
 */
export function isSystemMessage(msg) {
  return String(msg?.type || '').toLowerCase() === 'system'
}

/**
 * Возвращает true если тип сообщения — инвойс.
 *
 * @param {Object} msg
 * @returns {boolean}
 */
export function isInvoiceMessage(msg) {
  const type = String(msg?.type || '').toLowerCase()
  return type === 'invoice' || msg?.type === 'INVOICE'
}

/**
 * Возвращает true если тип сообщения — голосовое.
 *
 * @param {Object} msg
 * @returns {boolean}
 */
export function isVoiceMessage(msg) {
  return (
    String(msg?.type || '').toLowerCase() === 'voice' &&
    Boolean(msg?.metadata?.voice_url)
  )
}

/**
 * Возвращает true если тип сообщения — rejection.
 *
 * @param {Object} msg
 * @returns {boolean}
 */
export function isRejectionMessage(msg) {
  return String(msg?.type || '').toLowerCase() === 'rejection'
}

// ─── Медиа-галерея ────────────────────────────────────────────────────────────

/**
 * Извлекает из списка сообщений все медиафайлы для ChatMediaGallery.
 *
 * @param {Array<Object>} messages
 * @returns {{ images: Array<{id, url, createdAt}>, voices: Array<{id, url, durationSec, createdAt}> }}
 */
export function extractMediaFromMessages(messages) {
  if (!Array.isArray(messages)) return { images: [], voices: [] }

  const images = []
  const voices = []

  for (const msg of messages) {
    const type = String(msg?.type || '').toLowerCase()
    if (type === 'image' && msg.metadata?.image_url) {
      images.push({
        id: msg.id,
        url: msg.metadata.image_url,
        alt: msg.message || '',
        createdAt: msg.created_at || msg.createdAt,
      })
    }
    if (type === 'voice' && msg.metadata?.voice_url) {
      voices.push({
        id: msg.id,
        url: msg.metadata.voice_url,
        durationSec: msg.metadata.duration_sec || 0,
        createdAt: msg.created_at || msg.createdAt,
      })
    }
  }

  return { images, voices }
}
