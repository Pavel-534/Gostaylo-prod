/**
 * @file lib/chat/map-api-message.js
 *
 * Унифицированный маппер сообщений чата.
 *
 * Задача: превратить любой «сырой» объект (из API /v2/chat/messages или
 * из Supabase Realtime INSERT-payload) в единый, предсказуемый формат
 * `ChatMessage`, который используют все клиентские компоненты.
 *
 * Принципы:
 *  - Не мутирует входной объект.
 *  - Устойчив к null/undefined: все поля имеют безопасные дефолты.
 *  - Идемпотентен: можно вызвать дважды с тем же результатом.
 *  - Интегрирован с maskContactInfo: текст маскируется если нужно.
 *  - Совместим с обоими форматами полей: camelCase (API-ответ) и
 *    snake_case (Realtime-payload).
 */

import { maskContactInfo, areContactsRevealedForBooking } from '@/lib/mask-contacts'
import { normalizeMessageType } from '@/lib/services/chat/message-types'
import { otherPartyHasReadRaw } from '@/lib/chat/read-receipts'

// ─── Типы ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ChatMessage
 *
 * Унифицированный объект сообщения.
 * Оба варианта ключей (camelCase и snake_case) присутствуют одновременно
 * для обратной совместимости с компонентами, написанными до рефакторинга.
 *
 * @property {string}       id              — UUID сообщения
 * @property {string}       conversationId  — UUID беседы (camelCase)
 * @property {string}       conversation_id — UUID беседы (snake_case)
 * @property {string|null}  senderId        — UUID отправителя (camelCase)
 * @property {string|null}  sender_id       — UUID отправителя (snake_case)
 * @property {string|null}  senderRole      — Роль отправителя (USER/PARTNER/ADMIN/…)
 * @property {string|null}  sender_role     — То же в snake_case
 * @property {string|null}  senderName      — Отображаемое имя отправителя
 * @property {string|null}  sender_name     — То же в snake_case
 * @property {string}       message         — Текст сообщения (может быть замаскирован)
 * @property {string}       content         — Псевдоним message (alias)
 * @property {string}       rawMessage      — Оригинальный текст БЕЗ маскировки
 * @property {string}       type            — Нормализованный тип: text|image|file|invoice|system|voice|rejection
 * @property {Object|null}  metadata        — JSON-метаданные (invoice, image_url, voice_url, etc.)
 * @property {boolean}      isRead          — Прочитано ли сообщение
 * @property {boolean}      is_read         — То же в snake_case
 * @property {string|null}  createdAt       — ISO-строка даты создания
 * @property {string|null}  created_at      — То же в snake_case
 * @property {string|null}  bookingId       — ID брони из metadata или из conversationContext
 * @property {boolean}      _masked         — true если текст был замаскирован
 * @property {string|null}  _status         — 'sending'|'sent'|null для оптимистичного UI
 * @property {boolean}      _optimistic     — true если сообщение ещё не подтверждено сервером
 */

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Разрешает значение поля, принимая оба формата (camelCase и snake_case).
 *
 * @param {Object} src
 * @param {string} camel  — ключ в camelCase
 * @param {string} snake  — ключ в snake_case
 * @param {*}      def    — значение по умолчанию
 * @returns {*}
 */
function pick(src, camel, snake, def = null) {
  const v = src[camel] ?? src[snake] ?? def
  return v === undefined ? def : v
}

/**
 * Безопасно парсит metadata: принимает объект, строку JSON или null.
 *
 * @param {Object|string|null} raw
 * @returns {Object|null}
 */
