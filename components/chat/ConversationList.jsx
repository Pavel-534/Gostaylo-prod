'use client'

/**
 * @file components/chat/ConversationList.jsx
 *
 * Сайдбар списка диалогов: вкладки Hosting/Traveling, поиск, фильтр (все / непрочитанные / избранные),
 * бесконечная подгрузка, избранное через API (useConversationInbox).
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronDown,
  House,
  Loader2,
  Lock,
  Search,
  Shield,
  AlertTriangle,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { formatDisplayDate } from '@/lib/date-display-format'
import { ChatInboxRoleTabs } from '@/components/chat-inbox-role-tabs'
import { isFavoriteConversationId } from '@/lib/chat-inbox-favorites'
import { useAuth } from '@/contexts/auth-context'
import { usePresenceContext } from '@/lib/context/PresenceContext'
import { useChatContext } from '@/lib/context/ChatContext'

const LIST_FILTER_ALL = 'all'
const LIST_FILTER_UNREAD = 'unread'
const LIST_FILTER_STARRED = 'starred'

// ─── Статус-бейдж ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  PENDING: { ru: 'Ожидает', en: 'Pending', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  CONFIRMED: { ru: 'Подтверждено', en: 'Confirmed', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  PAID: { ru: 'Оплачено', en: 'Paid', cls: 'bg-green-100 text-green-800 border-green-200' },
  COMPLETED: { ru: 'Завершено', en: 'Completed', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCELLED: { ru: 'Отменено', en: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-200' },
  REFUNDED: { ru: 'Возврат', en: 'Refunded', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
}

function StatusBadge({ statusLabel, lang = 'ru' }) {
  if (!statusLabel) return null
  const cfg = STATUS_CFG[String(statusLabel).toUpperCase()]
  if (!cfg) return null
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-2xl border shrink-0',
        cfg.cls,
      )}
    >
      {lang === 'en' ? cfg.en : cfg.ru}
    </span>
  )
}

function DealPreviewLine({ conv, lang = 'ru' }) {
  const booking = conv.booking
  const title = conv.listing?.title?.trim()
  const cin = booking?.check_in ?? booking?.checkIn
  const cout = booking?.check_out ?? booking?.checkOut
  if (!title && !cin && !cout) return null
  let dates = ''
  try {
    const a = cin ? formatDisplayDate(cin) : ''
    const b = cout ? formatDisplayDate(cout) : ''
    dates = [a, b].filter(Boolean).join(' — ')
  } catch {
    dates = ''
  }
  const parts = [dates, title].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="text-[11px] text-slate-600 truncate mb-0.5 leading-tight" title={parts.join(' · ')}>
      {parts.join(' · ')}
    </p>
  )
}

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
      {last._masked && (
        <Lock className="h-3 w-3 text-amber-500 shrink-0" aria-label={lang === 'ru' ? 'Контакт скрыт' : 'Contact hidden'} />
      )}
      <span className="truncate">{text || (lang === 'ru' ? 'Новое сообщение' : 'New message')}</span>
    </span>
  )
}

function PresenceLabel({ peerOnline, peerLastSeenAt, lang = 'ru' }) {
  if (peerOnline) {
    return <span className="text-[11px] text-emerald-600">{lang === 'ru' ? 'В сети' : 'Online'}</span>
  }
  if (!peerLastSeenAt) return null
  try {
    const rel = formatDistanceToNow(new Date(peerLastSeenAt), {
      addSuffix: true,
      locale: lang === 'en' ? undefined : ruLocale,
    })
    return (
      <span className="text-[11px] text-slate-400">
        {lang === 'ru' ? `Был(а) в сети ${rel}` : `Last seen ${rel}`}
      </span>
    )
  } catch {
    return null
  }
}

function conversationSearchHaystack(conv, showGuestName, lang) {
  const isAdminChat = conv.type === 'ADMIN_FEEDBACK' || !!conv.adminId
  const displayName = isAdminChat
    ? (conv.adminName || (lang === 'ru' ? 'Администратор' : 'Administrator'))
    : showGuestName
      ? (conv.renterName || (lang === 'ru' ? 'Клиент' : 'Guest'))
      : (conv.partnerName || (lang === 'ru' ? 'Хозяин' : 'Host'))
  const parts = [displayName, conv.listing?.title, conv.listing?.slug]
  const last = conv.lastMessage
  if (last?.content) parts.push(String(last.content))
  if (last?.message) parts.push(String(last.message))
  return parts.filter(Boolean).join(' ').toLowerCase()
}

function ConversationRow({
  conv,
  isActive,
  lang,
  showListingName,
  showGuestName,
  onSelect,
  onArchive,
  onUnarchive,
  archiveLabel,
  unarchiveLabel,
  isFavorite,
  favoriteSaving,
  onToggleFavorite,
  peerOnline = false,
  peerLastSeenAt = null,
  typingName = null,
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
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
          {coverImg ? (
            <img src={coverImg} alt={conv.listing?.title || ''} className="w-full h-full object-cover" />
          ) : isAdminChat ? (
            <Shield className="h-6 w-6 text-indigo-500" />
          ) : (
            <Building2 className="h-6 w-6 text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <p className="font-semibold text-sm text-slate-900 truncate leading-tight">
              {isAdminChat && <Shield className="inline h-3 w-3 text-indigo-500 mr-1 mb-0.5" />}
              {displayName}
              {peerOnline ? (
                <span
                  className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle shadow-[0_0_0_2px_rgba(16,185,129,0.22)]"
                  aria-label={lang === 'ru' ? 'Собеседник в сети' : 'Peer online'}
                />
              ) : null}
            </p>

            <div className="flex items-center gap-0.5 shrink-0">
              <StatusBadge statusLabel={conv.statusLabel} lang={lang} />
              {unread > 0 && (
                <Badge className="bg-red-500 text-white hover:bg-red-500 h-5 min-w-[1.25rem] px-1.5 text-[10px] font-bold">
                  {unread > 99 ? '99+' : unread}
                </Badge>
              )}
              {onToggleFavorite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={favoriteSaving}
                  className={cn(
                    'h-7 w-7',
                    isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-500',
                  )}
                  title={lang === 'ru' ? 'В избранное' : 'Favorite'}
                  aria-label={lang === 'ru' ? 'Избранное' : 'Favorite'}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!favoriteSaving) onToggleFavorite(conv.id)
                  }}
                >
                  {favoriteSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  ) : (
                    <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} />
                  )}
                </Button>
              ) : null}
              {onUnarchive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-teal-600"
                  title={unarchiveLabel || (lang === 'ru' ? 'Вернуть в инбокс' : 'Restore to inbox')}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnarchive(conv.id)
                  }}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </Button>
              )}
              {onArchive && !onUnarchive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  title={archiveLabel || (lang === 'ru' ? 'Скрыть' : 'Archive')}
                  onClick={(e) => {
                    e.stopPropagation()
                    onArchive(conv.id)
                  }}
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <DealPreviewLine conv={conv} lang={lang} />

          {showListingName && conv.listing?.title && (
            <p className="text-xs text-teal-600 truncate mb-0.5 font-medium">{conv.listing.title}</p>
          )}

          {typingName ? (
            <p className="text-xs text-teal-600 truncate animate-pulse">
              {lang === 'ru' ? `${typingName} печатает…` : `${typingName} is typing…`}
            </p>
          ) : (
            <p className="text-xs text-slate-500 truncate">
              <LastMessagePreview conv={conv} lang={lang} />
            </p>
          )}
          <PresenceLabel peerOnline={peerOnline} peerLastSeenAt={peerLastSeenAt} lang={lang} />
        </div>
      </div>
    </div>
  )
}

function InboxSearchFilterBar({
  searchQuery,
  onSearchChange,
  listFilter,
  onListFilterChange,
  language,
  showStarredOption = true,
}) {
  const isRu = language !== 'en'
  const labels = {
    [LIST_FILTER_ALL]: isRu ? 'Все' : 'All',
    [LIST_FILTER_UNREAD]: isRu ? 'Непрочитанные' : 'Unread',
    [LIST_FILTER_STARRED]: isRu ? 'Избранные' : 'Starred',
  }

  const filterKeys = showStarredOption
    ? [LIST_FILTER_ALL, LIST_FILTER_UNREAD, LIST_FILTER_STARRED]
    : [LIST_FILTER_ALL, LIST_FILTER_UNREAD]

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-4 py-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isRu ? 'Поиск…' : 'Search…'}
          className="h-9 pl-8 pr-2 text-sm border-slate-200 bg-slate-50/80 focus-visible:bg-white"
          autoComplete="off"
          aria-label={isRu ? 'Поиск по диалогам' : 'Search conversations'}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1 border-slate-200 px-2.5 text-xs font-medium text-slate-700"
          >
            {labels[listFilter] || labels[LIST_FILTER_ALL]}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {filterKeys.map((key) => (
            <DropdownMenuItem
              key={key}
              className="text-sm cursor-pointer"
              onClick={() => onListFilterChange(key)}
            >
              {labels[key]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function ConversationListPanel({
  conversations = [],
  selectedId,
  onSelect,
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
  onUnarchive,
  headerActionHref,
  headerActionLabel,
  language = 'ru',
  title,
  className,
  searchQuery = '',
  onSearchChange,
  listFilter = LIST_FILTER_ALL,
  onListFilterChange,
  favoriteIdSet = null,
  favoriteTogglePendingIds = [],
  onToggleFavorite,
  showStarredFilter = true,
  catalogHref = '/listings',
  viewerId = null,
  isUserOnline = null,
  typingByConversation = {},
}) {
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) onLoadMore()
      },
      { threshold: 0.1, rootMargin: '80px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore])

  const isRu = language !== 'en'
  const emptyDefault = isRu ? 'Диалогов пока нет' : 'No conversations yet'
  const emptyFiltered = isRu ? 'Нет подходящих диалогов' : 'No matching conversations'
  const emptyStarred = isRu ? 'Нет избранных диалогов' : 'No starred conversations'

  let emptyText = emptyDefault
  if (listFilter === LIST_FILTER_STARRED) emptyText = emptyStarred
  else if (listFilter === LIST_FILTER_UNREAD || (searchQuery && searchQuery.trim())) {
    emptyText = emptyFiltered
  }

  return (
    <div className={cn('flex min-h-0 h-full flex-col', className)}>
      <div className="flex shrink-0 flex-col border-b border-slate-200 bg-white">
        {catalogHref ? (
          <div className="flex items-center gap-2 border-b border-slate-100 bg-teal-50/60 px-4 py-1.5">
            <Link
              href={catalogHref}
              className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 text-sm font-semibold text-teal-800 hover:text-teal-900"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold text-white">
                G
              </span>
              <House className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
              <span className="truncate">{isRu ? 'Каталог и поиск' : 'Browse & search'}</span>
            </Link>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight text-slate-900">
              {title || (isRu ? 'Сообщения' : 'Messages')}
            </h2>
            <p className="text-[11px] leading-tight text-slate-500">
              {conversations.length}{' '}
              {isRu ? (conversations.length === 1 ? 'диалог' : 'диалогов') : 'conversations'}
            </p>
          </div>
          {headerActionHref ? (
            <Link
              href={headerActionHref}
              className="shrink-0 text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              {headerActionLabel || (isRu ? 'Архив' : 'Archive')}
            </Link>
          ) : null}
        </div>
        {inboxTab != null && typeof onInboxTabChange === 'function' ? (
          <div className="border-t border-slate-100 bg-white px-3 py-1.5 sm:px-4">
            <ChatInboxRoleTabs
              value={inboxTab}
              onChange={onInboxTabChange}
              hostingUnread={hostingUnread}
              travelingUnread={travelingUnread}
              language={language}
              dense
            />
          </div>
        ) : null}
      </div>

      {typeof onSearchChange === 'function' && typeof onListFilterChange === 'function' ? (
        <InboxSearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          listFilter={listFilter}
          onListFilterChange={onListFilterChange}
          language={language}
          showStarredOption={showStarredFilter}
        />
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
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
            onUnarchive={onUnarchive}
            isFavorite={favoriteIdSet ? isFavoriteConversationId(conv.id, favoriteIdSet) : false}
            favoriteSaving={favoriteTogglePendingIds.includes(String(conv.id))}
            onToggleFavorite={onToggleFavorite}
            peerOnline={
              typeof isUserOnline === 'function' && viewerId
                ? isUserOnline(resolvePeerId(conv, viewerId))
                : false
            }
            peerLastSeenAt={viewerId ? resolvePeerLastSeenAt(conv, viewerId) : null}
            typingName={typingByConversation?.[String(conv.id)]?.name || null}
          />
        ))}

        {hasMore && (
          <div ref={sentinelRef} className="py-4 flex min-h-[2.5rem] justify-center">
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

export function ConversationList({
  inbox,
  selectedId,
  onSelect,
  showListingName,
  showGuestName,
  onArchive,
  onUnarchive,
  headerActionHref,
  headerActionLabel,
  language = 'ru',
  title,
  className,
  roleTabsVisible = true,
  /** На странице архива API избранного не сочетается с archived=only — фильтр «Избранные» скрыт */
  favoritesFilterEnabled = true,
  /** Ссылка на каталог; null — скрыть полосу «К каталогу» */
  catalogHref = '/listings',
}) {
  const { user } = useAuth()
  const { isUserOnline } = usePresenceContext()
  const { typingByConversation } = useChatContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [listFilter, setListFilter] = useState(LIST_FILTER_ALL)

  const setFavoriteOnlyFetch = inbox.setFavoriteOnlyFetch
  useEffect(() => {
    if (!favoritesFilterEnabled && listFilter === LIST_FILTER_STARRED) {
      setListFilter(LIST_FILTER_ALL)
    }
  }, [favoritesFilterEnabled, listFilter])

  useEffect(() => {
    setFavoriteOnlyFetch?.(favoritesFilterEnabled && listFilter === LIST_FILTER_STARRED)
  }, [listFilter, setFavoriteOnlyFetch, favoritesFilterEnabled])

  const displayConversations = useMemo(() => {
    let list = inbox.filteredConversations
    if (listFilter === LIST_FILTER_UNREAD) list = list.filter((c) => (c.unreadCount || 0) > 0)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const showGuest = showGuestName
      list = list.filter((c) => conversationSearchHaystack(c, showGuest, language).includes(q))
    }
    return list
  }, [inbox.filteredConversations, listFilter, searchQuery, showGuestName, language])

  if (!inbox) return null

  return (
    <ConversationListPanel
      conversations={displayConversations}
      selectedId={selectedId}
      onSelect={onSelect}
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
      onUnarchive={onUnarchive}
      headerActionHref={headerActionHref}
      headerActionLabel={headerActionLabel}
      language={language}
      title={title}
      className={className}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      listFilter={listFilter}
      onListFilterChange={setListFilter}
      favoriteIdSet={inbox.favoriteIdSet}
      favoriteTogglePendingIds={inbox.favoriteTogglePendingIds}
      onToggleFavorite={favoritesFilterEnabled ? inbox.toggleFavorite : undefined}
      showStarredFilter={favoritesFilterEnabled}
      catalogHref={catalogHref}
      viewerId={user?.id ?? null}
      isUserOnline={isUserOnline}
      typingByConversation={typingByConversation}
    />
  )
}

