'use client'

import { Loader2 } from 'lucide-react'
import { SafetyBanner } from '@/components/chat-safety'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { ChatMediaGallery } from '@/components/chat-media-gallery'
import { isBookingPaid } from '@/lib/mask-contacts'

/**
 * Center column: message feed, safety banner, media gallery modal trigger content.
 */
export function MessageList({
  messages,
  threadLoading,
  userId,
  language,
  booking,
  listing,
  searchQuery,
  detectedPatterns,
  onDismissSafety,
  mediaGalleryOpen,
  onMediaGalleryOpenChange,
  isHosting,
  partnerInquiryActions,
  onInvoiceCancelled,
}) {
  return (
    <>
      <ChatMediaGallery
        messages={messages}
        open={mediaGalleryOpen}
        onClose={() => onMediaGalleryOpenChange(false)}
        language={language}
      />

      <SafetyBanner
        patterns={detectedPatterns}
        onDismiss={onDismissSafety}
        lang={language}
      />

      {threadLoading ? (
        <div className="flex flex-1 items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          userId={userId}
          language={language}
          isBookingPaid={isBookingPaid(booking?.status)}
          searchHighlight={searchQuery.trim() || undefined}
          ownVariant="teal"
          userRole={isHosting ? 'partner' : 'renter'}
          booking={booking}
          listing={listing}
          partnerInquiryActions={partnerInquiryActions}
          onInvoiceCancelled={onInvoiceCancelled}
        />
      )}
    </>
  )
}