function safeMeta(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

/**
 * Извлекает bookingId из всех возможных мест хранения:
 *  1. metadata.booking_id / metadata.bookingId
 *  2. Явное поле bookingId / booking_id (из Realtime или расширенных ответов)
 *
 * @param {Object} src
 * @param {Object|null} meta — уже распакованный metadata
 * @returns {string|null}
 */
function resolveBookingId(src, meta) {
  return (
    src.bookingId ??
    src.booking_id ??
    meta?.booking_id ??
    meta?.bookingId ??
    null
  )
}

/**
 * Определяет тип сообщения, расширяя стандартный набор платформы.
 * Принимает сырое значение поля type (любой регистр).
 *
 * Типы ядра: text | image | file | invoice | system
 * Расширения: voice | rejection
 *
 * @param {string|null|undefined} rawType
 * @returns {string}
 */
function resolveMessageType(rawType) {
  const t = String(rawType || 'text').trim().toLowerCase()
  // Типы, не входящие в нормализатор платформы — обрабатываем сами
  if (t === 'voice') return 'voice'
  if (t === 'rejection') return 'rejection'
  return normalizeMessageType(t)
}

// ─── Основная функция ─────────────────────────────────────────────────────────

/**
 * Преобразует сырые данные сообщения в унифицированный объект `ChatMessage`.
 *
 * Принимает:
 *  - ответ GET /api/v2/chat/messages (camelCase ключи)
 *  - ответ POST /api/v2/chat/messages → data (camelCase)
 *  - Supabase Realtime INSERT payload.new (snake_case ключи)
 *  - объект-оптимист из useOptimisticSend (_optimistic: true)
 *
 * @param {Object} raw — сырые данные из одного из источников выше
 *
 * @param {Object}          [opts]                 — параметры маппинга
 * @param {string|null}     [opts.viewerUserId]    — ID текущего пользователя
 * @param {string|null}     [opts.bookingStatus]   — статус брони (из контекста беседы)
 * @param {string|null}     [opts.viewerRole]      — роль просматривающего: 'partner'|'renter'|'admin'
 * @param {string|null}     [opts.listingCategory] — slug категории листинга
 * @param {boolean}         [opts.maskContacts]    — принудительно включить маскировку
 *                                                    (undefined → вычислить из bookingStatus)
 *
 * @returns {ChatMessage|null} — null если raw = null/undefined
 */
export function mapApiMessageToRow(raw, opts = {}) {
  if (!raw) return null

  const {
    viewerUserId = null,
    bookingStatus = null,
    viewerRole = null,
    listingCategory = null,
    maskContacts: maskOverride,
  } = opts

  // ─── Базовые поля ──────────────────────────────────────────────────────────
  const id = raw.id ?? null
  const conversationId = pick(raw, 'conversationId', 'conversation_id')
  const senderId = pick(raw, 'senderId', 'sender_id')
  const senderRole = pick(raw, 'senderRole', 'sender_role')
  const senderName = pick(raw, 'senderName', 'sender_name')
  const type = resolveMessageType(raw.type)
  const meta = safeMeta(pick(raw, 'metadata', 'metadata'))
  const legacyRead = Boolean(pick(raw, 'isRead', 'is_read', false))
  const conversation = opts.conversation ?? null
  const isRead = conversation
    ? otherPartyHasReadRaw(raw, conversation)
    : legacyRead
  const createdAt = pick(raw, 'createdAt', 'created_at')
  const bookingId = resolveBookingId(raw, meta)
  const hasSafetyTrigger = Boolean(pick(raw, 'hasSafetyTrigger', 'has_safety_trigger', false))

  // ─── Текст сообщения ───────────────────────────────────────────────────────
  const rawText = String(
    raw.message ?? raw.content ?? meta?.text ?? ''
  )

  // ─── Маскировка контактов ─────────────────────────────────────────────────
  //
  // Логика: маскируем если:
  //   a) явно передан opts.maskContacts = true; ИЛИ
  //   b) booking ещё не оплачен / не на финальном статусе (см. areContactsRevealedForBooking)
  //      И сообщение не от текущего пользователя (свои слова скрывать не надо)
  //   c) Голосовые, системные, инвойсы — не маскируем (там нет свободного текста)
  //
  // staff (admin/moderator) видит всё — если viewerRole = 'admin', маскировка выключена.

  const isStaff = String(viewerRole || '').toLowerCase() === 'admin'
  const isOwnMessage = viewerUserId != null && String(senderId) === String(viewerUserId)
  const noTextTypes = new Set(['voice', 'image', 'file', 'invoice', 'system'])

  let shouldMask = false
  if (!isStaff && !isOwnMessage && !noTextTypes.has(type)) {
    if (typeof maskOverride === 'boolean') {
      shouldMask = maskOverride
    } else {
      // Вычисляем из bookingStatus если он передан
      shouldMask = bookingStatus != null
        ? !areContactsRevealedForBooking(bookingStatus)
        : false
    }
  }

  const displayText = shouldMask ? maskContactInfo(rawText) : rawText

  // ─── Оптимистичные поля ────────────────────────────────────────────────────
  const _status = raw._status ?? null
  const _optimistic = raw._optimistic === true

  // ─── Итоговый объект ───────────────────────────────────────────────────────
  return {
    // Идентификаторы (оба формата для совместимости)
    id,
    conversationId,
    conversation_id: conversationId,

    // Отправитель (оба формата)
    senderId,
    sender_id: senderId,
    senderRole,
    sender_role: senderRole,
    senderName,
    sender_name: senderName,

    // Текст (оба формата + оригинал)
    message: displayText,
    content: displayText,
    rawMessage: rawText,

    // Тип и метаданные
    type,
    metadata: meta,
    hasSafetyTrigger,
    has_safety_trigger: hasSafetyTrigger,

    // Прочтение (оба формата)
    isRead: Boolean(isRead),
    is_read: Boolean(isRead),

    // Даты (оба формата)
    createdAt,
    created_at: createdAt,

    // Связанные сущности (null-safe)
    bookingId: bookingId ?? null,

    // Контекст (не хранится в БД, только в памяти)
    listingCategory: listingCategory ?? null,

    // Anti-fraud флаг (для UI подсказок)
    _masked: shouldMask && displayText !== rawText,

    // Оптимистичный UI
    _status,
    _optimistic,
  }
}

/**
 * Маппит массив сырых сообщений пачкой.
 * Общий opts применяется ко всем; bookingStatus берётся из opts.
 *
 * @param {Array<Object>} rows
 * @param {Object}        [opts] — те же опции что у mapApiMessageToRow
 * @returns {ChatMessage[]}
 */
export function mapApiMessages(rows, opts = {}) {
  if (!Array.isArray(rows)) return []
  return rows.reduce((acc, raw) => {
    const mapped = mapApiMessageToRow(raw, opts)
    if (mapped) acc.push(mapped)
    return acc
  }, [])
}

/**
 * Применяет маппер к уже существующему списку, обновляя только те записи,
 * чьи поля изменились (для safe Realtime-merge без полной перерисовки).
 *
 * Если сообщение с таким id уже есть в prev — мержит поля.
 * Если нового нет — добавляет в конец.
 *
 * @param {ChatMessage[]} prev        — текущий список в стейте
 * @param {Object}        rawIncoming — сырой payload.new из Realtime
 * @param {Object}        [opts]
 * @returns {ChatMessage[]}
 */
export function mergeRealtimeMessage(prev, rawIncoming, opts = {}) {
  if (!rawIncoming) return prev
  const incoming = mapApiMessageToRow(rawIncoming, opts)
  if (!incoming) return prev

  const idx = prev.findIndex((m) => m.id === incoming.id)
  if (idx === -1) {
    // Новое сообщение — добавляем
    return [...prev, incoming]
  }
  // Обновляем существующее (например, is_read изменился)
  const next = [...prev]
  next[idx] = { ...next[idx], ...incoming }
  return next
}
