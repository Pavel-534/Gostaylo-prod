'use client'

/**
 * Композер партнёра: одна кнопка «+» (вложения, быстрые ответы, счёт, паспорт),
 * широкое поле ввода, микрофон и отправка справа.
 */

import { useState, useCallback, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
import { Loader2, Send, Plus, Receipt, IdCard, Paperclip, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { CHAT_COMPOSER_SHELL_CLASS } from '@/lib/chat-ui'

import { InvoiceCreator } from '@/components/chat/composer/InvoiceCreator'
import { VoiceRecorder } from '@/components/chat/composer/VoiceRecorder'
import { QuickRepliesPanel } from '@/components/chat/composer/QuickReplies'

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
          className="h-10 w-10 shrink-0 border-slate-200"
          aria-label={isRu ? 'Вложения и действия' : 'Attachments & actions'}
          disabled={disabled}
        >
          <Plus className="h-5 w-5" />
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

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {isRu ? 'Быстрые ответы' : 'Quick replies'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80 max-h-[min(70vh,22rem)] overflow-y-auto p-0">
            <div className="p-1">
              <QuickRepliesPanel
                currentMessage={newMessage}
                onSelect={(text) => onMessageChange(text)}
                language={language}
                disabled={disabled}
              />
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

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
        className="h-10 w-10 shrink-0 border-slate-200"
        disabled={disabled || attachBusy}
        aria-label={isRu ? 'Прикрепить файл' : 'Attach file'}
        onClick={() => fileRef.current?.click()}
      >
        {attachBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
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
        className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2"
      >
        {plusMenu}

        {!voiceActive ? (
          <div className="min-w-0 flex-1 flex items-center">
            <ChatGrowingTextarea
              value={newMessage}
              onChange={onMessageChange}
              placeholder={getUIText('chatComposerPlaceholder', language)}
              disabled={sending || disabled}
              minHeightPx={44}
              className="min-h-[44px] py-3 text-[15px] leading-normal sm:text-sm"
            />
          </div>
        ) : null}

        <div className={cn('min-w-0', voiceActive && 'flex flex-1 items-center')}>
          <VoiceRecorder
            showMicTrigger={!voiceActive && !newMessage.trim() && !disabled && !sending}
            userId={userId}
            language={language}
            onSend={onSendVoice}
            onActiveChange={setVoiceActive}
            disabled={disabled || sending}
          />
        </div>

        {!voiceActive ? (
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending || disabled}
            className="h-10 w-10 shrink-0 bg-teal-600 hover:bg-teal-700 sm:w-auto sm:px-4"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
