'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { INBOX_TAB_TRAVELING, setRenterInboxTabPreference } from '@/lib/chat-inbox-tabs'
import { useChatContext } from '@/lib/context/ChatContext'
import { getBookingApiUserMessage } from '@/lib/booking-error-message'
import {
  attachPdpInquiryPriceAttestation,
  buildPdpContactInquiryPayload,
} from '@/lib/booking/pdp-contact-inquiry'

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

function hasPdpStayDates(dateRange) {
  return !!(dateRange?.from && dateRange?.to)
}

/**
 * PDP: conversation preview for listing, cache, and "contact host" navigation.
 * ADR-172 Wave 2: with PDP dates → POST /api/v2/bookings (contactInquiry) → INQUIRY + chat.
 */
export function useListingChat({
  listing,
  user,
  openLoginModal,
  language,
  dateRange = null,
  guests = 1,
  exclusiveDatesUnavailable = false,
  isVehicleListing = false,
  vehicleStartTime = '07:00',
  vehicleEndTime = '07:00',
  priceCalc = null,
}) {
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

  const pdpHasDates = hasPdpStayDates(dateRange)

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

  const openContactOnlyThread = useCallback(
    async (partnerId) => {
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
        return null
      }
      const id = json.data?.id
      if (!id) return null

      setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
      setExistingConvId(id)
      router.push(`/messages/${encodeURIComponent(id)}`)
      return id
    },
    [listing, language, router],
  )

  const openPdpContactInquiry = useCallback(async () => {
    const basePayload = buildPdpContactInquiryPayload({
      listing,
      dateRange,
      guests,
      isVehicleListing,
      vehicleStartTime,
      vehicleEndTime,
      user,
    })
    if (!basePayload) {
      toast.error(getUIText('listingDetail_selectDates', language))
      return
    }

    const payload = await attachPdpInquiryPriceAttestation(basePayload, {
      listing,
      guests,
      priceCalc,
    })
    payload.uiLocale = language

    const res = await fetch('/api/v2/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      toast.error(getBookingApiUserMessage(data, language))
      return
    }

    const cid = data.conversationId || existingConvId
    if (!cid) {
      toast.error(getUIText('listingDetail_chatOpenError', language))
      return
    }

    setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
    setExistingConvId(cid)
    writeChatCache(listing.id, user.id, { id: cid, preview: null, hasUnread: false })

    if (data.reused) {
      toast.success(getUIText('listingToast_bookingInquiry', language))
    } else if (data.inquiry) {
      toast.success(getUIText('listingToast_bookingInquiry', language))
    }

    router.push(`/messages/${encodeURIComponent(cid)}`)
  }, [
    listing,
    dateRange,
    guests,
    isVehicleListing,
    vehicleStartTime,
    vehicleEndTime,
    user,
    priceCalc,
    language,
    existingConvId,
    router,
  ])

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

    if (!pdpHasDates && existingConvId) {
      setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
      router.push(`/messages/${encodeURIComponent(existingConvId)}`)
      return
    }

    setContactPartnerLoading(true)
    try {
      if (pdpHasDates) {
        await openPdpContactInquiry()
        return
      }
      await openContactOnlyThread(partnerId)
    } catch (e) {
      console.error(e)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setContactPartnerLoading(false)
    }
  }, [
    listing,
    user,
    existingConvId,
    pdpHasDates,
    language,
    openLoginModal,
    router,
    openContactOnlyThread,
    openPdpContactInquiry,
  ])

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
