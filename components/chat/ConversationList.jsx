'use client'

/**
 * @file components/chat/ConversationList.jsx
 *
 * Сайдбар списка диалогов: вкладки Hosting/Traveling, поиск, фильтр (все / непрочитанные / избранные),
 * бесконечная подгрузка, избранное через API (useConversationInbox).
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ru as ruLocale, enUS, th as thLocale, zhCN } from 'date-fns/locale'
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
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import { formatDisplayDate } from '@/lib/date-display-format'
import { ChatInboxRoleTabs } from '@/components/chat-inbox-role-tabs'
import { isFavoriteConversationId } from '@/lib/chat-inbox-favorites'
import { useAuth } from '@/contexts/auth-context'
import { usePresenceContext } from '@/lib/context/PresenceContext'
import { useChatContext } from '@/lib/context/ChatContext'
import { getUIText } from '@/lib/translations'
import { resolveConversationDealBadge } from '@/lib/chat/conversation-inbox-status'

const LIST_FILTER_ALL = 'all'
const LIST_FILTER_UNREAD = 'unread'
const LIST_FILTER_STARRED = 'starred'

function tx(key, lang, extras) {
  const raw = getUIText(key, lang)
  if (!extras || typeof extras !== 'object') return raw
  return Object.entries(extras).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? '')),
    raw,
  )
}

function dateFnsLocaleForLang(lang) {
  if (lang === 'th') return thLocale
  if (lang === 'zh') return zhCN
  if (lang === 'en') return enUS
  return ruLocale
}

const STATUS_BADGE_CLS = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAID: 'bg-green-100 text-green-800 border-green-200',
  PAID_ESCROW: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_IN: 'bg-sky-100 text-sky-800 border-sky-200',
  DISPUTED: 'bg-amber-100 text-amber-900 border-amber-300',
  COMPLETED: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  REFUNDED: 'bg-purple-100 text-purple-700 border-purple-200',
}

function statusBadgeLabel(statusKey, lang = 'ru') {
  const key = String(statusKey || '').toUpperCase()
  const i18nKey = `chatBookingStatus_${key}`
  const translated = getUIText(i18nKey, lang)
  return translated !== i18nKey ? translated : null
}

function defaultPeerDisplayName(conv, showGuestName, lang) {
  const isAdminChat = conv.type === 'ADMIN_FEEDBACK' || !!conv.adminId
  if (isAdminChat) return conv.adminName || getUIText('messengerThread_labelSupport', lang)
  if (showGuestName) return conv.renterName || getUIText('messengerThread_labelGuest', lang)
  return conv.partnerName || getUIText('messengerThread_labelHost', lang)
}

function StatusBadge({ statusLabel, lang = 'ru' }) {
  if (!statusLabel) return null
  const key = String(statusLabel).toUpperCase()
  const cls = STATUS_BADGE_CLS[key]
  const label = statusBadgeLabel(key, lang)
  if (!cls || !label) return null
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-2xl border shrink-0',
        cls,
      )}
    >
      {label}
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

function DealStatusBadge({ conv, lang = 'ru' }) {
  const kind = resolveConversationDealBadge(conv)
  if (!kind) return null

  const cfgByKind = {
    invoice_pending: {
      key: 'inboxBadge_invoicePending',
      cls: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    invoice_paid: {
      key: 'inboxBadge_invoicePaid',
      cls: 'bg-green-100 text-green-800 border-green-200',
    },
    inquiry_dates: {
      key: 'inboxBadge_inquiryDates',
      cls: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  }
  const cfg = cfgByKind[kind]
  if (!cfg) return null

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-2xl border px-1.5 py-0.5 text-[10px] font-semibold leading-none',
        cfg.cls,
      )}
    >
      {getUIText(cfg.key, lang)}
    </span>
  )
}

function LastMessagePreview({ conv, lang = 'ru' }) {
  const last = conv.lastMessage
  if (!last) {
    return <span className="italic text-slate-400">{getUIText('chatListPreview_noMessages', lang)}</span>
  }

  const type = String(last.type || '').toLowerCase()
  if (type === 'image') {
    return (
      <span className="text-slate-500">
        📷 {getUIText('chatListPreview_photo', lang)}
      </span>
    )
  }
  if (type === 'voice') {
    return (
      <span className="text-slate-500">
        🎤 {getUIText('chatListPreview_voice', lang)}
      </span>
    )
  }
  if (type === 'invoice') {
    return <span className="text-slate-500">{getUIText('chatListPreview_invoice', lang)}</span>
  }
  if (type === 'system') {
    return <span className="text-slate-400 italic">{getUIText('chatListPreview_system', lang)}</span>
  }
  if (['rejection', 'REJECTION'].includes(last.type)) {
    return (
      <span className="flex items-center gap-1 text-red-500">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {last.content || last.message || getUIText('chatListPreview_declined', lang)}
      </span>
    )
  }

  const text = last.content || last.message || ''
  return (
    <span className="flex items-center gap-1 truncate">
      {last._masked && (
        <Lock
          className="h-3 w-3 text-amber-500 shrink-0"
          aria-label={getUIText('chatListPreview_contactHidden', lang)}
        />
      )}
      <span className="truncate">{text || getUIText('chatListPreview_newMessage', lang)}</span>
    </span>
  )
}

function PresenceLabel({ peerOnline, peerLastSeenAt, lang = 'ru' }) {
  if (peerOnline) {
    return <span className="text-[11px] text-emerald-600">{getUIText('chatOnline', lang)}</span>
  }
  if (!peerLastSeenAt) return null
  try {
    const rel = formatDistanceToNow(new Date(peerLastSeenAt), {
      addSuffix: true,
      locale: dateFnsLocaleForLang(lang),
    })
    return (
      <span className="text-[11px] text-slate-400">
        {tx('chatListPreview_lastSeen', lang, { time: rel })}
      </span>
    )
  } catch {
    return null
  }
}

function conversationSearchHaystack(conv, showGuestName, lang) {
  const displayName = defaultPeerDisplayName(conv, showGuestName, lang)
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
    ? resolveImageThumbDisplayUrl(conv.listing.images[0]) || conv.listing.images[0]
    : null

  const displayName = defaultPeerDisplayName(conv, showGuestName, lang)

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
          ? 'bg-brand/10 border-l-4 border-l-brand'
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
                  aria-label={getUIText('chatList_ariaPeerOnline', lang)}
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
                    'min-h-[44px] min-w-[44px] h-11 w-11',
                    isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-500',
                  )}
                  title={getUIText('chatList_favoriteTitle', lang)}
                  aria-label={getUIText('chatList_ariaFavorite', lang)}
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
                  className="min-h-[44px] min-w-[44px] h-11 w-11 text-slate-400 hover:text-brand"
                  title={unarchiveLabel || getUIText('chatList_restoreInbox', lang)}
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
                  className="min-h-[44px] min-w-[44px] h-11 w-11 text-slate-400 hover:text-slate-600"
                  title={archiveLabel || getUIText('chatList_archive', lang)}
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
            <p className="text-xs text-brand truncate mb-0.5 font-medium">{conv.listing.title}</p>
          )}

          {typingName ? (
            <p className="text-xs text-brand truncate animate-pulse">
              {tx('chatList_typing', lang, { name: typingName })}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
              <DealStatusBadge conv={conv} lang={lang} />
              <span className="min-w-0 truncate">
                <LastMessagePreview conv={conv} lang={lang} />
              </span>
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
  const filterLabelKey = {
    [LIST_FILTER_ALL]: 'chatInbox_filterAll',
    [LIST_FILTER_UNREAD]: 'chatInbox_filterUnread',
    [LIST_FILTER_STARRED]: 'chatInbox_filterStarred',
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
          placeholder={getUIText('chatInbox_searchPlaceholder', language)}
          className="h-9 pl-8 pr-2 text-sm border-slate-200 bg-slate-50/80 focus-visible:bg-white"
          autoComplete="off"
          aria-label={getUIText('chatInbox_searchAria', language)}
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
            {getUIText(filterLabelKey[listFilter] || filterLabelKey[LIST_FILTER_ALL], language)}
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
              {getUIText(filterLabelKey[key], language)}
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

  let emptyText = getUIText('chatInbox_emptyDefault', language)
  if (listFilter === LIST_FILTER_STARRED) emptyText = getUIText('chatInbox_emptyStarred', language)
  else if (listFilter === LIST_FILTER_UNREAD || (searchQuery && searchQuery.trim())) {
    emptyText = getUIText('chatInbox_emptyFiltered', language)
  }

  const conversationCountLabel =
    conversations.length === 1
      ? getUIText('chatInbox_conversationOne', language)
      : getUIText('chatInbox_conversationMany', language)

  return (
    <div className={cn('flex min-h-0 h-full flex-col', className)}>
      <div className="flex shrink-0 flex-col border-b border-slate-200 bg-white">
        {catalogHref ? (
          <div className="flex items-center gap-2 border-b border-slate-100 bg-brand/10 px-4 py-1.5">
            <Link
              href={catalogHref}
              className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 text-sm font-semibold text-brand-hover hover:text-brand"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
                G
              </span>
              <House className="h-4 w-4 shrink-0 text-brand-hover" aria-hidden />
              <span className="truncate">{getUIText('chatInbox_catalogLink', language)}</span>
            </Link>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight text-slate-900">
              {title || getUIText('chatInbox_title', language)}
            </h2>
            <p className="text-[11px] leading-tight text-slate-500">
              {conversations.length} {conversationCountLabel}
            </p>
          </div>
          {headerActionHref ? (
            <Link
              href={headerActionHref}
              className="shrink-0 text-sm font-medium text-brand-hover hover:text-brand-hover"
            >
              {headerActionLabel || getUIText('chatInbox_archiveLink', language)}
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
            <Loader2 className="h-5 w-5 animate-spin text-brand/70" />
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
            {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-brand/60" />}
          </div>
        )}
        {!hasMore && conversations.length > 0 && (
          <p className="py-3 text-center text-[11px] text-slate-400">
            {getUIText('chatAllLoaded', language)}
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
