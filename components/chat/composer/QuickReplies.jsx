'use client'

/**
 * @file components/chat/composer/QuickReplies.jsx
 *
 * Кнопка ⚡ + выпадающее меню быстрых ответов для чат-композера.
 *
 * Содержит:
 *   – системные шаблоны (QUICK_REPLIES, захардкожены)
 *   – пользовательские шаблоны (загрузка/сохранение/удаление через /api/v2/chat/templates)
 *
 * @param {Object}   props
 * @param {string}   props.currentMessage  — текущий текст в поле ввода (для «Сохранить как шаблон»)
 * @param {Function} props.onSelect        — (text: string) => void — вставить текст в поле ввода
 * @param {string}   [props.language]
 * @param {boolean}  [props.disabled]
 */

import { useState, useCallback, useEffect } from 'react'
import { Bookmark, BookmarkPlus, Loader2, Quote, X, Zap } from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export function QuickReplies({ currentMessage, onSelect, language = 'ru', disabled }) {
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
    } catch { /* ignore */ } finally {
      setTplLoaded(true)
    }
  }, [tplLoaded])

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

  const panel = (
    <QuickRepliesPanelInner
      isRu={isRu}
      currentMessage={currentMessage}
      onSelect={onSelect}
      disabled={disabled}
      savedTemplates={savedTemplates}
      showSaveInput={showSaveInput}
      setShowSaveInput={setShowSaveInput}
      newTplLabel={newTplLabel}
      setNewTplLabel={setNewTplLabel}
      savingTemplate={savingTemplate}
      saveCurrentAsTemplate={saveCurrentAsTemplate}
      deleteTemplate={deleteTemplate}
    />
  )

  return (
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
        {panel}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Содержимое меню быстрых ответов — можно вложить в DropdownMenuSubContent.
 */
export function QuickRepliesPanel({
  currentMessage,
  onSelect,
  language = 'ru',
  disabled,
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
    } catch { /* ignore */ } finally {
      setTplLoaded(true)
    }
  }, [tplLoaded])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

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

  return (
    <QuickRepliesPanelInner
      isRu={isRu}
      currentMessage={currentMessage}
      onSelect={onSelect}
      disabled={disabled}
      savedTemplates={savedTemplates}
      showSaveInput={showSaveInput}
      setShowSaveInput={setShowSaveInput}
      newTplLabel={newTplLabel}
      setNewTplLabel={setNewTplLabel}
      savingTemplate={savingTemplate}
      saveCurrentAsTemplate={saveCurrentAsTemplate}
      deleteTemplate={deleteTemplate}
    />
  )
}

function QuickRepliesPanelInner({
  isRu,
  currentMessage,
  onSelect,
  disabled,
  savedTemplates,
  showSaveInput,
  setShowSaveInput,
  newTplLabel,
  setNewTplLabel,
  savingTemplate,
  saveCurrentAsTemplate,
  deleteTemplate,
}) {
  return (
    <>
      <DropdownMenuLabel className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 sticky top-0 bg-popover py-2 z-[1]">
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        {isRu ? 'Быстрые ответы' : 'Quick replies'}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {QUICK_REPLIES.map((q, i) => (
        <DropdownMenuItem
          key={i}
          className="flex cursor-pointer flex-col items-start gap-1 py-2.5"
          disabled={disabled}
          onSelect={(e) => { e.preventDefault(); onSelect(isRu ? q.textRu : q.textEn) }}
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

      {savedTemplates.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 sticky top-0 bg-popover py-2 z-[1]">
            <Bookmark className="h-3.5 w-3.5 text-teal-500" />
            {isRu ? 'Мои шаблоны' : 'My templates'}
          </DropdownMenuLabel>
          {savedTemplates.map((tpl) => (
            <DropdownMenuItem
              key={tpl.id}
              className="flex cursor-pointer items-start gap-1 py-2.5"
              disabled={disabled}
              onSelect={(e) => { e.preventDefault(); onSelect(tpl.text) }}
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

      {currentMessage.trim() && (
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowSaveInput(false)}
                >
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
    </>
  )
}
