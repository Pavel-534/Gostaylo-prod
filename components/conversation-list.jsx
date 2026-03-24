'use client'

import Link from 'next/link'
import * as LucideIcons from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Archive, Building2, LayoutGrid, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { ChatInboxRoleTabs } from '@/components/chat-inbox-role-tabs'

/**
 * Соответствие slug категории из БД → имя экспорта lucide-react (PascalCase).
 * Неизвестные slug пробуются как PascalCase от сегментов slug; иначе Tag.
 */
const SLUG_TO_LUCIDE = {
  nanny: 'Baby',
  babysitter: 'Baby',
  food: 'UtensilsCrossed',
  dining: 'UtensilsCrossed',
  restaurant: 'UtensilsCrossed',
  apartment: 'Building2',
  villa: 'Home',
  house: 'Home',
  transport: 'Car',
  cleaning: 'Sparkles',
  tour: 'Map',
  default: 'Tag',
}

function slugToPascal(slug) {
  return String(slug || '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('')
}

export function resolveCategoryLucideName(slug) {
  if (!slug) return 'LayoutGrid'
  const key = String(slug).toLowerCase()
  if (SLUG_TO_LUCIDE[key]) return SLUG_TO_LUCIDE[key]
  const pascal = slugToPascal(slug)
  if (LucideIcons[pascal]) return pascal
  return SLUG_TO_LUCIDE.default
}

export function CategoryFilterIcon({ slug, className }) {
  const name = slug ? resolveCategoryLucideName(slug) : 'LayoutGrid'
  const Icon = LucideIcons[name] || LucideIcons.Tag
  return <Icon className={className} />
}

/**
 * Сайдбар диалогов + чипы фильтра по listing_category (slug из categories API).
 */
export function ConversationList({
  conversations = [],
  selectedId,
  onSelect,
  categoryFilter,
  onCategoryChange,
  categories = [],
  /** Партнёрский сайдбар: под именем гостя — «Вопрос по: [название объекта]». */
  partnerSidebar = false,
  /** В режиме гостя в списке показываем имя хозяина (partnerName), не гостя. */
  partnerListAsGuest = false,
  sidebarLang = 'ru',
  /** Скрыть диалог у себя в списке (архив); не удаляет историю для собеседника. */
  onArchiveConversation = null,
  archiveLabel = 'Скрыть из списка',
  /** Ссылка на экран архивных диалогов (нагрузка только при переходе). */
  archivedListHref = null,
  archivedListLabel = 'Архив',
  /** Вкладки Hosting / Traveling (партнёр и т.п.): если заданы — показываем переключатель над списком. */
  inboxTab = null,
  onInboxTabChange = null,
  hostingUnread = 0,
  travelingUnread = 0,
  inboxTabsLang = 'ru',
}) {
  return (
    <div
      className={`w-full lg:w-80 bg-white border-r flex-shrink-0 ${
        selectedId ? 'hidden lg:flex' : 'flex'
      } flex-col`}
    >
      <div className="p-4 border-b bg-gradient-to-r from-teal-500 to-cyan-500">
        <h2 className="text-xl font-bold text-white">Сообщения</h2>
        <p className="text-teal-100 text-sm">{conversations.length} диалогов</p>
        {inboxTab != null && typeof onInboxTabChange === 'function' ? (
          <div className="mt-3 rounded-lg bg-white/15 p-1.5 backdrop-blur-sm">
            <ChatInboxRoleTabs
              value={inboxTab}
              onChange={onInboxTabChange}
              hostingUnread={hostingUnread}
              travelingUnread={travelingUnread}
              language={inboxTabsLang}
            />
          </div>
        ) : null}
        {archivedListHref ? (
          <Link
            href={archivedListHref}
            className="text-teal-50 text-xs font-medium underline underline-offset-2 hover:text-white mt-1.5 inline-block"
          >
            {archivedListLabel}
          </Link>
        ) : null}
      </div>

      {categories.length > 0 && (
        <div className="px-3 py-2 border-b flex flex-wrap gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={() => onCategoryChange?.(null)}
            className={`inline-flex items-center justify-center rounded-lg p-2 border transition-colors ${
              !categoryFilter
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Все"
            aria-label="Все категории"
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
                className={`inline-flex items-center justify-center rounded-lg p-2 border transition-colors ${
                  active
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={cat.name || slug}
                aria-label={cat.name || slug}
              >
                <CategoryFilterIcon slug={slug} className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            {inboxTab != null
              ? inboxTabsLang === 'en'
                ? 'No conversations in this tab.'
                : 'В этой вкладке нет диалогов.'
              : inboxTabsLang === 'en'
                ? 'No conversations yet.'
                : 'Пока нет диалогов.'}
          </div>
        ) : null}
        {conversations.map((conv) => {
          const isActive = conv.id === selectedId
          const unread = conv.unreadCount || 0
          const isAdminChat = conv.type === 'ADMIN_FEEDBACK' || conv.adminId

          return (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(conv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(conv.id)
                }
              }}
              className={`p-4 border-b cursor-pointer transition-colors ${
                isActive ? 'bg-teal-50 border-l-4 border-l-teal-600' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex gap-3">
                {conv.listing?.images?.[0] ? (
                  <img
                    src={toPublicImageUrl(conv.listing.images[0]) || conv.listing.images[0]}
                    alt={conv.listing.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                    {isAdminChat ? (
                      <Shield className="h-6 w-6 text-indigo-500" />
                    ) : (
                      <Building2 className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {isAdminChat ? (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-indigo-500" />
                            {conv.adminName || 'Администратор'}
                          </span>
                        ) : partnerSidebar && partnerListAsGuest ? (
                          conv.partnerName || (sidebarLang === 'en' ? 'Host' : 'Хозяин')
                        ) : (
                          conv.renterName || 'Клиент'
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {unread > 0 && <Badge className="bg-red-500 text-white">{unread}</Badge>}
                      {onArchiveConversation ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-800"
                          title={archiveLabel}
                          aria-label={archiveLabel}
                          onClick={(e) => {
                            e.stopPropagation()
                            onArchiveConversation(conv.id, e)
                          }}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {conv.listing?.title && (
                    <p className="text-xs text-slate-500 truncate mb-1">
                      {partnerSidebar
                        ? `${getUIText('queryAboutListingPrefix', sidebarLang)} ${conv.listing.title}`
                        : conv.listing.title}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    {['rejection', 'REJECTION'].includes(conv.lastMessage?.type) && (
                      <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    {conv.lastMessage?.content || conv.lastMessage?.message || 'Новое сообщение'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
