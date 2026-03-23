'use client'

import Image from 'next/image'
import { Bell } from 'lucide-react'
import { toStorageProxyUrl } from '@/lib/supabase-proxy-urls'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'

export function NotificationBell({ userId = 'renter-1', userRole = 'RENTER' }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    loadNotifications()
    // Poll for new messages every 10 seconds (mock real-time)
    const interval = setInterval(loadNotifications, 10000)
    return () => clearInterval(interval)
  }, [userId, userRole])

  async function loadNotifications() {
    try {
      const res = await fetch(`/api/conversations?userId=${userId}&role=${userRole}`)
      const data = await res.json()
      
      if (data.success) {
        setConversations(data.data || [])
        const total = data.data?.reduce((sum, conv) => {
          return sum + (userRole === 'PARTNER' ? conv.unreadCountPartner : conv.unreadCountRenter)
        }, 0) || 0
        setUnreadCount(total)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">Уведомления</h3>
          {conversations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Нет новых уведомлений
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {conversations.map((conv) => {
                const unread = userRole === 'PARTNER' ? conv.unreadCountPartner : conv.unreadCountRenter
                if (unread === 0) return null
                
                return (
                  <a
                    key={conv.id}
                    href={`/messages/${conv.id}`}
                    className="block p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={toStorageProxyUrl(conv.listing?.images?.[0]) || '/placeholder.svg'}
                          alt={conv.listing?.title || ''}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {conv.listing?.title}
                        </p>
                        <p className="text-xs text-slate-600 truncate">
                          {conv.lastMessage?.message || 'Новое сообщение'}
                        </p>
                        <Badge className="mt-1 bg-red-500 text-white text-xs">
                          {unread} {unread === 1 ? 'новое' : 'новых'}
                        </Badge>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}