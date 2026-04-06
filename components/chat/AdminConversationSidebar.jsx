'use client'

import { MessageSquare, Search, User, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { getUIText } from '@/lib/translations'

export function AdminConversationSidebar({
  conversations = [],
  loading = false,
  searchQuery = '',
  onSearchChange,
  priorityOnly = false,
  selectedConversationId = null,
  onSelectConversation,
  searchPlaceholder = 'Поиск…',
  language = 'ru',
}) {
  const t = (key) => getUIText(key, language)
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

  return (
    <Card className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          {language === 'en' ? 'All conversations' : 'Все диалоги'}
          {totalUnread > 0 ? (
            <Badge className="ml-auto bg-red-500">{totalUnread}</Badge>
          ) : null}
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p>{t('chatNoConversations')}</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = String(selectedConversationId) === String(conv.id)
            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConversation?.(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectConversation?.(conv.id)
                  }
                }}
                className={cn(
                  'cursor-pointer border-b p-4 transition-colors',
                  isActive ? 'border-l-4 border-l-indigo-600 bg-indigo-50' : 'hover:bg-slate-50'
                )}
              >
                <div className="flex gap-3">
                  {conv.listing?.images?.[0] ? (
                    <img
                      src={toPublicImageUrl(conv.listing.images[0]) || conv.listing.images[0]}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-200">
                      <User className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {conv.partnerName || conv.renterName || (language === 'en' ? 'User' : 'Пользователь')}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {conv.isPriority ? (
                          <Badge className="bg-amber-500 px-1.5 py-0 text-[10px] text-white">
                            {language === 'en' ? 'Priority' : 'Приоритет'}
                          </Badge>
                        ) : null}
                        {conv.unreadCount > 0 ? (
                          <Badge className="bg-red-500 text-white">{conv.unreadCount}</Badge>
                        ) : null}
                      </div>
                    </div>
                    {conv.listing?.title ? (
                      <p className="mb-1 truncate text-xs text-slate-600">{conv.listing.title}</p>
                    ) : null}
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                      {['rejection', 'REJECTION'].includes(conv.lastMessage?.type) ? (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                      ) : null}
                      {conv.lastMessage?.message || conv.lastMessage?.content || (language === 'en' ? 'New chat' : 'Новый диалог')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
