'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getUIText } from '@/lib/translations'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { usePresenceContext } from '@/lib/context/PresenceContext'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'

/**
 * Peer presence, typing, display names (Stage 109.3).
 */
export function useUnifiedMessagesPeer({
  conversationId,
  user,
  language,
  selectedConv,
  typingByConversation,
  messages,
  booking,
  isHosting,
}) {
  const chatContactName = useMemo(() => {
    if (!selectedConv) return ''
    if (selectedConv.adminId) {
      return selectedConv.adminName || getUIText('messengerThread_labelSupport', language)
    }
    if (String(selectedConv.partnerId) === String(user?.id)) {
      return selectedConv.renterName || getUIText('messengerThread_labelGuest', language)
    }
    return selectedConv.partnerName || getUIText('messengerThread_labelHost', language)
  }, [selectedConv, user, language])

  const peerParticipantId = useMemo(() => {
    if (!selectedConv?.id || !user?.id) return null
    if (selectedConv.adminId) return selectedConv.adminId
    if (String(selectedConv.partnerId) === String(user.id)) return selectedConv.renterId
    return selectedConv.partnerId ?? selectedConv.ownerId ?? null
  }, [selectedConv, user])

  const persistedPeerLastSeenAt = useMemo(() => {
    if (!selectedConv?.id || !peerParticipantId) return null
    if (selectedConv.adminId && String(selectedConv.adminId) === String(peerParticipantId)) {
      return selectedConv.adminLastSeenAt ?? selectedConv.admin_last_seen_at ?? null
    }
    if (String(selectedConv.renterId || '') === String(peerParticipantId)) {
      return selectedConv.renterLastSeenAt ?? selectedConv.renter_last_seen_at ?? null
    }
    return selectedConv.partnerLastSeenAt ?? selectedConv.partner_last_seen_at ?? null
  }, [selectedConv, peerParticipantId])

  const { isUserOnline } = usePresenceContext()
  const peerOnline = useMemo(() => isUserOnline(peerParticipantId), [isUserOnline, peerParticipantId])
  const [peerLastSeenAt, setPeerLastSeenAt] = useState(null)
  useEffect(() => {
    setPeerLastSeenAt(persistedPeerLastSeenAt || null)
  }, [persistedPeerLastSeenAt, conversationId])
  const peerOnlinePrevRef = useRef(null)
  useEffect(() => {
    if (peerOnlinePrevRef.current === true && peerOnline === false) {
      setPeerLastSeenAt(new Date().toISOString())
    }
    peerOnlinePrevRef.current = peerOnline
  }, [peerOnline])

  const { markNow } = useMarkConversationRead(
    conversationId,
    !!(conversationId && user?.id),
    peerOnline,
  )

  const unifiedDisplayName = useMemo(
    () =>
      formatPrivacyDisplayNameForParticipant(
        user?.first_name,
        user?.last_name,
        user?.email,
        getUIText('adminGuestLabel', language),
      ),
    [user, language],
  )

  const { broadcastTyping, broadcastTypingStop } = useChatTyping(
    conversationId,
    user?.id,
    unifiedDisplayName,
  )

  const peerTypingName = useMemo(() => {
    const t = typingByConversation?.[String(conversationId || '')]
    return t?.name || null
  }, [typingByConversation, conversationId])

  const typingLine = useMemo(() => {
    if (!peerTypingName) return null
    return getUIText('messengerThread_typingByName', language).replace('{{name}}', peerTypingName)
  }, [peerTypingName, language])

  const payNowHref = useMemo(() => {
    if (isHosting || !booking?.id) return null
    const st = String(booking.status || '').toUpperCase()
    if (['CANCELLED', 'REFUNDED', 'COMPLETED', 'PAID', 'PAID_ESCROW'].includes(st)) return null
    if (st !== 'CONFIRMED') return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const inv = messages[i]?.metadata?.invoice
      if (!inv || String(inv.booking_id || '') !== String(booking.id)) continue
      if (String(inv.status || 'PENDING').toUpperCase() !== 'PENDING') continue
      const invId = inv.id || messages[i]?.metadata?.invoice_id
      if (!invId) continue
      const pm = String(inv.payment_method || 'CRYPTO').toUpperCase()
      const q =
        pm === 'CARD' || pm === 'CARD_INTL' ? 'CARD' : pm === 'MIR' || pm === 'CARD_RU' ? 'MIR' : 'CRYPTO'
      return `/checkout/${encodeURIComponent(booking.id)}?invoiceId=${encodeURIComponent(String(invId))}&pm=${q}`
    }
    return null
  }, [messages, booking, isHosting])

  return {
    chatContactName,
    peerOnline,
    peerLastSeenAt,
    persistedPeerLastSeenAt,
    typingLine,
    payNowHref,
    broadcastTyping,
    broadcastTypingStop,
    markNow,
  }
}
