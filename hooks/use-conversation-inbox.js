'use client'

/**
 * @file hooks/use-conversation-inbox.js
 *
 * Хук состояния инбокса (левая панель со списком диалогов).
 *
 * Инкапсулирует всё, что ранее было разбросано по PartnerMessages / RenterMessages:
 *  – loadConversations (с пагинацией, offset/append)
 *  – Realtime-подписка на таблицу conversations (через useRealtimeConversations)
 *  – фильтрация по вкладкам Hosting / Traveling (two-hat логика)
 *  – фильтрация по listing_category (для будущих нянь и консьержей)
 *  – бесконечная прокрутка (infinite scroll)
 *  – дебаунс запросов при смене фильтра/поиска
 *
 * Связь с Фазой 1: использует filterConversationsByInboxTab и sumUnreadInConversations
 * из lib/chat-inbox-tabs.js (они уже чистые утилиты, не нуждаются в переносе).
 *
 * Использование:
 * ```js
 * const {
 *   conversations, filteredConversations,
 *   isLoading, hasMore, isLoadingMore,
 *   inboxTab, setInboxTab,
 *   categoryFilter, setCategoryFilter,
 *   hostingUnread, travelingUnread,
 *   loadMore,
 *   refresh,
 * } = useConversationInbox({ userId, defaultTab })
 * ```
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  filterConversationsByInboxTab,
  sumUnreadInConversations,
} from '@/lib/chat-inbox-tabs'
import { useRealtimeConversations } from '@/hooks/use-realtime-chat'

// ─── Утилита ─────────────────────────────────────────────────────────────────

/** Lightweight debounce (аналогичен use-realtime-chat.js). */
function debounce(fn, ms) {
  let timer = null
  const debounced = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced
}

const PAGE_SIZE = 20

// ─── Хук ─────────────────────────────────────────────────────────────────────

/**
 * @param {Object}          opts
 * @param {string|null}     opts.userId             — UUID текущего пользователя
 * @param {string}          [opts.defaultTab]       — INBOX_TAB_HOSTING | INBOX_TAB_TRAVELING
 * @param {string|null}     [opts.initialCategory]  — предварительный фильтр категории
 * @param {boolean}         [opts.enabled]          — false = хук спит (для lazy init)
 *
 * @returns {{
 *   conversations:         Array<Object>,
 *   filteredConversations: Array<Object>,
 *   isLoading:             boolean,
 *   hasMore:               boolean,
 *   isLoadingMore:         boolean,
 *   inboxTab:              string,
 *   setInboxTab:           (tab: string) => void,
 *   categoryFilter:        string|null,
 *   setCategoryFilter:     (cat: string|null) => void,
 *   hostingUnread:         number,
 *   travelingUnread:       number,
 *   totalUnread:           number,
 *   loadMore:              () => void,
 *   refresh:               () => void,
 * }}
 */