function resolvePeerId(conv, viewerId) {
  const me = String(viewerId || '')
  const partnerId = conv?.partnerId ?? conv?.partner_id
  const ownerId = conv?.ownerId ?? conv?.owner_id
  const renterId = conv?.renterId ?? conv?.renter_id
  const adminId = conv?.adminId ?? conv?.admin_id
  if (adminId && String(adminId) !== me) return String(adminId)
  if (String(renterId || '') === me) return String(partnerId || ownerId || '')
  if (String(partnerId || '') === me || String(ownerId || '') === me) return String(renterId || '')
  if (partnerId && String(partnerId) !== me) return String(partnerId)
  if (ownerId && String(ownerId) !== me) return String(ownerId)
  if (renterId && String(renterId) !== me) return String(renterId)
  return ''
}

function resolvePeerLastSeenAt(conv, viewerId) {
  const me = String(viewerId || '')
  const partnerId = String(conv?.partnerId ?? conv?.partner_id ?? '')
  const ownerId = String(conv?.ownerId ?? conv?.owner_id ?? '')
  const renterId = String(conv?.renterId ?? conv?.renter_id ?? '')
  const adminId = String(conv?.adminId ?? conv?.admin_id ?? '')
  if (adminId && adminId !== me) return conv?.adminLastSeenAt ?? conv?.admin_last_seen_at ?? null
  if (renterId === me) {
    return conv?.partnerLastSeenAt ?? conv?.partner_last_seen_at ?? conv?.ownerLastSeenAt ?? null
  }
  if (partnerId === me || ownerId === me) {
    return conv?.renterLastSeenAt ?? conv?.renter_last_seen_at ?? null
  }
  return conv?.partnerLastSeenAt ?? conv?.renterLastSeenAt ?? null
}
