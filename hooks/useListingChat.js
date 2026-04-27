'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { INBOX_TAB_TRAVELING, setRenterInboxTabPreference } from '@/lib/chat-inbox-tabs'
import { useChatContext } from '@/lib/context/ChatContext'

const CHAT_CACHE_TTL = 5 * 60 * 1000

function getChatCacheKey(listingId, userId) {
  return `gostaylo_chat_check_${listingId}_${userId}`
}

function readChatCache(listingId, userId) {
  try {
    const raw = localStorage.getItem(getChatCacheKey(listingId, userId))
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (Date.now() - (entry.ts || 0) > CHAT_CACHE_TTL) return null
    return entry
  } catch {
    return null
  }
}

function writeChatCache(listingId, userId, data) {
  try {
    localStorage.setItem(
      getChatCacheKey(listingId, userId),
      JSON.stringify({ ...data, ts: Date.now() }),
    )
  } catch {}
}

/**
 * PDP: conversation preview for listing, cache, and "contact host" navigation.
 */
export function useListingChat({ listing, user, openLoginModal, language }) {
  const router = useRouter()
  const { getConversationForListing, loaded: chatLoaded } = useChatContext()

  const [contactPartnerLoading, setContactPartnerLoading] = useState(false)
  const [existingConvId, setExistingConvId] = useState(null)
  const [lastMessagePreview, setLastMessagePreview] = useState(null)
  const [hasUnreadFromHost, setHasUnreadFromHost] = useState(false)

  const listingPartnerId = useMemo(
    () => listing?.ownerId ?? listing?.owner?.id ?? null,
    [listing?.ownerId, listing?.owner?.id],
  )

  const showContactPartner =
    !!listingPartnerId && String(user?.id || '') !== String(listingPartnerId)

  useEffect(() => {
    if (!user?.id || !listing?.id || String(user.id) === String(listingPartnerId)) {
      setExistingConvId(null)
      setLastMessagePreview(null)
      setHasUnreadFromHost(false)
      return
    }

    function applyConvData(conv) {
      if (!conv) {
        setExistingConvId(null)
        setLastMessagePreview(null)
        setHasUnreadFromHost(false)
        return
      }
      const preview = conv.lastMessage?.content || conv.lastMessage?.message || null
      const unread =
        Number(conv.unreadCount || 0) > 0 &&
        String(conv.partnerId || conv.partner_id || '') === String(listingPartnerId || '')
      setExistingConvId(conv.id)
      setLastMessagePreview(preview ? String(preview).slice(0, 80) : null)
      setHasUnreadFromHost(unread)
      writeChatCache(listing.id, user.id, {
        id: conv.id,
        preview: preview ? String(preview).slice(0, 80) : null,
        hasUnread: unread,
      })
    }

    if (chatLoaded) {
      const conv = getConversationForListing(listing.id)
      if (conv) {
        applyConvData(conv)
        return
      }
      writeChatCache(listing.id, user.id, { id: null })
      setExistingConvId(null)
      setLastMessagePreview(null)
      setHasUnreadFromHost(false)
      return
    }

    const cached = readChatCache(listing.id, user.id)
    if (cached) {
      setExistingConvId(cached.id || null)
      setLastMessagePreview(cached.preview || null)
      setHasUnreadFromHost(cached.hasUnread || false)
      return
    }

    fetch(`/api/v2/chat/conversations?listing_id=${encodeURIComponent(listing.id)}&limit=1`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        const conv = data?.data?.[0] || null
        applyConvData(conv)
      })
      .catch(() => {})
  }, [user?.id, listing?.id, listingPartnerId, chatLoaded, getConversationForListing])

  const handleContactPartner = useCallback(async () => {
    const partnerId = listing?.ownerId ?? listing?.owner?.id
    if (!partnerId) {
      toast.error(getUIText('listingDetail_listingUnavailable', language))
      return
    }
    if (!user) {
      openLoginModal()
      return
    }
    if (String(user.id) === String(partnerId)) return

    if (existingConvId) {
      setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
      router.push(`/messages/${encodeURIComponent(existingConvId)}`)
      return
    }

    setContactPartnerLoading(true)
    try {
      const res = await fetch('/api/v2/chat/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          partnerId,
          sendIntro: false,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('listingDetail_chatOpenError', language))
        return
      }
      const id = json.data?.id
      if (id) {
        const title = listing.title || getUIText('listingDetail_listingNameFallback', language)
        const draft = getUIText('listingDetail_chatIntro', language).replace(
          /\{\{title\}\}/g,
          String(title).replace(/</g, '').slice(0, 200),
        )
        try {
          setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
          sessionStorage.setItem(`gostaylo_chat_prefill_${id}`, draft)
          sessionStorage.setItem(
            `gostaylo_chat_context_listing_${id}`,
            JSON.stringify({
              listingId: listing.id,
              title: listing.title || null,
              images: listing.images,
              district: listing.district || null,
            }),
          )
        } catch {
          /* ignore */
        }
        setExistingConvId(id)
        router.push(`/messages/${encodeURIComponent(id)}`)
      }
    } catch (e) {
      console.error(e)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setContactPartnerLoading(false)
    }
  }, [listing, user, existingConvId, language, openLoginModal, router])

  return {
    listingPartnerId,
    showContactPartner,
    contactPartnerLoading,
    existingConvId,
    lastMessagePreview,
    hasUnreadFromHost,
    handleContactPartner,
  }
}
