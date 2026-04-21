'use client'

/**
 * Композер партнёра: «+» (вложения, счёт, паспорт), отдельно ⚡ быстрые ответы (Popover у капсулы),
 * поле ввода, микрофон и отправка.
 */

import { useState, useCallback, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
import { Loader2, Send, Plus, Receipt, IdCard, Paperclip, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { CHAT_COMPOSER_SHELL_CLASS } from '@/lib/chat-ui'

import { InvoiceCreator } from '@/components/chat/composer/InvoiceCreator'
import { VoiceRecorder } from '@/components/chat/composer/VoiceRecorder'
import { QuickRepliesScrollablePanel } from '@/components/chat/composer/QuickReplies'

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'

export function PartnerChatComposer({
  newMessage,
  onMessageChange,
  onSubmit,
  sending,
  disabled,
  booking,
  listing,
  language = 'ru',
  onSendInvoice,
  onSendPassportRequest,
  onAttachFile,
  onSendVoice,
  userId,
  showHostPlusMenu = true,
  invoiceDialogOpen,
  onInvoiceDialogOpenChange,
}) {
  const isRu = language !== 'en'
  const [passportLoading, setPassportLoading] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const fileRef = useRef(null)

  const [invoiceOpenInternal, setInvoiceOpenInternal] = useState(false)
  const invoiceOpen = invoiceDialogOpen !== undefined ? invoiceDialogOpen : invoiceOpenInternal
  const setInvoiceOpen = onInvoiceDialogOpenChange ?? setInvoiceOpenInternal
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false)

  const showInvoice = typeof onSendInvoice === 'function'
  const showPassport = typeof onSendPassportRequest === 'function'

  const handlePassportRequest = useCallback(async () => {
    if (!onSendPassportRequest) return
    setPassportLoading(true)
    try {
      await onSendPassportRequest()
      toast.success(isRu ? 'Запрос отправлен' : 'Request sent')
    } catch (e) {
      toast.error(e?.message || (isRu ? 'Не удалось отправить' : 'Failed to send'))
    } finally {
      setPassportLoading(false)
    }
  }, [onSendPassportRequest, isRu])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onAttachFile) return
    setAttachBusy(true)
    try {
      await onAttachFile(file)
    } finally {
      setAttachBusy(false)
    }
  }

  const plusMenuFull = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-2xl border-slate-200 bg-white sm:h-11 sm:w-11"
          aria-label={isRu ? 'Вложения и действия' : 'Attachments & actions'}
          disabled={disabled}
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {onAttachFile ? (
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              fileRef.current?.click()
            }}
          >
            {attachBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : (
              <Paperclip className="h-4 w-4 text-slate-600" />
            )}
            {isRu ? 'Фото или файл' : 'Photo or file'}
          </DropdownMenuItem>
        ) : null}

        {showInvoice ? (
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              setInvoiceOpen(true)
            }}
          >
            <Receipt className="h-4 w-4 text-amber-600" />
            {isRu ? 'Выставить счёт' : 'Send invoice'}
          </DropdownMenuItem>
        ) : null}

        {showPassport ? (
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              void handlePassportRequest()
            }}
            disabled={passportLoading}
          >
            {passportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IdCard className="h-4 w-4 text-teal-600" />
            )}
            {isRu ? 'Запросить фото паспорта' : 'Request passport photo'}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const plusMenu =
    showHostPlusMenu ? (
      plusMenuFull
    ) : onAttachFile ? (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-2xl border-slate-200 bg-white sm:h-11 sm:w-11"
        disabled={disabled || attachBusy}
        aria-label={isRu ? 'Прикрепить файл' : 'Attach file'}
        onClick={() => fileRef.current?.click()}
      >
        {attachBusy ? <Loader2 className="h-5 w-5 animate-spin sm:h-6 sm:w-6" /> : <Paperclip className="h-5 w-5 sm:h-6 sm:w-6" />}
      </Button>
    ) : null

  return (
    <div className={CHAT_COMPOSER_SHELL_CLASS}>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={DEFAULT_ACCEPT}
        onChange={handleFileChange}
      />

      <form
        onSubmit={onSubmit}
        className="flex w-full min-w-0 items-end gap-1.5 sm:items-center sm:gap-2"
      >
        {/* Капсула (+), ⚡, поле, микрофон; Popover быстрых ответов привязан к капсуле (PopoverAnchor) — стабильнее при клавиатуре */}
        {showHostPlusMenu ? (
          <Popover open={quickRepliesOpen} onOpenChange={setQuickRepliesOpen} modal={false}>
            <PopoverAnchor asChild>
              <div
                className={cn(
                  'flex min-w-0 flex-1 items-end gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-1 py-0.5 shadow-sm sm:items-center sm:gap-2 sm:px-1.5 sm:py-1',
                  voiceActive && 'border-teal-200/80 bg-teal-50/40',
                )}
              >
                {plusMenu}
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-2xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-11 sm:w-11"
                    aria-label={isRu ? 'Быстрые ответы' : 'Quick replies'}
                    disabled={disabled}
                    title={isRu ? 'Быстрые ответы' : 'Quick replies'}
                  >
                    <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </PopoverTrigger>
                {!voiceActive ? (
                  <div className="flex min-w-0 flex-1 items-center">
                    <ChatGrowingTextarea
                      value={newMessage}
                      onChange={onMessageChange}
                      placeholder={getUIText('chatComposerPlaceholder', language)}
                      disabled={sending || disabled}
                      minHeightPx={36}
                      maxHeightPx={120}
                      className="min-h-[36px] border-0 bg-transparent py-2 text-[15px] leading-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[40px] sm:py-2.5 sm:text-sm"
                    />
                  </div>
                ) : null}
                <div className={cn('flex min-w-0 items-center', voiceActive ? 'flex-1' : 'shrink-0')}>
                  <VoiceRecorder
                    showMicTrigger={!voiceActive && !newMessage.trim() && !disabled && !sending}
                    userId={userId}
                    language={language}
                    onSend={onSendVoice}
                    onActiveChange={setVoiceActive}
                    disabled={disabled || sending}
                  />
                </div>
              </div>
            </PopoverAnchor>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              collisionPadding={16}
              className="z-[130] w-[min(100vw-1.5rem,20rem)] rounded-2xl border border-slate-200 bg-white p-0 shadow-xl outline-none"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <QuickRepliesScrollablePanel
                active={quickRepliesOpen}
                currentMessage={newMessage}
                onSelect={(text) => {
                  onMessageChange(text)
                  setQuickRepliesOpen(false)
                }}
                language={language}
                disabled={disabled}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <div
            className={cn(
              'flex min-w-0 flex-1 items-end gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-1 py-0.5 shadow-sm sm:items-center sm:gap-2 sm:px-1.5 sm:py-1',
              voiceActive && 'border-teal-200/80 bg-teal-50/40',
            )}
          >
            {plusMenu}
            {!voiceActive ? (
              <div className="flex min-w-0 flex-1 items-center">
                <ChatGrowingTextarea
                  value={newMessage}
                  onChange={onMessageChange}
                  placeholder={getUIText('chatComposerPlaceholder', language)}
                  disabled={sending || disabled}
                  minHeightPx={36}
                  maxHeightPx={120}
                  className="min-h-[36px] border-0 bg-transparent py-2 text-[15px] leading-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[40px] sm:py-2.5 sm:text-sm"
                />
              </div>
            ) : null}
            <div className={cn('flex min-w-0 items-center', voiceActive ? 'flex-1' : 'shrink-0')}>
              <VoiceRecorder
                showMicTrigger={!voiceActive && !newMessage.trim() && !disabled && !sending}
                userId={userId}
                language={language}
                onSend={onSendVoice}
                onActiveChange={setVoiceActive}
                disabled={disabled || sending}
              />
            </div>
          </div>
        )}

        {!voiceActive ? (
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending || disabled}
            className="h-10 w-10 min-h-0 min-w-0 shrink-0 self-end rounded-2xl bg-teal-600 hover:bg-teal-700 sm:h-11 sm:w-auto sm:self-center sm:px-4"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin sm:h-4 sm:w-4" /> : <Send className="h-4 w-4 sm:h-4 sm:w-4" />}
          </Button>
        ) : null}
      </form>

      {showInvoice ? (
        <InvoiceCreator
          booking={booking}
          listing={listing}
          onSend={onSendInvoice}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      ) : null}
    </div>
  )
}

export default PartnerChatComposer
