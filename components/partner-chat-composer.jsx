'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
import { Plus, Receipt, IdCard, Loader2, Send, Paperclip, Quote, Zap, Mic, MicOff, Trash2, BookmarkPlus, Bookmark, X } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { uploadChatFile } from '@/lib/chat-upload'

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
  /** Callback для отправки голосового сообщения (получает { blob, duration }) */
  onSendVoice,
  /** userId — нужен для папки загрузки голосовых */
  userId,
  /** Меню «+» (счёт, паспорт, быстрые ответы) — только в режиме хозяина */
  showHostPlusMenu = true,
  /** Контроль диалога счёта снаружи (от ChatActionBar) */
  invoiceDialogOpen,
  onInvoiceDialogOpenChange,
}) {
  const [invoiceOpenInternal, setInvoiceOpenInternal] = useState(false)
  const invoiceOpen = invoiceDialogOpen !== undefined ? invoiceDialogOpen : invoiceOpenInternal
  const setInvoiceOpen = onInvoiceDialogOpenChange ?? setInvoiceOpenInternal
  const [passportLoading, setPassportLoading] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const [voiceSending, setVoiceSending] = useState(false)
  const fileRef = useRef(null)
  const isRu = language !== 'en'

  // ─── Пользовательские шаблоны ─────────────────────────────────────────────
  const [savedTemplates, setSavedTemplates] = useState([])
  const [tplLoaded, setTplLoaded] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [newTplLabel, setNewTplLabel] = useState('')

  // Загружаем шаблоны при первом открытии меню
  const loadTemplates = useCallback(async () => {
    if (tplLoaded) return
    try {
      const res = await fetch('/api/v2/chat/templates', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setSavedTemplates(json.data || [])
    } catch { /* ignore */ } finally {
      setTplLoaded(true)
    }
  }, [tplLoaded])

  async function saveCurrentAsTemplate() {
    const text = newMessage.trim()
    if (!text) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/v2/chat/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, label: newTplLabel.trim() || text.slice(0, 40) }),
      })
      const json = await res.json()
      if (json.success) {
        setSavedTemplates(json.data || [])
        toast.success(isRu ? 'Шаблон сохранён!' : 'Template saved!')
        setShowSaveInput(false)
        setNewTplLabel('')
      } else {
        toast.error(json.error || 'Ошибка')
      }
    } catch { toast.error('Ошибка') } finally {
      setSavingTemplate(false)
    }
  }

  async function deleteTemplate(id) {
    try {
      const res = await fetch(`/api/v2/chat/templates?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) setSavedTemplates(json.data || [])
    } catch { /* ignore */ }
  }

  const {
    isRecording,
    duration,
    durationLabel,
    audioBlob,
    audioUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    discardRecording,
  } = useVoiceRecorder()

  // Показываем ошибку разрешения на микрофон
  if (recorderError) {
    toast.error(recorderError)
  }

  async function handleSendVoice() {
    if (!audioBlob || !userId) return
    setVoiceSending(true)
    try {
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: audioBlob.type })
      const { url } = await uploadChatFile(file, userId)
      if (typeof onSendVoice === 'function') {
        await onSendVoice({ url, duration })
      }
      discardRecording()
    } catch (e) {
      toast.error(e?.message || 'Ошибка отправки голосового')
    } finally {
      setVoiceSending(false)
    }
  }
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

        {/* ⚡ Быстрые ответы — отдельная кнопка */}
        <DropdownMenu onOpenChange={(open) => { if (open) loadTemplates() }}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 flex-shrink-0 border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
              aria-label={isRu ? 'Быстрые ответы' : 'Quick replies'}
              disabled={disabled}
              title={isRu ? 'Быстрые ответы' : 'Quick replies'}
            >
              <Zap className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto">
            {/* Системные шаблоны */}
            <DropdownMenuLabel className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 sticky top-0 bg-white py-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {isRu ? 'Быстрые ответы' : 'Quick replies'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {QUICK_REPLIES.map((q, i) => (
              <DropdownMenuItem
                key={i}
                className="flex cursor-pointer flex-col items-start gap-1 py-2.5"
                onSelect={(e) => {
                  e.preventDefault()
                  onMessageChange(isRu ? q.textRu : q.textEn)
                }}
              >
                <span className="flex w-full items-center gap-2">
                  <Quote className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="text-sm font-medium text-slate-800">{isRu ? q.shortRu : q.shortEn}</span>
                </span>
                <span className="line-clamp-2 pl-[1.375rem] text-xs text-slate-500 leading-snug">
                  {isRu ? q.textRu : q.textEn}
                </span>
              </DropdownMenuItem>
            ))}

            {/* Сохранённые шаблоны пользователя */}
            {savedTemplates.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 sticky top-0 bg-white py-2">
                  <Bookmark className="h-3.5 w-3.5 text-teal-500" />
                  {isRu ? 'Мои шаблоны' : 'My templates'}
                </DropdownMenuLabel>
                {savedTemplates.map((tpl) => (
                  <DropdownMenuItem
                    key={tpl.id}
                    className="flex cursor-pointer items-start gap-1 py-2.5"
                    onSelect={(e) => {
                      e.preventDefault()
                      onMessageChange(tpl.text)
                    }}
                  >
                    <Quote className="h-3.5 w-3.5 shrink-0 text-teal-500 mt-0.5" />
                    <span className="flex-1 text-sm text-slate-800 line-clamp-2">{tpl.label || tpl.text}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(tpl.id) }}
                      title={isRu ? 'Удалить' : 'Delete'}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {/* Сохранить текущий текст как шаблон */}
            {newMessage.trim() && (
              <>
                <DropdownMenuSeparator />
                {showSaveInput ? (
                  <div className="px-2 py-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={newTplLabel}
                      onChange={(e) => setNewTplLabel(e.target.value)}
                      placeholder={isRu ? 'Название шаблона…' : 'Template name…'}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs focus:border-teal-400 outline-none"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentAsTemplate() }}
                    />
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 flex-1 text-xs bg-teal-600 hover:bg-teal-700"
                        disabled={savingTemplate}
                        onClick={saveCurrentAsTemplate}
                      >
                        {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : (isRu ? 'Сохранить' : 'Save')}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSaveInput(false)}>
                        {isRu ? 'Отмена' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2 py-2 text-teal-700"
                    onSelect={(e) => { e.preventDefault(); setShowSaveInput(true) }}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-medium">
                      {isRu ? 'Сохранить как шаблон' : 'Save as template'}
                    </span>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Состояние предпросмотра голосового */}
        {audioBlob ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50 border border-teal-200">
            <audio src={audioUrl} controls className="h-8 flex-1 min-w-0" />
            <span className="text-xs text-teal-700 font-medium tabular-nums shrink-0">{durationLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:bg-red-50 shrink-0"
              onClick={discardRecording}
              title="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              disabled={voiceSending}
              className="h-8 px-3 bg-teal-600 hover:bg-teal-700 shrink-0"
              onClick={handleSendVoice}
            >
              {voiceSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : isRecording ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-red-700 font-medium flex-1">
              {isRu ? 'Запись...' : 'Recording...'} {durationLabel}
            </span>
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 bg-red-500 hover:bg-red-600 shrink-0"
              onClick={stopRecording}
              title={isRu ? 'Остановить' : 'Stop'}
            >
              <MicOff className="h-4 w-4 text-white" />
            </Button>
          </div>
        ) : (
          <>
            <ChatGrowingTextarea
              value={newMessage}
              onChange={onMessageChange}
              placeholder={getUIText('chatComposerPlaceholder', language)}
              disabled={sending || disabled}
            />
            {/* Микрофон — показываем только когда поле ввода пустое */}
            {!newMessage.trim() && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 flex-shrink-0 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                disabled={disabled || sending}
                onClick={startRecording}
                title={isRu ? 'Голосовое сообщение' : 'Voice message'}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending || disabled}
              className="h-10 w-10 flex-shrink-0 bg-teal-600 hover:bg-teal-700 sm:w-auto sm:px-4"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
