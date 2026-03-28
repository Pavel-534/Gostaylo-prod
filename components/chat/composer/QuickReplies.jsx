'use client'

/**
 * @file components/chat/composer/QuickReplies.jsx
 *
 * Быстрые ответы для композера: панель без DropdownMenu (для Popover у поля ввода).
 * Popover в PartnerChatComposer привязан к капсуле (+ / ⚡ / поле) — стабильнее при клавиатуре на мобильных.
 */

import { useState, useCallback, useEffect } from 'react'
import { Bookmark, BookmarkPlus, Loader2, Quote, X, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

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

function SectionTitle({ icon: Icon, iconClass, children }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-slate-100 bg-popover px-2 py-2 text-xs font-semibold text-slate-600">
      {Icon ? <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass || ''}`} /> : null}
      {children}
    </div>
  )
}

/**
 * Скроллируемая панель быстрых ответов (для Popover).
 * @param {boolean} [props.active] — подгружать шаблоны только когда Popover открыт (экономия запросов)
 */
export function QuickRepliesScrollablePanel({
  currentMessage,
  onSelect,
  language = 'ru',
  disabled,
  active = true,
}) {
  const isRu = language !== 'en'

  const [savedTemplates, setSavedTemplates] = useState([])
  const [tplLoaded, setTplLoaded] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [newTplLabel, setNewTplLabel] = useState('')

  const loadTemplates = useCallback(async () => {
    if (tplLoaded) return
    try {
      const res = await fetch('/api/v2/chat/templates', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setSavedTemplates(json.data || [])
    } catch {
      /* ignore */
    } finally {
      setTplLoaded(true)
    }
  }, [tplLoaded])

  useEffect(() => {
    if (active) void loadTemplates()
  }, [active, loadTemplates])

  async function saveCurrentAsTemplate() {
    const text = currentMessage.trim()
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
    } catch {
      toast.error('Ошибка')
    } finally {
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
    } catch {
      /* ignore */
    }
  }

  const pick = (text) => {
    if (disabled) return
    onSelect(text)
  }

  return (
    <div className="flex max-h-[min(50dvh,22rem)] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] p-1">
        <SectionTitle icon={Zap} iconClass="text-amber-500">
          {isRu ? 'Быстрые ответы' : 'Quick replies'}
        </SectionTitle>
        <div className="flex flex-col gap-0.5 pt-1">
          {QUICK_REPLIES.map((q, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-md px-2 py-2.5 text-left outline-none hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-500/30 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => pick(isRu ? q.textRu : q.textEn)}
            >
              <span className="flex w-full items-center gap-2">
                <Quote className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="text-sm font-medium text-slate-800">{isRu ? q.shortRu : q.shortEn}</span>
              </span>
              <span className="line-clamp-2 pl-[1.375rem] text-xs leading-snug text-slate-500">
                {isRu ? q.textRu : q.textEn}
              </span>
            </button>
          ))}
        </div>

        {savedTemplates.length > 0 && (
          <>
            <div className="my-2 h-px bg-slate-100" />
            <SectionTitle icon={Bookmark} iconClass="text-teal-500">
              {isRu ? 'Мои шаблоны' : 'My templates'}
            </SectionTitle>
            <div className="flex flex-col gap-0.5 pt-1">
              {savedTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-start gap-1 rounded-md px-1 py-1 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-1 rounded-md px-1 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => pick(tpl.text)}
                  >
                    <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                    <span className="line-clamp-2 flex-1 text-sm text-slate-800">{tpl.label || tpl.text}</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteTemplate(tpl.id)
                    }}
                    title={isRu ? 'Удалить' : 'Delete'}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {currentMessage.trim() ? (
          <>
            <div className="my-2 h-px bg-slate-100" />
            {showSaveInput ? (
              <div className="px-2 py-2" onPointerDown={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={newTplLabel}
                  onChange={(e) => setNewTplLabel(e.target.value)}
                  placeholder={isRu ? 'Название шаблона…' : 'Template name…'}
                  className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-teal-400"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveCurrentAsTemplate()
                  }}
                />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 flex-1 bg-teal-600 text-xs hover:bg-teal-700"
                    disabled={savingTemplate}
                    onClick={() => void saveCurrentAsTemplate()}
                  >
                    {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : isRu ? 'Сохранить' : 'Save'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSaveInput(false)}>
                    {isRu ? 'Отмена' : 'Cancel'}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-teal-700 outline-none hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-500/30"
                onClick={() => setShowSaveInput(true)}
              >
                <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium">{isRu ? 'Сохранить как шаблон' : 'Save as template'}</span>
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

/** Совместимость: панель всегда «активна» (например внутри постоянно открытого контейнера) */
export function QuickRepliesPanel(props) {
  return <QuickRepliesScrollablePanel {...props} active />
}
