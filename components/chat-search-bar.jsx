'use client'

/**
 * ChatSearchBar — инлайн-поиск по сообщениям диалога.
 * Размещается под StickyChatHeader при активации иконки лупы.
 *
 * Props:
 *  - value: string — текущий поисковый запрос
 *  - onChange: (v: string) => void
 *  - resultCount: number | null — кол-во найденных (null = нет поиска)
 *  - onClose: () => void
 *  - language: 'ru' | 'en' | 'th' | 'zh'
 */

import { useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { highlightText } from '@/lib/chat-highlight-text'

const LABELS = {
  ru: { placeholder: 'Поиск по сообщениям…', found: 'найдено', notFound: 'Не найдено' },
  en: { placeholder: 'Search messages…', found: 'found', notFound: 'Not found' },
  th: { placeholder: 'ค้นหาข้อความ…', found: 'พบ', notFound: 'ไม่พบ' },
  zh: { placeholder: '搜索消息…', found: '已找到', notFound: '未找到' },
}

function l(lang, key) {
  return (LABELS[lang] || LABELS.ru)[key]
}

export function ChatSearchBar({ value, onChange, resultCount, onClose, language = 'ru' }) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const hasQuery = value.trim().length > 0
  const hasResults = resultCount !== null && resultCount > 0

  return (
    <div className="border-b border-slate-100 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-2">
      <Search className="h-4 w-4 text-slate-400 shrink-0" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={l(language, 'placeholder')}
        className="flex-1 min-w-0 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
      />
      {hasQuery && (
        <span
          className={cn(
            'text-xs tabular-nums shrink-0',
            hasResults ? 'text-teal-600' : 'text-red-500',
          )}
        >
          {resultCount === 0
            ? l(language, 'notFound')
            : `${resultCount} ${l(language, 'found')}`}
        </span>
      )}
      <button
        type="button"
        className="shrink-0 rounded-2xl p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700"
        onClick={onClose}
        aria-label="Close search"
      >
        <X className="h-4 w-4" />
      </button>
      </div>
    </div>
  )
}

export { highlightText }
