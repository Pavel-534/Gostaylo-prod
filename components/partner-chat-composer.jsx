'use client'

/**
 * @file components/partner-chat-composer.jsx
 *
 * Дирижёр чат-композера для партнёра.
 *
 * Этот файл — тонкий оркестратор: объединяет независимые модули из
 * components/chat/composer/ и обеспечивает их взаимодействие:
 *   – MediaUploader  — кнопка 📎 + скрытый input
 *   – HostPlusMenu   — выпадающее меню «+» (Счёт / Паспорт / шаблоны из +)
 *   – QuickReplies   — кнопка ⚡ + меню быстрых ответов
 *   – InvoiceCreator — диалог выставления счёта
 *   – VoiceRecorder  — запись, предпросмотр и отправка голосового
 *   – ChatGrowingTextarea + кнопка «Отправить» (показываются когда нет активной записи)
 */

import { useState, useCallback } from 'react'
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
import { Loader2, Send, Plus, Receipt, IdCard, Quote } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

import { MediaUploader } from '@/components/chat/composer/MediaUploader'
import { QuickReplies } from '@/components/chat/composer/QuickReplies'
import { InvoiceCreator } from '@/components/chat/composer/InvoiceCreator'
import { VoiceRecorder } from '@/components/chat/composer/VoiceRecorder'

/** Быстрые ответы из меню «+» (краткий список для компактного варианта) */
const HOST_QUICK_REPLIES = [
  { shortRu: 'Свободен на ваши даты',       textRu: 'Здравствуйте! Объект свободен на ваши даты.',    shortEn: 'Available for your dates',  textEn: 'Hello! The property is available for your dates.' },
  { shortRu: 'Фото паспорта для договора',   textRu: 'Пожалуйста, пришлите фото вашего паспорта для договора и регистрации (можно закрыть номер, главное — ФИО и срок действия).', shortEn: 'Passport photo for agreement', textEn: 'Please send a clear passport photo for the rental agreement (you may cover the document number; we need your name and expiry).' },
  { shortRu: 'Где вы сейчас / локация',      textRu: 'Подскажите, пожалуйста, где вы сейчас находитесь или пришлите геолокацию — так удобнее согласовать встречу или заселение.',  shortEn: 'Your location',               textEn: 'Could you share where you are now or send your location? It helps coordinate check-in or a meeting.' },
]

/**
 * @param {Object}   props
 * @param {string}   props.newMessage
 * @param {Function} props.onMessageChange
 * @param {Function} props.onSubmit
 * @param {boolean}  props.sending
 * @param {boolean}  props.disabled
 * @param {Object}   [props.booking]
 * @param {Object}   [props.listing]
 * @param {string}   [props.language]
 * @param {Function} [props.onSendInvoice]          — если передан, показывается пункт «Счёт»
 * @param {Function} [props.onSendPassportRequest]  — если передан, показывается пункт «Паспорт»
 * @param {Function} [props.onAttachFile]           — если передан, показывается кнопка 📎
 * @param {Function} [props.onSendVoice]            — ({ url, duration }) => void|Promise
 * @param {string}   [props.userId]                 — нужен для папки в Storage при голосовом
 * @param {boolean}  [props.showHostPlusMenu]       — показывать меню «+»
 * @param {boolean}  [props.invoiceDialogOpen]      — внешнее управление диалогом счёта
 * @param {Function} [props.onInvoiceDialogOpenChange]
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
  onSendVoice,
  userId,
  showHostPlusMenu = true,
  invoiceDialogOpen,
  onInvoiceDialogOpenChange,
}) {
  const isRu = language !== 'en'
  const [passportLoading, setPassportLoading] = useState(false)
  // true когда VoiceRecorder в режиме «запись» или «предпросмотр»
  const [voiceActive, setVoiceActive] = useState(false)

  // Состояние диалога счёта: поддерживает и внешнее управление (через props), и внутреннее
  const [invoiceOpenInternal, setInvoiceOpenInternal] = useState(false)
  const invoiceOpen = invoiceDialogOpen !== undefined ? invoiceDialogOpen : invoiceOpenInternal
  const setInvoiceOpen = onInvoiceDialogOpenChange ?? setInvoiceOpenInternal

  const showInvoice = typeof onSendInvoice === 'function'
  const showPassport = typeof onSendPassportRequest === 'function'
  const showHostDivider = showInvoice || showPassport

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

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <form onSubmit={onSubmit} className="flex gap-2 items-end">

        {/* 📎 Прикрепить файл */}
        {onAttachFile ? (
          <MediaUploader onAttachFile={onAttachFile} disabled={disabled} />
        ) : null}

        {/* ➕ Меню хозяина (Счёт / Паспорт / быстрые ответы в компактном виде) */}
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
                  onSelect={(e) => { e.preventDefault(); handlePassportRequest() }}
                  disabled={passportLoading}
                >
                  {passportLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <IdCard className="h-4 w-4 text-teal-600" />}
                  {isRu ? 'Запросить фото паспорта' : 'Request passport photo'}
                </DropdownMenuItem>
              ) : null}
              {showHostDivider ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-xs font-normal text-slate-500">
                {isRu ? 'Быстрые ответы' : 'Quick replies'}
              </DropdownMenuLabel>
              {HOST_QUICK_REPLIES.map((q, idx) => (
                <DropdownMenuItem
                  key={idx}
                  className="flex cursor-pointer flex-col items-start gap-2"
                  onSelect={(e) => { e.preventDefault(); onMessageChange(isRu ? q.textRu : q.textEn) }}
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

        {/* ⚡ Быстрые ответы (расширенный список + мои шаблоны) */}
        <QuickReplies
          currentMessage={newMessage}
          onSelect={onMessageChange}
          language={language}
          disabled={disabled}
        />

        {/* Диалог счёта (рендерится вне формы, состояние открытия через unified invoiceOpen) */}
        {showInvoice ? (
          <InvoiceCreator
            booking={booking}
            listing={listing}
            onSend={onSendInvoice}
            open={invoiceOpen}
            onOpenChange={setInvoiceOpen}
          />
        ) : null}

        {/* 🎤 Голосовой рекордер (показывает mic/rec/preview; скрывает textarea когда active) */}
        <VoiceRecorder
          showMicTrigger={!voiceActive && !newMessage.trim() && !disabled && !sending}
          userId={userId}
          language={language}
          onSend={onSendVoice}
          onActiveChange={setVoiceActive}
          disabled={disabled || sending}
        />

        {/* Поле ввода + кнопка «Отправить» (скрыты когда VoiceRecorder активен) */}
        {!voiceActive ? (
          <>
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
          </>
        ) : null}

      </form>
    </div>
  )
}

export default PartnerChatComposer
