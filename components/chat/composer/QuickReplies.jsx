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
import { getUIText } from '@/lib/translations'

function quickReplyPick(q, lang, field) {
  if (lang === 'en') return q[`${field}En`]
  if (lang === 'ru') return q[`${field}Ru`]
  return q[`${field}En`]
}

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
  const tx = (key) => getUIText(key, language)

  const [savedTemplates, setSavedTemplates] = useState([])
  const [tplLoaded, setTplLoaded] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [newTplLabel, setNewTplLabel] = useState('')

  const loadTemplates = useCallback(async () => {
    if (tplLoaded) return
    try {
      const { ok, templates } = await fetchChatTemplates()
      if (ok) setSavedTemplates(templates)
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
      const { ok, json } = await saveChatTemplate({
        text,
        label: newTplLabel.trim() || text.slice(0, 40),
      })
      if (ok) {
        setSavedTemplates(json.data || [])
        toast.success(tx('chatTemplateSaved'))
        setShowSaveInput(false)
        setNewTplLabel('')
      } else {
        toast.error(json.error || tx('chatGenericError'))
      }
    } catch {
      toast.error(tx('chatGenericError'))
    } finally {
      setSavingTemplate(false)
    }
  }

  async function deleteTemplate(id) {
    try {
      const { ok, json } = await deleteChatTemplate(id)
      if (ok) setSavedTemplates(json.data || [])
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
          {tx('chatQuickReplies')}
        </SectionTitle>
        <div className="flex flex-col gap-0.5 pt-1">
          {QUICK_REPLIES.map((q, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-2xl px-2 py-2.5 text-left outline-none hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => pick(quickReplyPick(q, language, 'text'))}
            >
              <span className="flex w-full items-center gap-2">
                <Quote className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="text-sm font-medium text-slate-800">
                  {quickReplyPick(q, language, 'short')}
                </span>
              </span>
              <span className="line-clamp-2 pl-[1.375rem] text-xs leading-snug text-slate-500">
                {quickReplyPick(q, language, 'text')}
              </span>
            </button>
          ))}
        </div>

        {savedTemplates.length > 0 && (
          <>
            <div className="my-2 h-px bg-slate-100" />
            <SectionTitle icon={Bookmark} iconClass="text-brand/70">
              {tx('chatMyTemplates')}
            </SectionTitle>
            <div className="flex flex-col gap-0.5 pt-1">
              {savedTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-start gap-1 rounded-2xl px-1 py-1 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-1 rounded-2xl px-1 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => pick(tpl.text)}
                  >
                    <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand/70" />
                    <span className="line-clamp-2 flex-1 text-sm text-slate-800">{tpl.label || tpl.text}</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteTemplate(tpl.id)
                    }}
                    title={tx('chatTemplateDelete')}
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
                  placeholder={tx('chatTemplateNamePlaceholder')}
                  className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand/40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveCurrentAsTemplate()
                  }}
                />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    disabled={savingTemplate}
                    onClick={() => void saveCurrentAsTemplate()}
                  >
                    {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : tx('chatTemplateSave')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSaveInput(false)}>
                    {tx('chatTemplateCancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-2xl px-2 py-2 text-left text-brand-hover outline-none hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand/30"
                onClick={() => setShowSaveInput(true)}
              >
                <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium">{tx('chatSaveTemplate')}</span>
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
