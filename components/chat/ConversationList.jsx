'use client'

/**
 * @file components/chat/ConversationList.jsx
 *
 * Умный сайдбар-список диалогов чата.
 *
 * Отличие от components/conversation-list.jsx (старый):
 *   – Принимает данные и колбэки непосредственно из useConversationInbox (Фаза 2).
 *   – Разделён на презентационную часть и управляющую:
 *       ConversationListPanel  — чистый UI (принимает props)
 *       ConversationList       — «умный» обёртка, подключённая к хуку
 *   – Поддерживает фильтрацию по категориям (няни, консьержи, апартаменты…).
 *   – Infinite scroll через IntersectionObserver.
 *   – Отображает флаг _masked (lock-иконка в превью последнего сообщения).
 *   – Поддерживает Hosting / Traveling вкладки.
 *
 * Использование (Фаза 4, thin page):
 * ```jsx
 * const inbox = useConversationInbox({ userId, defaultTab: INBOX_TAB_HOSTING })
 *
 * <ConversationList
 *   inbox={inbox}
 *   selectedId={conversationId}
 *   onSelect={(id) => router.push(`/partner/messages/${id}`)}
 *   language="ru"
 * />
 * ```
 *
 * Или чисто презентационный вариант (без хука):
 * ```jsx
 * <ConversationListPanel
 *   conversations={filteredConversations}
 *   selectedId={conversationId}
 *   onSelect={handleSelect}
 *   ...
 * />
 * ```
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'
import {
  Archive,
  Building2,
  LayoutGrid,
  Loader2,
  Lock,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { ChatInboxRoleTabs } from '@/components/chat-inbox-role-tabs'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
} from '@/lib/chat-inbox-tabs'

// ─── Статус-бейдж ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  PENDING:   { ru: 'Ожидает',      en: 'Pending',   cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  CONFIRMED: { ru: 'Подтверждено', en: 'Confirmed', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  PAID:      { ru: 'Оплачено',     en: 'Paid',      cls: 'bg-green-100 text-green-800 border-green-200' },
  COMPLETED: { ru: 'Завершено',    en: 'Completed', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCELLED: { ru: 'Отменено',     en: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-200' },
  REFUNDED:  { ru: 'Возврат',      en: 'Refunded',  cls: 'bg-purple-100 text-purple-700 border-purple-200' },
}

function StatusBadge({ statusLabel, lang = 'ru' }) {
  if (!statusLabel) return null
  const cfg = STATUS_CFG[String(statusLabel).toUpperCase()]
  if (!cfg) return null
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
        cfg.cls,
      )}
    >
      {lang === 'en' ? cfg.en : cfg.ru}
    </span>
  )
}

// ─── Иконка категории ─────────────────────────────────────────────────────────

const SLUG_TO_LUCIDE = {
  nanny: 'Baby', babysitter: 'Baby',
  food: 'UtensilsCrossed', dining: 'UtensilsCrossed', restaurant: 'UtensilsCrossed',
  apartment: 'Building2', villa: 'Home', house: 'Home',
  transport: 'Car', cleaning: 'Sparkles', tour: 'Map',
  default: 'Tag',
}

function slugToPascal(slug) {
  return String(slug || '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('')
}

function CategoryIcon({ slug, className }) {
  if (!slug) return <LayoutGrid className={className} />
  const key = String(slug).toLowerCase()
  const name = SLUG_TO_LUCIDE[key] || (LucideIcons[slugToPascal(slug)] ? slugToPascal(slug) : 'Tag')
  const Icon = LucideIcons[name] || LucideIcons.Tag
  return <Icon className={className} />
}

// ─── Превью последнего сообщения ─────────────────────────────────────────────

function LastMessagePreview({ conv, lang = 'ru' }) {
  const last = conv.lastMessage
  if (!last) return <span className="italic text-slate-400">{lang === 'ru' ? 'Нет сообщений' : 'No messages'}</span>

  const type = String(last.type || '').toLowerCase()
  if (type === 'image') return <span className="text-slate-500">📷 {lang === 'ru' ? 'Фото' : 'Photo'}</span>
  if (type === 'voice') return <span className="text-slate-500">🎤 {lang === 'ru' ? 'Голосовое' : 'Voice'}</span>
  if (type === 'invoice') return <span className="text-slate-500">🧾 {lang === 'ru' ? 'Счёт' : 'Invoice'}</span>
  if (type === 'system') return <span className="text-slate-400 italic">{lang === 'ru' ? 'Системное' : 'System'}</span>
  if (['rejection', 'REJECTION'].includes(last.type)) {
    return (
      <span className="flex items-center gap-1 text-red-500">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {last.content || last.message || (lang === 'ru' ? 'Отклонено' : 'Declined')}
      </span>
    )
  }

  const text = last.content || last.message || ''
  return (
    <span className="flex items-center gap-1 truncate">
      {/* Флаг _masked из маппера Фазы 1 — при наведении показываем подсказку */}
      {last._masked && (
        <Lock className="h-3 w-3 text-amber-500 shrink-0" aria-label={lang === 'ru' ? 'Контакт скрыт' : 'Contact hidden'} />
      )}
      <span className="truncate">{text || (lang === 'ru' ? 'Новое сообщение' : 'New message')}</span>
    </span>
  )
}

