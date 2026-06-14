'use client'

/**
 * Stage 140.3 — Partner notification store (feed + unread count).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { usePartnerRealtime } from '@/hooks/usePartnerRealtime'
import {
  isDuplicateNotification,
  mapPushPayloadToNotification,
} from '@/lib/partner/partner-notification-events'

const MAX_ITEMS = 30

const PartnerNotificationContext = createContext(null)

export function PartnerNotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const { language } = useI18n()
  const partnerId = isAuthenticated ? user?.id : null
  const [items, setItems] = useState([])

  const prependItem = useCallback((notif) => {
    if (!notif?.id) return
    setItems((prev) => {
      if (isDuplicateNotification(prev, notif)) return prev
      const next = [{ ...notif, read: false }, ...prev]
      return next.slice(0, MAX_ITEMS)
    })
  }, [])

  const handlePartnerEvent = useCallback(
    (payload) => {
      if (payload?.notif) prependItem(payload.notif)
    },
    [prependItem],
  )

  usePartnerRealtime(partnerId, {
    enabled: !!partnerId,
    language,
    onPartnerEvent: handlePartnerEvent,
  })

  useEffect(() => {
    if (!partnerId) return undefined
    const onPush = (evt) => {
      const notif = mapPushPayloadToNotification(evt?.detail || {}, language)
      if (notif) prependItem(notif)
    }
    const onPartnerEvt = (evt) => {
      if (evt?.detail?.notif) prependItem(evt.detail.notif)
    }
    window.addEventListener('gostaylo:push-message', onPush)
    window.addEventListener('gostaylo:partner-event', onPartnerEvt)
    return () => {
      window.removeEventListener('gostaylo:push-message', onPush)
      window.removeEventListener('gostaylo:partner-event', onPartnerEvt)
    }
  }, [partnerId, language, prependItem])

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items])

  const markRead = useCallback((id) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, read: true } : it)))
  }, [])

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((it) => ({ ...it, read: true })))
  }, [])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      markRead,
      markAllRead,
      prependItem,
    }),
    [items, unreadCount, markRead, markAllRead, prependItem],
  )

  return (
    <PartnerNotificationContext.Provider value={value}>
      {children}
    </PartnerNotificationContext.Provider>
  )
}

export function usePartnerNotifications() {
  const ctx = useContext(PartnerNotificationContext)
  if (!ctx) {
    return {
      items: [],
      unreadCount: 0,
      markRead: () => {},
      markAllRead: () => {},
      prependItem: () => {},
    }
  }
  return ctx
}
