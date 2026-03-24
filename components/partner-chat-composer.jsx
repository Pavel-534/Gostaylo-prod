'use client'

import { useState, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
import { SendInvoiceDialog } from '@/components/chat-invoice'
import { Plus, Receipt, IdCard, Loader2, Send, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Поле ввода + меню «Действия» для партнёра.
 */
export function PartnerChatComposer({
  newMessage,
  onMessageChange,
  onSubmit,
  sending,
  disabled,
  booking,
  listing,
  onSendInvoice,
  onSendPassportRequest,
  onAttachFile,
}) {
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [passportLoading, setPassportLoading] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const fileRef = useRef(null)

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
    <div className="bg-white border-t p-4">
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
            className="flex-shrink-0 border-slate-200"
            disabled={disabled || attachBusy}
            aria-label="Прикрепить файл"
            onClick={() => fileRef.current?.click()}
          >
            {attachBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="flex-shrink-0 border-slate-200 h-10 w-10"
              aria-label="Действия"
              disabled={disabled}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onSelect={(e) => {
                e.preventDefault()
                setInvoiceOpen(true)
              }}
            >
              <Receipt className="h-4 w-4 text-amber-600" />
              Выставить счёт
            </DropdownMenuItem>
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
              Запросить фото паспорта
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

        <ChatGrowingTextarea
          value={newMessage}
          onChange={onMessageChange}
          placeholder="Сообщение…"
          disabled={sending || disabled}
        />
        <Button
          type="submit"
          disabled={!newMessage.trim() || sending || disabled}
          className="bg-teal-600 hover:bg-teal-700 flex-shrink-0 h-10 w-10 sm:w-auto sm:px-4"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