// ─── Одна строка диалога ──────────────────────────────────────────────────────

function ConversationRow({
  conv,
  isActive,
  lang,
  showListingName,
  showGuestName,
  onSelect,
  onArchive,
  archiveLabel,
}) {
  const unread = conv.unreadCount || 0
  const isAdminChat = conv.type === 'ADMIN_FEEDBACK' || !!conv.adminId
  const coverImg = conv.listing?.images?.[0]
    ? toPublicImageUrl(conv.listing.images[0]) || conv.listing.images[0]
    : null

  const displayName = isAdminChat
    ? (conv.adminName || (lang === 'ru' ? 'Администратор' : 'Administrator'))
    : showGuestName
    ? (conv.renterName || (lang === 'ru' ? 'Клиент' : 'Guest'))
    : (conv.partnerName || (lang === 'ru' ? 'Хозяин' : 'Host'))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(conv.id, conv)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(conv.id, conv)
        }
      }}
      className={cn(
        'p-3 border-b border-slate-100 cursor-pointer transition-colors select-none',
        isActive
          ? 'bg-teal-50 border-l-4 border-l-teal-600'
          : 'hover:bg-slate-50 border-l-4 border-l-transparent',
      )}
    >
      <div className="flex gap-3">
        {/* Превью листинга или иконка */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
          {coverImg ? (
            <img src={coverImg} alt={conv.listing?.title || ''} className="w-full h-full object-cover" />
          ) : isAdminChat ? (
            <Shield className="h-6 w-6 text-indigo-500" />
          ) : (
            <Building2 className="h-6 w-6 text-slate-400" />
          )}
        </div>

        {/* Контент */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            {/* Имя */}
            <p className="font-semibold text-sm text-slate-900 truncate leading-tight">
              {isAdminChat && <Shield className="inline h-3 w-3 text-indigo-500 mr-1 mb-0.5" />}
              {displayName}
            </p>

            {/* Правый угол: статус + badge */}
            <div className="flex items-center gap-1 shrink-0">
              <StatusBadge statusLabel={conv.statusLabel} lang={lang} />
              {unread > 0 && (
                <Badge className="bg-red-500 text-white hover:bg-red-500 h-5 min-w-[1.25rem] px-1.5 text-[10px] font-bold">
                  {unread > 99 ? '99+' : unread}
                </Badge>
              )}
              {onArchive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  title={archiveLabel || (lang === 'ru' ? 'Скрыть' : 'Archive')}
                  onClick={(e) => { e.stopPropagation(); onArchive(conv.id) }}
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Листинг (если нужно) */}
          {showListingName && conv.listing?.title && (
            <p className="text-xs text-teal-600 truncate mb-0.5 font-medium">
              {conv.listing.title}
            </p>
          )}

          {/* Превью последнего сообщения */}
          <p className="text-xs text-slate-500 truncate">
            <LastMessagePreview conv={conv} lang={lang} />
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Фильтр категорий ─────────────────────────────────────────────────────────

function CategoryFilter({ categories, categoryFilter, onCategoryChange, lang = 'ru' }) {
  if (!categories?.length) return null
  return (
    <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-1.5 bg-slate-50/80">
      <button
        type="button"
        onClick={() => onCategoryChange?.(null)}
        className={cn(
          'inline-flex items-center justify-center rounded-lg p-2 border transition-colors',
          !categoryFilter
            ? 'bg-teal-600 text-white border-teal-600'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
        )}
        title={lang === 'ru' ? 'Все категории' : 'All categories'}
        aria-label={lang === 'ru' ? 'Все' : 'All'}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      {categories.map((cat) => {
        const slug = cat.slug
        if (!slug) return null
        const active = categoryFilter === slug
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onCategoryChange?.(slug)}
            className={cn(
              'inline-flex items-center justify-center rounded-lg p-2 border transition-colors',
              active
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
            )}
            title={cat.name || slug}
            aria-label={cat.name || slug}
          >
            <CategoryIcon slug={slug} className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}

// ─── Чистый презентационный компонент ────────────────────────────────────────

/**
 * ConversationListPanel — чисто презентационный, данные передаются снаружи.
 * Используется в Фазе 4 через умную обёртку ConversationList.
 *
 * @param {Object}    props
 * @param {Array}     props.conversations         — отфильтрованный список
 * @param {string}    [props.selectedId]          — активный conversationId
 * @param {Function}  [props.onSelect]            — (id, conv) => void
 * @param {Array}     [props.categories]          — список категорий {id, slug, name}
 * @param {string}    [props.categoryFilter]      — активный slug фильтра
 * @param {Function}  [props.onCategoryChange]    — (slug|null) => void
 * @param {string}    [props.inboxTab]            — INBOX_TAB_HOSTING | INBOX_TAB_TRAVELING
 * @param {Function}  [props.onInboxTabChange]    — (tab) => void
 * @param {number}    [props.hostingUnread]
 * @param {number}    [props.travelingUnread]
 * @param {boolean}   [props.hasMore]             — есть ли ещё страницы
 * @param {boolean}   [props.isLoadingMore]       — идёт подгрузка
 * @param {Function}  [props.onLoadMore]          — триггер загрузки следующей страницы
 * @param {boolean}   [props.isLoading]           — первичная загрузка
 * @param {boolean}   [props.showListingName]     — показать название листинга в строке
 * @param {boolean}   [props.showGuestName]       — показать гостя (иначе хозяина)
 * @param {Function}  [props.onArchive]           — (id) => void — скрыть диалог
 * @param {string}    [props.archivedHref]        — ссылка на архив
 * @param {string}    [props.language]            — 'ru' | 'en'
 * @param {string}    [props.title]               — заголовок панели
 * @param {string}    [props.className]
 */
export function ConversationListPanel({
  conversations = [],
  selectedId,
  onSelect,
  categories = [],
  categoryFilter,
  onCategoryChange,
  inboxTab = null,
  onInboxTabChange,
  hostingUnread = 0,
  travelingUnread = 0,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isLoading = false,
  showListingName = false,
  showGuestName = false,
  onArchive,
  archivedHref,
  language = 'ru',
  title,
  className,
}) {
  const sentinelRef = useRef(null)

  // Infinite scroll — IntersectionObserver на sentinel в хвосте списка
  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && !isLoadingMore) onLoadMore() },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore])

  const isRu = language !== 'en'
  const emptyText = isRu ? 'Диалогов пока нет' : 'No conversations yet'

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* ── Шапка панели ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-4 border-b bg-gradient-to-r from-teal-500 to-cyan-500">
        <h2 className="text-lg font-bold text-white leading-tight">
          {title || (isRu ? 'Сообщения' : 'Messages')}
        </h2>
        <p className="text-teal-100 text-xs mt-0.5">
          {conversations.length}{' '}
          {isRu ? (conversations.length === 1 ? 'диалог' : 'диалогов') : 'conversations'}
        </p>

        {/* Вкладки Hosting / Traveling */}
        {inboxTab != null && typeof onInboxTabChange === 'function' && (
          <div className="mt-3 rounded-lg bg-white/15 p-1.5 backdrop-blur-sm">
            <ChatInboxRoleTabs
              value={inboxTab}
              onChange={onInboxTabChange}
              hostingUnread={hostingUnread}
              travelingUnread={travelingUnread}
              language={language}
            />
          </div>
        )}

        {/* Ссылка на архив */}
        {archivedHref && (
          <Link
            href={archivedHref}
            className="text-teal-100 text-xs underline underline-offset-2 hover:text-white mt-1.5 inline-block"
          >
            {isRu ? 'Архив' : 'Archive'}
          </Link>
        )}
      </div>

      {/* ── Фильтр по категориям ───────────────────────────────────────── */}
      <CategoryFilter
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryChange={onCategoryChange}
        lang={language}
      />

      {/* ── Список ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isLoading && conversations.length === 0 && (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400">{emptyText}</p>
        )}

        {conversations.map((conv) => (
          <ConversationRow
            key={conv.id}
            conv={conv}
            isActive={conv.id === selectedId}
            lang={language}
            showListingName={showListingName}
            showGuestName={showGuestName}
            onSelect={onSelect}
            onArchive={onArchive}
          />
        ))}

        {/* Sentinel для IntersectionObserver */}
        {hasMore && (
          <div ref={sentinelRef} className="py-4 flex justify-center">
            {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-teal-400" />}
          </div>
        )}
        {!hasMore && conversations.length > 0 && (
          <p className="py-3 text-center text-[11px] text-slate-400">
            {isRu ? 'Все диалоги загружены' : 'All conversations loaded'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Умная обёртка, подключённая к useConversationInbox ──────────────────────

/**
 * ConversationList — «умный» компонент.
 * Принимает объект `inbox` (возвращаемый useConversationInbox из Фазы 2)
 * и остальные props для конфигурации UI.
 *
 * @param {Object}   props
 * @param {Object}   props.inbox            — объект из useConversationInbox
 * @param {string}   [props.selectedId]
 * @param {Function} [props.onSelect]
 * @param {Array}    [props.categories]     — из /api/v2/categories
 * @param {boolean}  [props.showListingName]
 * @param {boolean}  [props.showGuestName]
 * @param {Function} [props.onArchive]
 * @param {string}   [props.archivedHref]
 * @param {string}   [props.language]
 * @param {string}   [props.title]
 * @param {string}   [props.className]
 * @param {boolean}  [props.roleTabsVisible] — false: только «Снимаю», без переключателя Сдаю/Снимаю (единый холл для рентора)
 */
export function ConversationList({
  inbox,
  selectedId,
  onSelect,
  categories,
  showListingName,
  showGuestName,
  onArchive,
  archivedHref,
  language = 'ru',
  title,
  className,
  roleTabsVisible = true,
}) {
  if (!inbox) return null

  return (
    <ConversationListPanel
      conversations={inbox.filteredConversations}
      selectedId={selectedId}
      onSelect={onSelect}
      categories={categories}
      categoryFilter={inbox.categoryFilter}
      onCategoryChange={inbox.setCategoryFilter}
      inboxTab={inbox.inboxTab}
      onInboxTabChange={roleTabsVisible ? inbox.setInboxTab : undefined}
      hostingUnread={inbox.hostingUnread}
      travelingUnread={inbox.travelingUnread}
      hasMore={inbox.hasMore}
      isLoadingMore={inbox.isLoadingMore}
      onLoadMore={inbox.loadMore}
      isLoading={inbox.isLoading}
      showListingName={showListingName}
      showGuestName={showGuestName}
      onArchive={onArchive}
      archivedHref={archivedHref}
      language={language}
      title={title}
      className={className}
    />
  )
}
