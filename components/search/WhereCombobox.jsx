'use client'

/**
 * Поле «Куда» в стиле Airbnb: ввод в строке + подсказки (RU/EN/ZH/TH).
 * Клавиатура: ↑↓ навигация, Enter — выбор, Esc — закрыть.
 * Quick Chips: «Популярные направления» — мировой список (Россия / Таиланд / Мир),
 * сгруппированный по странам, показывается при пустом поле.
 *
 * @updated 2026-02 Global Pivot — POPULAR_PHUKET → POPULAR_DESTINATION_GROUPS
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapPin, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { filterWhereOptions, getOptionLabel } from '@/lib/locations/where-options'
import { splitLabelHighlight } from '@/lib/locations/location-text-match'
import { POPULAR_DESTINATION_GROUPS } from '@/lib/locations/popular-destinations'
import { reorderDestinationsByGeo } from '@/lib/locations/reorder-by-geo'
import { useUserGeo } from '@/lib/hooks/useUserGeo'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

function matchKindTooltip(language, opt) {
  if (opt.match_kind === 'synonym' && opt.matched_synonym) {
    if (language === 'ru') return `Синоним: «${opt.matched_synonym}»`
    if (language === 'th') return `คำพ้อง: ${opt.matched_synonym}`
    if (language === 'zh') return `同义词：${opt.matched_synonym}`
    return `Synonym: ${opt.matched_synonym}`
  }
  if (opt.match_kind === 'unverified' || opt.is_new) {
    if (language === 'ru') return 'Новая локация — ожидает проверки'
    if (language === 'th') return 'สถานที่ใหม่ — รอการตรวจสอบ'
    if (language === 'zh') return '新地点 — 待审核'
    return 'New location — pending review'
  }
  return undefined
}

function WhereOptionLabel({ opt, query = '', language = 'ru' }) {
  const count = opt.listing_count
  const tooltip = matchKindTooltip(language, opt)
  const needle =
    opt.matched_synonym ||
    (opt.matched_term &&
    opt.label.toLowerCase().includes(String(opt.matched_term).toLowerCase())
      ? opt.matched_term
      : query.trim())
  const hl = splitLabelHighlight(opt.label, needle)

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2" title={tooltip}>
      <span className="min-w-0 truncate">
        {hl ? (
          <>
            {hl.before}
            <mark className="rounded-sm bg-brand/15 text-inherit">{hl.match}</mark>
            {hl.after}
          </>
        ) : (
          opt.label
        )}
      </span>
      {typeof count === 'number' && count > 0 ? (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-400">
          {count}
        </span>
      ) : opt.match_kind === 'synonym' ? (
        <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          ≈
        </span>
      ) : opt.match_kind === 'unverified' || opt.is_new ? (
        <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
          new
        </span>
      ) : null}
    </span>
  )
}

function didYouMeanCopy(language, label) {
  if (language === 'ru') return `Возможно, вы имели в виду: ${label}`
  if (language === 'th') return `คุณหมายถึง: ${label}`
  if (language === 'zh') return `您是否指的是：${label}`
  return `Did you mean: ${label}`
}

function approximateMatchCopy(language, label) {
  if (language === 'ru') return `Примерно соответствует: ${label}`
  if (language === 'th') return `ตรงกันโดยประมาณ: ${label}`
  if (language === 'zh') return `大致匹配：${label}`
  return `Approximate match: ${label}`
}

export function WhereCombobox({
  options,
  value,
  onChange,
  placeholder,
  variant = 'hero',
  className,
  loading = false,
  loadingPlaceholder = '…',
  language = 'ru',
  fetchSuggestions,
  suggestDebounceMs = 250,
}) {
  const [inputValue, setInputValue] = useState('')
  const [drawerQuery, setDrawerQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listboxId = useRef(`where-listbox-${Math.random().toString(36).slice(2, 9)}`).current
  const isMobile = useIsMobile()
  const useServerSuggest = typeof fetchSuggestions === 'function'
  const [suggestOptions, setSuggestOptions] = useState([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const suggestSeqRef = useRef(0)
  // Override-карта { value → localizedLabel } — нужна когда option.label из API это slug ("moscow"),
  // а chip принёс локализованную строку ("Москва"). Без этого sync-effect на value→label
  // перезаписывал бы наш override на slug.
  const overrideLabelRef = useRef({})

  // Smart geolocation — re-order popular destinations by user's country
  const { country: userCountry } = useUserGeo()
  const orderedGroups = useMemo(
    () => reorderDestinationsByGeo(POPULAR_DESTINATION_GROUPS, userCountry),
    [userCountry],
  )

  // Синхронизация подписи с выбранным каноническим значением
  useEffect(() => {
    if (value === 'all' || !value) {
      setInputValue('')
      return
    }
    const override = overrideLabelRef.current?.[value]
    const label = override || getOptionLabel(options, value)
    setInputValue(label)
  }, [value, options])

  const activeQuery = isMobile ? drawerQuery : inputValue
  const activeQueryTrimmed = activeQuery.trim()

  useEffect(() => {
    if (!useServerSuggest || !open || !activeQueryTrimmed) {
      setSuggestOptions([])
      setSuggestLoading(false)
      return
    }

    const seq = ++suggestSeqRef.current
    const timer = setTimeout(() => {
      setSuggestLoading(true)
      fetchSuggestions(activeQueryTrimmed)
        .then((items) => {
          if (seq !== suggestSeqRef.current) return
          setSuggestOptions(Array.isArray(items) ? items : [])
        })
        .catch(() => {
          if (seq !== suggestSeqRef.current) return
          setSuggestOptions([])
        })
        .finally(() => {
          if (seq !== suggestSeqRef.current) return
          setSuggestLoading(false)
        })
    }, suggestDebounceMs)

    return () => clearTimeout(timer)
  }, [
    activeQueryTrimmed,
    fetchSuggestions,
    open,
    suggestDebounceMs,
    useServerSuggest,
  ])

  const displayed = useMemo(() => {
    const q = inputValue.trim()
    if (useServerSuggest && q) {
      if (suggestLoading && suggestOptions.length === 0) return []
      return suggestOptions.slice(0, 20)
    }
    if (!q) {
      const all = options.find((o) => o.type === 'all')
      const rest = options.filter((o) => o.type !== 'all').slice(0, 12)
      return all ? [all, ...rest] : rest
    }
    return filterWhereOptions(options, q).slice(0, 20)
  }, [options, inputValue, useServerSuggest, suggestOptions, suggestLoading])

  const fieldLoading = loading || (useServerSuggest && suggestLoading && activeQueryTrimmed)

  const didYouMeanHint = useMemo(() => {
    if (!useServerSuggest || !activeQueryTrimmed || displayed.length === 0) return null
    const top = displayed[0]
    if (top.match_kind === 'unverified' || top.is_new) {
      return approximateMatchCopy(language, top.label)
    }
    if (top.match_kind !== 'fuzzy') return null
    if (displayed.some((o) => o.match_kind === 'exact' || o.match_kind === 'alias')) return null
    return didYouMeanCopy(language, top.label)
  }, [activeQueryTrimmed, displayed, language, useServerSuggest])

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [inputValue, options])

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current || !open) return
    const el = listRef.current.querySelector(`[data-idx="${highlightedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightedIndex, open, displayed])

  const handleSelect = useCallback(
    (opt, displayLabelOverride) => {
      onChange?.(opt.value)
      if (opt.type === 'all') {
        setInputValue('')
      } else {
        setInputValue(displayLabelOverride || opt.label)
      }
      setOpen(false)
      setHighlightedIndex(-1)
    },
    [onChange]
  )

  const clear = useCallback(
    (e) => {
      e?.stopPropagation()
      onChange?.('all')
      setInputValue('')
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [onChange]
  )

  const onInputChange = (e) => {
    if (!open) setOpen(true)
    setInputValue(e.target.value)
  }

  const onFocus = () => {
    if (!fieldLoading) setOpen(true)
  }

  const onKeyDown = (e) => {
    if (fieldLoading) return

    if (e.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
      inputRef.current?.blur()
      return
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && displayed.length > 0) {
      e.preventDefault()
      setOpen(true)
      setHighlightedIndex(e.key === 'ArrowDown' ? 0 : displayed.length - 1)
      return
    }

    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (displayed.length === 0) return
      setHighlightedIndex((i) => (i < 0 ? 0 : (i + 1) % displayed.length))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (displayed.length === 0) return
      setHighlightedIndex((i) => (i <= 0 ? displayed.length - 1 : i - 1))
      return
    }

    if (e.key === 'Enter') {
      if (displayed.length === 0) return
      const idx =
        highlightedIndex >= 0 ? highlightedIndex : displayed.length === 1 ? 0 : -1
      if (idx >= 0 && displayed[idx]) {
        e.preventDefault()
        handleSelect(displayed[idx])
      }
    }
  }

  const isHero = variant === 'hero'
  const isFlat = variant === 'flat'
  // Когда пользователь ничего не ввёл — показываем «Популярные направления»
  // (приоритет над list, чтобы был обзор по миру, а не свалка опций)
  const isEmptyInput = inputValue.trim() === ''
  const showQuickChips = open && !loading && isEmptyInput
  const showList = open && !fieldLoading && displayed.length > 0 && !isEmptyInput
  const drawerDisplayed = useMemo(() => {
    const q = drawerQuery.trim()
    if (useServerSuggest && q) {
      if (suggestLoading && suggestOptions.length === 0) return []
      return suggestOptions.slice(0, 30)
    }
    if (!q) {
      const all = options.find((o) => o.type === 'all')
      const rest = options.filter((o) => o.type !== 'all').slice(0, 20)
      return all ? [all, ...rest] : rest
    }
    return filterWhereOptions(options, q).slice(0, 30)
  }, [options, drawerQuery, useServerSuggest, suggestOptions, suggestLoading])

  // Быстрый выбор локации по chip
  const handleChipSelect = useCallback(
    (chip) => {
      const localized = chip.labels?.[language] || chip.labels?.en || chip.value
      // Регистрируем override ДО вызова onChange — чтобы sync-effect использовал его, а не slug.
      overrideLabelRef.current = { ...overrideLabelRef.current, [chip.value]: localized }
      // Ищем в options по value (предпочтительно) или по любому label
      const labelEn = chip.labels?.en?.toLowerCase() || ''
      const valLower = chip.value?.toLowerCase() || ''
      const found = options.find(
        (o) =>
          (o.value || '').toLowerCase() === valLower ||
          (o.label || '').toLowerCase() === labelEn ||
          (o.label || '').toLowerCase().includes(valLower),
      )
      if (found) {
        // override visible label с локализованной строкой chip
        handleSelect(found, localized)
      } else {
        // Фолбэк: ставим slug + локализованную надпись (динамика готова к расширению options)
        onChange?.(chip.value)
        setInputValue(localized)
        setOpen(false)
      }
    },
    [options, handleSelect, onChange, language],
  )

  useEffect(() => {
    if (!isMobile || !open) return
    setDrawerQuery('')
  }, [isMobile, open])

  const triggerField = (
    <div
      className={cn(
        'flex items-center gap-3 text-left w-full min-w-0',
        isHero
          ? 'px-4 py-3 border-r border-slate-200'
          : isFlat
            ? 'h-full min-h-0 self-stretch px-5 bg-transparent'
            : 'px-2 h-9 border rounded-md bg-white',
        loading && 'opacity-90'
      )}
    >
      {fieldLoading ? (
        <Loader2
          className={cn(
            'text-brand flex-shrink-0 animate-spin',
            isFlat ? 'h-5 w-5' : 'h-4 w-4',
          )}
          aria-hidden
        />
      ) : (
        <MapPin
          className={cn('text-brand flex-shrink-0', isFlat ? 'h-5 w-5' : 'h-4 w-4')}
          aria-hidden
        />
      )}
      {isMobile ? (
        <button
          type="button"
          disabled={fieldLoading}
          onClick={() => setOpen(true)}
          className={cn(
            'min-w-0 flex-1 truncate bg-transparent text-left outline-none disabled:cursor-wait',
            isHero
              ? 'text-sm text-slate-700'
              : isFlat
                ? 'text-base font-medium leading-none text-slate-900'
                : 'text-sm text-slate-700',
          )}
        >
          {(value && value !== 'all') ? inputValue : (fieldLoading ? loadingPlaceholder : placeholder)}
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={fieldLoading}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
          }
          aria-label={placeholder || 'Where'}
          placeholder={fieldLoading ? loadingPlaceholder : placeholder}
          value={inputValue}
          onChange={onInputChange}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none text-slate-800 disabled:cursor-wait',
            isHero
              ? 'text-sm placeholder:text-slate-500'
              : isFlat
                ? 'text-base font-medium leading-none text-slate-900 placeholder:text-slate-500'
                : 'text-sm h-8 placeholder:text-slate-400'
          )}
        />
      )}
      {value && value !== 'all' && !fieldLoading && (
        <button
          type="button"
          onClick={clear}
          className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
          aria-label="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div className={cn('relative', open && 'z-[140]', className)}>
      {isMobile ? (
        <>
          {triggerField}
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="h-[82vh] max-h-[82vh]">
              <DrawerHeader className="border-b pb-3">
                <DrawerTitle>{placeholder || getUIText('whereShort', language)}</DrawerTitle>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto p-4">
                <Input
                  value={drawerQuery}
                  onChange={(e) => setDrawerQuery(e.target.value)}
                  placeholder={getUIText('cityOrAreaHint', language)}
                  className="mb-3"
                />
                {drawerQuery.trim() === '' ? (
                  <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {getUIText('popularDestinations', language)}
                    </p>
                    {orderedGroups.map((group) => (
                      <div key={group.id}>
                        <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500">
                          <span aria-hidden>{group.flag}</span>
                          <span>{group.titles[language] || group.titles.en}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map((chip) => {
                            const label = chip.labels[language] || chip.labels.en
                            const active = value === chip.value
                            return (
                              <button
                                key={chip.value}
                                type="button"
                                onClick={() => {
                                  handleChipSelect(chip)
                                  setOpen(false)
                                }}
                                className={cn(
                                  'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150',
                                  active
                                    ? 'border-brand/40 bg-brand/10 text-brand-hover'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand/30 hover:bg-brand/10 hover:text-brand-hover',
                                )}
                              >
                                <MapPin className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="space-y-1">
                  {drawerDisplayed.map((opt) => (
                    <button
                      key={`${opt.type}-${opt.value}`}
                      type="button"
                      onClick={() => {
                        handleSelect(opt)
                        setOpen(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-sm rounded-lg border flex items-start gap-2 transition-colors',
                        value === opt.value
                          ? 'border-brand/30 bg-brand/10 text-brand'
                          : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" aria-hidden />
                      <WhereOptionLabel opt={opt} query={drawerQuery.trim()} language={language} />
                    </button>
                  ))}
                </div>
                {didYouMeanHint ? (
                  <p className="mt-2 px-1 text-xs text-slate-500">{didYouMeanHint}</p>
                ) : null}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>{triggerField}</PopoverAnchor>
          <PopoverContent
            align="start"
            className={cn(
              'w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] min-w-[18rem] max-h-[min(70vh,560px)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl',
              (showList || showQuickChips) && 'z-[220]',
            )}
          >
            {showList ? (
              <>
              <ul ref={listRef} id={listboxId} className="max-h-[50vh] overflow-y-auto" role="listbox">
                {displayed.map((opt, i) => {
                  const active = i === highlightedIndex
                  return (
                    <li
                      key={`${opt.type}-${opt.value}`}
                      role="presentation"
                      data-idx={i}
                      id={`${listboxId}-opt-${i}`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === opt.value}
                        className={cn(
                          'w-full rounded-lg text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-colors',
                          active ? 'bg-brand/10 text-brand' : 'hover:bg-slate-50',
                          value === opt.value && !active && 'bg-brand/10 text-brand-hover'
                        )}
                        onMouseEnter={() => setHighlightedIndex(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelect(opt)}
                      >
                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" aria-hidden />
                        <WhereOptionLabel opt={opt} query={inputValue.trim()} language={language} />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {didYouMeanHint ? (
                <p className="mt-1 px-2 pb-1 text-xs text-slate-500">{didYouMeanHint}</p>
              ) : null}
              </>
            ) : null}
            {showQuickChips ? (
              <div className="space-y-3 p-1">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {getUIText('popularDestinations', language)}
                </p>
                {orderedGroups.map((group) => (
                  <div key={group.id}>
                    <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500">
                      <span aria-hidden>{group.flag}</span>
                      <span>{group.titles[language] || group.titles.en}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((chip) => {
                        const label = chip.labels[language] || chip.labels.en
                        const active = value === chip.value
                        return (
                          <button
                            key={chip.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleChipSelect(chip)}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150',
                              active
                                ? 'border-brand/40 bg-brand/10 text-brand-hover'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand/30 hover:bg-brand/10 hover:text-brand-hover',
                            )}
                          >
                            <MapPin className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
