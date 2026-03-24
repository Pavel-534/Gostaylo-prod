'use client'

import { useState, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
import { SendInvoiceDialog } from '@/components/chat-invoice'
import { Plus, Receipt, IdCard, Loader2, Send, Paperclip, Quote } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

const QUICK_REPLIES = [
  {
    shortRu: 'Свободен на ваши даты',
    textRu: 'Здравствуйте! Объект свободен на ваши даты.',
    shortEn: 'Available for your dates',
    textEn: 'Hello! The property is available for your dates.',
  },
  {
    shortRu: 'Фото паспорта для договора',
    textRu:
      'Пожалуйста, пришлите фото вашего паспорта для договора и регистрации (можно закрыть номер, главное — ФИО и срок действия).',
    shortEn: 'Passport photo for agreement',
    textEn:
      'Please send a clear passport photo for the rental agreement (you may cover the document number; we need your name and expiry).',
  },
  {
    shortRu: 'Где вы сейчас / локация',
    textRu:
      'Подскажите, пожалуйста, где вы сейчас находитесь или пришлите геолокацию — так удобнее согласовать встречу или заселение.',
    shortEn: 'Your location',
    textEn:
      'Could you share where you are now or send your location? It helps coordinate check-in or a meeting.',
  },
]

/**
 * Поле ввода + меню «Действия» для партнёра (хозяин объекта).
 * Если пользователь в чате как гость (renter_id), onSendInvoice / onSendPassportRequest не передаются — остаются вложения и быстрые ответы.
 */
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
  /** Меню «+» (счёт, паспорт, быстрые ответы) — только в режиме хозяина */
  showHostPlusMenu = true,
}) {
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [passportLoading, setPassportLoading] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const fileRef = useRef(null)
  const isRu = language !== 'en'
  const showInvoice = typeof onSendInvoice === 'function'
  const showPassport = typeof onSendPassportRequest === 'function'
  const showHostDivider = showInvoice || showPassport

  async function handlePassportRequest() {
    if (!onSendPassportRequest) return
    setPassportLoading(true)
    try {
      await onSendPassportRequest()
      toast.success('Запрос отправлен')
    } catch (e) {
      toast.error(e?.message || 'Не удалось отправить')
    } finally {
      setPassportLoading(false)
    }
  }

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

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={handleFileChange}
      />
      <form onSubmit={onSubmit} className="flex gap-2 items-end">
        {onAttachFile ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 flex-shrink-0 border-slate-200"
            disabled={disabled || attachBusy}
            aria-label="Прикрепить файл"
            onClick={() => fileRef.current?.click()}
          >
            {attachBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </Button>
        ) : null}
        {showHostPlusMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 flex-shrink-0 border-slate-200"
                aria-label={isRu ? 'Действия' : 'Actions'}
                disabled={disabled}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
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
                    handlePassportRequest()
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
              {showHostDivider ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-xs font-normal text-slate-500">
                {isRu ? 'Быстрые ответы' : 'Quick replies'}
              </DropdownMenuLabel>
              {QUICK_REPLIES.map((q, idx) => (
                <DropdownMenuItem
                  key={idx}
                  className="flex cursor-pointer flex-col items-start gap-2"
                  onSelect={(e) => {
                    e.preventDefault()
                    onMessageChange(isRu ? q.textRu : q.textEn)
                  }}
                >
                  <span className="flex w-full items-center gap-2">
                    <Quote className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="text-sm font-medium">{isRu ? q.shortRu : q.shortEn}</span>
                  </span>
                  <span className="line-clamp-2 pl-6 text-xs text-slate-500">
                    {isRu ? q.textRu : q.textEn}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {showInvoice ? (
          <SendInvoiceDialog
            open={invoiceOpen}
            onOpenChange={setInvoiceOpen}
            booking={booking}
            listing={listing}
            onSend={async (data) => {
              await onSendInvoice(data)
              setInvoiceOpen(false)
            }}
          />
        ) : null}

        <ChatGrowingTextarea
          value={newMessage}
          onChange={onMessageChange}
          placeholder={getUIText('chatComposerPlaceholder', language)}
          disabled={sending || disabled}
        />
        <Button
          type="submit"
          disabled={!newMessage.trim() || sending || disabled}
          className="h-10 w-10 flex-shrink-0 bg-teal-600 hover:bg-teal-700 sm:w-auto sm:px-4"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