export function useConversationInbox({
  userId,
  defaultTab = INBOX_TAB_TRAVELING,
  initialCategory = null,
  enabled = true,
}) {
  // ── Стейт ───────────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const [inboxTab, setInboxTab] = useState(defaultTab)
  const [categoryFilter, setCategoryFilter] = useState(initialCategory)

  // Стабилизируем дебаунс-функцию — пересоздаётся только при смене userId
  const debouncedLoadRef = useRef(null)

  // ── Загрузка ────────────────────────────────────────────────────────────────

  /**
   * Внутренняя функция загрузки. Используется как напрямую, так и через дебаунс.
   *
   * @param {{ offset?: number, append?: boolean, category?: string|null }} fetchOpts
   */
  const _fetchConversations = useCallback(
    async ({ offset: fetchOffset = 0, append = false, category = categoryFilter } = {}) => {
      if (!userId || !enabled) return

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      try {
        const params = new URLSearchParams({
          enrich: '1',
          limit: String(PAGE_SIZE),
          offset: String(fetchOffset),
        })
        if (category) params.set('listing_category', category)

        const res = await fetch(`/api/v2/chat/conversations?${params}`, {
          credentials: 'include',
        })
        const json = await res.json()

        if (!res.ok || !json.success) return

        const rows = Array.isArray(json.data) ? json.data : []

        if (append) {
          setConversations((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const fresh = rows.filter((c) => !existingIds.has(c.id))
            return [...prev, ...fresh]
          })
          setOffset(fetchOffset)
        } else {
          setConversations(rows)
          setOffset(0)
        }

        setHasMore(!!json.meta?.hasMore)
      } catch (err) {
        console.error('[useConversationInbox] fetchConversations error:', err)
      } finally {
        if (append) {
          setIsLoadingMore(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [userId, enabled, categoryFilter]
  )

  // Создаём дебаунс-обёртку при изменении _fetchConversations
  useEffect(() => {
    const debounced = debounce((opts) => _fetchConversations(opts), 300)
    debouncedLoadRef.current = debounced
    return () => debounced.cancel()
  }, [_fetchConversations])

  // ── Первичная загрузка и перезагрузка при смене фильтра ────────────────────

  useEffect(() => {
    if (!userId || !enabled) return
    // Сброс offset при изменении фильтра — debounced, чтобы не молотить при rapid-change
    debouncedLoadRef.current?.({ offset: 0, append: false, category: categoryFilter })
  }, [userId, enabled, categoryFilter])

  // ── Realtime: беседы обновляются в фоне ──────────────────────────────────────
  // При изменении любой строки таблицы conversations — перезагружаем первую
  // страницу (merge с текущим стейтом, без прокрутки вверх).
  //
  // Smart merge: если беседа уже в списке — обновляем на месте,
  // если новая — добавляем в начало (для актуальных hot-диалогов).

  const handleRealtimeConvUpdate = useCallback(
    (payload) => {
      if (!payload?.new) {
        // Перезагружаем полностью если payload пустой (DELETE или отсутствует new)
        debouncedLoadRef.current?.({ offset: 0, append: false })
        return
      }

      const incoming = payload.new
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === incoming.id)
        if (payload.eventType === 'DELETE') {
          return prev.filter((c) => c.id !== payload.old?.id)
        }
        if (idx !== -1) {
          // Обновляем существующую строку (UPDATE)
          // Мержим только скалярные поля, не трогаем обогащение (listing, booking, lastMessage)
          const next = [...prev]
          const updatedConv = {
            ...next[idx],
            statusLabel: incoming.status_label ?? incoming.statusLabel ?? next[idx].statusLabel,
            lastMessageAt: incoming.last_message_at ?? next[idx].lastMessageAt,
            updatedAt: incoming.updated_at ?? next[idx].updatedAt,
            isPriority: incoming.is_priority ?? next[idx].isPriority,
          }
          next[idx] = updatedConv
          // Если беседа получила новое сообщение — всплываем на верх и пересортируем
          if (payload.eventType === 'UPDATE' && incoming.last_message_at) {
            next.splice(idx, 1)  // убираем со старой позиции
            return [updatedConv, ...next].sort((a, b) => {
              const ta = new Date(a.lastMessageAt || a.updatedAt || 0).getTime()
              const tb = new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
              return tb - ta
            })
          }
          return next
        }
        // INSERT: новый диалог появился — добавляем в начало и тригерим обогащение
        // (сырой Realtime payload не содержит listing/booking — делаем точечный fetch)
        _fetchConversations({ offset: 0, append: false }).catch(() => {})
        return prev
      })
    },
    [_fetchConversations]
  )

  useRealtimeConversations(userId ?? null, handleRealtimeConvUpdate)

  // ── Infinite scroll ────────────────────────────────────────────────────────

  /** Загрузить следующую страницу. Вызывается из IntersectionObserver в ConversationList. */
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return
    const nextOffset = offset + PAGE_SIZE
    _fetchConversations({ offset: nextOffset, append: true })
  }, [hasMore, isLoadingMore, offset, _fetchConversations])

  /** Принудительная перезагрузка первой страницы (например, после Archive/Unarchive). */
  const refresh = useCallback(() => {
    _fetchConversations({ offset: 0, append: false })
  }, [_fetchConversations])

  // ── Derived: фильтры по вкладкам ───────────────────────────────────────────

  const filteredConversations = useMemo(
    () => filterConversationsByInboxTab(conversations, userId, inboxTab),
    [conversations, userId, inboxTab]
  )

  const hostingUnread = useMemo(
    () =>
      sumUnreadInConversations(
        filterConversationsByInboxTab(conversations, userId, INBOX_TAB_HOSTING)
      ),
    [conversations, userId]
  )

  const travelingUnread = useMemo(
    () =>
      sumUnreadInConversations(
        filterConversationsByInboxTab(conversations, userId, INBOX_TAB_TRAVELING)
      ),
    [conversations, userId]
  )

  const totalUnread = useMemo(
    () => hostingUnread + travelingUnread,
    [hostingUnread, travelingUnread]
  )

  // ── Синхронизация вкладки при открытии конкретного треда ──────────────────
  // (Когда страница открывается по URL с conversationId — вкладка должна совпадать
  //  с ролью пользователя в этой беседе.  Эту логику page.js вызывает явно через
  //  setInboxTab — здесь только декларируем setter.)

  return {
    // Данные
    conversations,
    filteredConversations,
    isLoading,
    hasMore,
    isLoadingMore,

    // Фильтры
    inboxTab,
    setInboxTab,
    categoryFilter,
    setCategoryFilter,

    // Счётчики
    hostingUnread,
    travelingUnread,
    totalUnread,

    // Методы
    loadMore,
    refresh,

    // Escape hatch — для прямой мутации списка из page.js
    setConversations,
  }
}
