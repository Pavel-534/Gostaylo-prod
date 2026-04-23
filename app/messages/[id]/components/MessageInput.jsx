'use client'

import { useRef } from 'react'
import nextDynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Paperclip, Plus, Send, Trash2, Loader2 } from 'lucide-react'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
import { CHAT_COMPOSER_SHELL_CLASS } from '@/lib/chat-ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

const PartnerChatComposer = nextDynamic(
  () => import('@/components/partner-chat-composer').then((m) => m.PartnerChatComposer),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-12 w-full min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50"
        aria-hidden
      >
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
      </div>
    ),
  },
)

/**
 * Bottom composer: host tools (dynamic) or guest text / voice / attach.
 */
export function MessageInput({
  isHosting,
  newMessage,
  onMessageChange,
  onSubmit,
  sending,
  disabled,
  booking,
  listing,
  language,
  onSendInvoice,
  onSendPassportRequest,
  onAttachFile,
  onSendVoice,
  userId,
  invoiceDialogOpen,
  onInvoiceDialogOpenChange,
  /* guest voice */
  voiceBlob,
  voicePreviewUrl,
  voiceDurationLabel,
  voiceRecording,
  voiceSending,
  onStartVoice,
  onStopVoice,
  onDiscardVoice,
  onGuestVoiceSend,
  broadcastTyping,
  broadcastTypingStop,
}) {
  const attachFileRef = useRef(null)

  if (isHosting) {
    return (
      <PartnerChatComposer
        newMessage={newMessage}
        onMessageChange={(v) => {
          onMessageChange(v)
          broadcastTyping()
        }}
        onSubmit={onSubmit}
        sending={sending}
        disabled={disabled}
        booking={booking}
        listing={listing}
        language={language}
        onSendInvoice={onSendInvoice}
        onSendPassportRequest={onSendPassportRequest}
        onAttachFile={onAttachFile}
        onSendVoice={onSendVoice}
        userId={userId}
        showHostPlusMenu
        invoiceDialogOpen={invoiceDialogOpen}
        onInvoiceDialogOpenChange={onInvoiceDialogOpenChange}
      />
    )
  }

  return (
    <div className={CHAT_COMPOSER_SHELL_CLASS}>
      <input
        ref={attachFileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onAttachFile(f)
        }}
      />
      <form onSubmit={onSubmit} className="flex w-full min-w-0 items-end gap-1.5 sm:items-center sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-2xl border-slate-200 bg-white sm:h-11 sm:w-11"
              disabled={sending}
              aria-label={getUIText('messengerThread_attachmentsAria', language)}
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={(e) => {
                e.preventDefault()
                attachFileRef.current?.click()
              }}
            >
              <Paperclip className="h-4 w-4 text-slate-600" />
              {getUIText('messengerThread_attachmentPhotoOrFile', language)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {voiceBlob ? (
          <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:px-3 sm:py-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <audio
                key={voicePreviewUrl || 'voice-preview'}
                src={voicePreviewUrl || undefined}
                controls
                playsInline
                preload="auto"
                className="block h-9 w-full max-w-full"
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-teal-700">
              {voiceDurationLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-2xl text-slate-600 hover:bg-slate-100"
              onClick={onDiscardVoice}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              disabled={voiceSending}
              className="h-11 min-h-[44px] shrink-0 rounded-2xl bg-teal-600 px-4 hover:bg-teal-700"
              onClick={() => void onGuestVoiceSend()}
            >
              {voiceSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        ) : voiceRecording ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="flex-1 text-sm font-medium text-red-700">
              {getUIText('chatVoiceRecording', language)} {voiceDurationLabel}
            </span>
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-2xl bg-teal-600 hover:bg-teal-700"
              onClick={onStopVoice}
            >
              <MicOff className="h-5 w-5 text-white" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-end">
              <ChatGrowingTextarea
                value={newMessage}
                onChange={(v) => {
                  onMessageChange(v)
                  broadcastTyping()
                }}
                placeholder={getUIText('chatComposerPlaceholder', language)}
                disabled={sending}
                minHeightPx={36}
                maxHeightPx={120}
                className="min-h-[36px] py-2 text-[15px] leading-normal sm:min-h-[40px] sm:py-2.5 sm:text-sm"
              />
            </div>
            {!newMessage.trim() && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 self-end rounded-2xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-11 sm:w-11 sm:self-center"
                disabled={sending}
                onClick={onStartVoice}
                title={getUIText('messengerThread_voiceMessage', language)}
              >
                <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className={cn(
                'h-10 w-10 min-h-0 min-w-0 shrink-0 self-end rounded-2xl bg-teal-600 hover:bg-teal-700',
                'sm:h-10 sm:w-auto sm:self-center sm:px-4',
              )}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin sm:h-4 sm:w-4" />
              ) : (
                <Send className="h-4 w-4 sm:h-4 sm:w-4" />
              )}
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
