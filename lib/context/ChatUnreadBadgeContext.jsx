'use client'



/**

 * Lightweight chat unread badge for storefront / partner shells (Stage 171.25 → 171.29).

 * Full ChatProvider + Realtime lives in `(chat)` layout only.

 */



import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useRef,

  useState,

} from 'react'

import { usePathname } from 'next/navigation'

import { useAuth } from '@/contexts/auth-context'

import { fetchChatUnreadCount } from '@/lib/chat/conversation-api-client'

import {

  isMessagesInboxRoute,

  subscribeChatInboxUnreadTotal,

} from '@/lib/chat/chat-unread-bridge'



const ChatUnreadBadgeContext = createContext({ totalUnread: 0 })



/** Poll interval — client dedup TTL is 45s (see TTL_CHAT_UNREAD_COUNT_MS). */

const REFRESH_MS = 60_000



export function ChatUnreadBadgeProvider({ children }) {

  const { user } = useAuth()

  const userId = user?.id ? String(user.id) : null

  const pathname = usePathname()

  const [totalUnread, setTotalUnread] = useState(0)

  const busyRef = useRef(false)



  const refresh = useCallback(async () => {

    if (!userId || busyRef.current) return

    busyRef.current = true

    try {

      const { ok, count } = await fetchChatUnreadCount()

      if (ok) setTotalUnread(Math.max(0, Number(count) || 0))

    } catch {

      /* silent */

    } finally {

      busyRef.current = false

    }

  }, [userId])



  useEffect(() => {

    if (!userId) {

      setTotalUnread(0)

      return undefined

    }



    if (isMessagesInboxRoute(pathname)) {

      return subscribeChatInboxUnreadTotal(setTotalUnread)

    }



    void refresh()



    const intervalId = window.setInterval(() => {

      void refresh()

    }, REFRESH_MS)



    return () => {

      window.clearInterval(intervalId)

    }

  }, [userId, pathname, refresh])



  const value = useMemo(() => ({ totalUnread }), [totalUnread])



  return (

    <ChatUnreadBadgeContext.Provider value={value}>{children}</ChatUnreadBadgeContext.Provider>

  )

}



/** Nav / header badge — works outside full ChatProvider. */

export function useChatUnreadBadge() {

  return useContext(ChatUnreadBadgeContext)

}

