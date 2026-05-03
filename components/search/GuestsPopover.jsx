'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Users } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function normalizeTotal(guests) {
  return Math.max(1, toInt(guests, 1))
}

function normalizeBreakdown(breakdown, guestsTotal) {
  const total = normalizeTotal(guestsTotal)
  const b = breakdown && typeof breakdown === 'object' ? breakdown : null
  if (!b) return { adults: total, children: 0, infants: 0 }
  const adults = Math.max(1, toInt(b.adults, total))
  const children = Math.max(0, toInt(b.children, 0))
  const infants = Math.max(0, toInt(b.infants, 0))
  const sum = adults + children + infants
  if (sum === total) return { adults, children, infants }
  if (sum < total) return { adults: adults + (total - sum), children, infants }
  const overflow = sum - total
  const nextChildren = Math.max(0, children - overflow)
  const leftOverflow = overflow - (children - nextChildren)
  const nextInfants = Math.max(0, infants - leftOverflow)
  return { adults, children: nextChildren, infants: nextInfants }
}

function ruPluralKind(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'one'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'few'
  return 'many'
}

function tr(getter, key, fallback) {
  const v = getter(key)
  return v && v !== key ? v : fallback
}

function wordFor(kind, count, language, getter) {
  const n = Math.max(0, toInt(count, 0))
  if (language === 'ru') {
    const form = ruPluralKind(n)
    return tr(getter, `${kind}_${form}`, tr(getter, `${kind}_many`, ''))
  }
  if (language === 'en') {
    const form = n === 1 ? 'one' : 'other'
    return tr(getter, `${kind}_${form}`, tr(getter, `${kind}_other`, ''))
  }
  return tr(getter, `${kind}_other`, '')
}

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

export function formatGuestsSummaryText({ adults = 1, children = 0, infants = 0 }, language = 'ru') {
  const t = (k) => getUIText(k, language)
  const total = Math.max(1, toInt(adults, 1) + toInt(children, 0) + toInt(infants, 0))
  const guestWord = wordFor('guestsWord', total, language, t)
  const childrenN = Math.max(0, toInt(children, 0))
  const infantsN = Math.max(0, toInt(infants, 0))
  const parts = [`${total} ${guestWord}`]
  if (childrenN > 0) parts.push(`${childrenN} ${wordFor('childrenWord', childrenN, language, t)}`)
  if (infantsN > 0) parts.push(`${infantsN} ${wordFor('infantsWord', infantsN, language, t)}`)
  return parts.join(', ')
}

export function GuestsPopover({
  language = 'ru',
  guests = '1',
  setGuests,
  guestsBreakdown = null,
  setGuestsBreakdown,
  align = 'start',
  triggerClassName,
  contentClassName,
  disabled = false,
}) {
  const t = (key, fallback) => tr((k) => getUIText(k, language), key, fallback)
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(() => normalizeBreakdown(guestsBreakdown, guests))
  const isMobile = useIsMobile()

  useEffect(() => {
    setLocal(normalizeBreakdown(guestsBreakdown, guests))
  }, [guestsBreakdown, guests])

  const total = local.adults + local.children + local.infants
  const summary = useMemo(() => formatGuestsSummaryText(local, language), [local, language])

  const update = (patch) => {
    setLocal((prev) => {
      const next = { ...prev, ...patch }
      const guestsTotal = String(Math.max(1, next.adults + next.children + next.infants))
      setGuests?.(guestsTotal)
      setGuestsBreakdown?.(next)
      return next
    })
  }

  const rows = [
    {
      key: 'adults',
      label: t('guestsAdultsLabel', language === 'ru' ? 'Взрослые' : 'Adults'),
      hint: t('guestsAdultsHint', language === 'ru' ? 'В возрасте от 13 и старше' : 'Ages 13 or above'),
      min: 1,
    },
    {
      key: 'children',
      label: t('guestsChildrenLabel', language === 'ru' ? 'Дети' : 'Children'),
      hint: t('guestsChildrenHint', language === 'ru' ? 'Возраст 2-12 лет' : 'Ages 2-12'),
      min: 0,
    },
    {
      key: 'infants',
      label: t('guestsInfantsLabel', language === 'ru' ? 'Младенцы' : 'Infants'),
      hint: t('guestsInfantsHint', language === 'ru' ? 'До 2 лет' : 'Under 2'),
      min: 0,
    },
  ]

  const rowsContent = (
    <div className="space-y-1.5">
      {rows.map((row, idx) => {
        const value = local[row.key]
        const canDec = value > row.min
        return (
          <div
            key={row.key}
            className={cn(
              'flex items-center justify-between gap-3 py-2',
              idx < rows.length - 1 && 'border-b border-slate-100',
            )}
          >
            <div className="min-w-0">
              <p className="text-base font-medium text-slate-900">{row.label}</p>
              <p className="text-sm text-slate-500">{row.hint}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canDec}
                onClick={() => canDec && update({ [row.key]: value - 1 })}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors',
                  canDec ? 'hover:border-slate-300 hover:bg-slate-50' : 'cursor-not-allowed opacity-40',
                )}
                aria-label={language === 'ru' ? `Уменьшить: ${row.label}` : `Decrease ${row.label}`}
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="w-6 text-center text-sm font-semibold text-slate-900">{value}</span>
              <button
                type="button"
                onClick={() => update({ [row.key]: value + 1 })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                aria-label={language === 'ru' ? `Увеличить: ${row.label}` : `Increase ${row.label}`}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      {isMobile ? (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className={cn(
              'flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50/50 disabled:cursor-not-allowed disabled:opacity-50',
              triggerClassName,
            )}
            aria-label={t('mobileSearchWhoTitle', language === 'ru' ? 'Кто едет' : 'Who')}
          >
            <Users className="h-4 w-4 shrink-0 text-[#006666]" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{summary || `${total}`}</span>
          </button>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="h-[78vh] max-h-[78vh] rounded-t-[28px]">
              <DrawerHeader className="border-b pb-3">
                <DrawerTitle>{t('mobileSearchWhoTitle', language === 'ru' ? 'Кто едет' : 'Who')}</DrawerTitle>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto p-4">{rowsContent}</div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50/50 disabled:cursor-not-allowed disabled:opacity-50',
                triggerClassName,
              )}
              aria-label={t('mobileSearchWhoTitle', language === 'ru' ? 'Кто едет' : 'Who')}
            >
              <Users className="h-4 w-4 shrink-0 text-[#006666]" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{summary || `${total}`}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align={align}
            className={cn('w-[min(100vw-2rem,420px)] rounded-3xl border border-slate-100 bg-white p-4 shadow-xl', contentClassName)}
          >
            {rowsContent}
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}

export default GuestsPopover
