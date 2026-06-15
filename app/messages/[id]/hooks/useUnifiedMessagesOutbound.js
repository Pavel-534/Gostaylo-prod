'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import {
  showContactSafetyWarning,
  shouldWarnContactSafetyForText,
} from '@/lib/chat/show-contact-safety-warning'

/**
 * Outbound chat UI handlers (Stage 110.7).
 * Вся отправка — SSOT `useChatThreadMessages` (post-chat-message / post-chat-invoice).
 */
export function useUnifiedMessagesOutbound({
  language,
  user,
  booking = null,
  selectedConv,
  inbox,
  sendMessageText,
  sendVoiceMessage,
  sendVoiceFromUrl,
  sendPassportRequest,
  sendInvoice,
  sendMedia,
  appendMessage,
  setMessages,
  broadcastTypingStop,
  newMessage,
  setNewMessage,
  setSending,
  voiceBlob,
  voiceDuration,
  discardVoice,
  setVoiceSending,
}) {
  const afterOutbound = useCallback(() => {
    inbox.refresh()
  }, [inbox])

  const handleSendText = useCallback(
    async (e) => {
      e?.preventDefault()
      if (!newMessage.trim() || !selectedConv || !user) return
      broadcastTypingStop()
      const text = newMessage.trim()
      if (shouldWarnContactSafetyForText(text, booking?.status)) {
        showContactSafetyWarning({ language, toast, bookingStatus: booking?.status })
      }
      setNewMessage('')
      setSending(true)
      try {
        await sendMessageText(text)
        afterOutbound()
      } finally {
        setSending(false)
      }
    },
    [
      newMessage,
      selectedConv,
      user,
      booking,
      sendMessageText,
      afterOutbound,
      broadcastTypingStop,
      setNewMessage,
      setSending,
    ],
  )

  const handleSendVoice = useCallback(
    async ({ url, duration }) => {
      if (!selectedConv || !user) return
      setSending(true)
      try {
        const data = await sendVoiceFromUrl(url, duration)
        if (data) {
          appendMessage(data)
          afterOutbound()
        }
      } finally {
        setSending(false)
      }
    },
    [selectedConv, user, sendVoiceFromUrl, appendMessage, afterOutbound, setSending],
  )

  const handleSendInvoice = useCallback(
    async (invoiceData) => {
      if (!selectedConv || !user) return
      const { ok, data, error } = await sendInvoice(invoiceData)
      if (ok && data) {
        appendMessage(data)
        toast.success(getUIText('messengerThread_invoiceSent', language))
        afterOutbound()
      } else {
        toast.error(error || getUIText('messengerThread_invoiceError', language))
      }
    },
    [selectedConv, user, sendInvoice, appendMessage, afterOutbound, language],
  )

  const handleSendPassportRequest = useCallback(async () => {
    if (!selectedConv || !user) return
    const data = await sendPassportRequest()
    if (data) {
      appendMessage(data)
      afterOutbound()
    }
  }, [selectedConv, user, sendPassportRequest, appendMessage, afterOutbound])

  const handleAttachFile = useCallback(
    async (file) => {
      if (!selectedConv || !user) return
      try {
        const data = await sendMedia(file, file.type.startsWith('image/') ? 'image' : 'file')
        if (data) {
          appendMessage(data)
          afterOutbound()
        }
      } catch (err) {
        toast.error(err?.message || getUIText('messengerThread_fileUploadFailed', language))
      }
    },
    [selectedConv, user, sendMedia, appendMessage, afterOutbound, language],
  )

  const handleGuestVoiceBlobSend = useCallback(async () => {
    if (!voiceBlob || !user?.id || !selectedConv) return
    setVoiceSending(true)
    try {
      const data = await sendVoiceMessage(voiceBlob, voiceDuration)
      if (data) {
        appendMessage(data)
        discardVoice()
        afterOutbound()
      }
    } catch {
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setVoiceSending(false)
    }
  }, [
    voiceBlob,
    user,
    selectedConv,
    voiceDuration,
    sendVoiceMessage,
    appendMessage,
    discardVoice,
    afterOutbound,
    language,
    setVoiceSending,
  ])

  const onInvoiceCancelled = useCallback(
    (msgId) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  invoice: { ...m.metadata?.invoice, status: 'CANCELLED' },
                },
              }
            : m,
        ),
      )
    },
    [setMessages],
  )

  const onInvoicePaid = useCallback(
    (msgId) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  invoice: { ...m.metadata?.invoice, status: 'PAID' },
                },
              }
            : m,
        ),
      )
    },
    [setMessages],
  )

  return {
    handleSendText,
    handleSendVoice,
    handleSendInvoice,
    handleSendPassportRequest,
    handleAttachFile,
    handleGuestVoiceBlobSend,
    onInvoiceCancelled,
    onInvoicePaid,
  }
}
