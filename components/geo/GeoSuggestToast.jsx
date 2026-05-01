'use client'

/**
 * GeoSuggestToast — элегантное уведомление при первом визите: «Мы нашли объекты в X».
 *
 * Триггер:
 *   - На главной ("/") с where=all (или без where).
 *   - Юзер определился через useUserGeo (isResolved=true) И ему соответствует группа POPULAR_DESTINATIONS.
 *   - Не показываем если already dismissed (localStorage) или если юзер уже был в /listings.
 *   - Delay 3 секунды — чтобы не перебивать первое впечатление.
 *
 * Действие: кнопка «Показать» → навигация на /listings?where={countryCode}.
 *
 * Премиум стиль: card с teal-accent, serif заголовок, кнопки — pill + outline,
 * snap-in animation снизу справа (desktop) / снизу по центру (mobile).
 *
 * @created 2026-02 Global Engagement Sprint
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X, MapPin, Sparkles } from 'lucide-react'
import { useUserGeo } from '@/lib/hooks/useUserGeo'
import { useI18n } from '@/contexts/i18n-context'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'gostaylo_geo_suggest_dismissed_v1'

/** Страна (ISO-2) → локализованное имя + where-param для /listings */
const GEO_MAP = {
  RU: { where: 'RU', label: { ru: 'России',    en: 'Russia',    zh: '俄罗斯',     th: 'รัสเซีย' } },
  BY: { where: 'RU', label: { ru: 'России',    en: 'Russia',    zh: '俄罗斯',     th: 'รัสเซีย' } },
  UA: { where: 'RU', label: { ru: 'России',    en: 'Russia',    zh: '俄罗斯',     th: 'รัสเซีย' } },
  KZ: { where: 'RU', label: { ru: 'России',    en: 'Russia',    zh: '俄罗斯',     th: 'รัสเซีย' } },
  TH: { where: 'TH', label: { ru: 'Таиланде',  en: 'Thailand',  zh: '泰国',       th: 'ประเทศไทย' } },
  ID: { where: 'ID', label: { ru: 'Индонезии', en: 'Indonesia', zh: '印度尼西亚', th: 'อินโดนีเซีย' } },
  AE: { where: 'AE', label: { ru: 'ОАЭ',       en: 'UAE',       zh: '阿联酋',     th: 'ยูเออี' } },
  TR: { where: 'TR', label: { ru: 'Турции',    en: 'Turkey',    zh: '土耳其',     th: 'ตุรกี' } },
}

const STRINGS = {
  ru: {
    title: 'Мы нашли для вас объекты',
    msgPrefix: 'в',
    sub: 'Показать популярные направления прямо сейчас?',
    primary: 'Показать',
    secondary: 'Потом',
    ariaClose: 'Закрыть',
  },
  en: {
    title: 'We found listings for you',
    msgPrefix: 'in',
    sub: 'Want to see popular spots right now?',
    primary: 'Show',
    secondary: 'Later',
    ariaClose: 'Close',
  },
  zh: {
    title: '我们为您找到房源',
    msgPrefix: '在',
    sub: '现在查看热门地点吗？',
    primary: '查看',
    secondary: '稍后',
    ariaClose: '关闭',
  },
  th: {
    title: 'เราพบที่พักสำหรับคุณ',
    msgPrefix: 'ใน',
    sub: 'ดูจุดหมายยอดนิยมตอนนี้?',
    primary: 'แสดง',
    secondary: 'ภายหลัง',
    ariaClose: 'ปิด',
  },
}

export default function GeoSuggestToast() {
  const { country, isResolved } = useUserGeo()
  const { language } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    // Показываем ТОЛЬКО на главной
    if (pathname !== '/') return
    if (!isResolved || !country) return

    const geo = GEO_MAP[country.toUpperCase()]
    if (!geo) return // страна не в списке поддерживаемых

    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* SSR guard */
    }

    // Delay 3 sec — не перебиваем первое впечатление
    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [pathname, isResolved, country])

  const dismiss = () => {
    setClosing(true)
    setTimeout(() => setVisible(false), 250)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const handleAccept = () => {
    const geo = GEO_MAP[country?.toUpperCase()]
    if (!geo) return
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    router.push(`/listings?where=${encodeURIComponent(geo.where)}`)
  }

  if (!visible) return null
  const geo = GEO_MAP[country?.toUpperCase()]
  if (!geo) return null

  const s = STRINGS[language] || STRINGS.ru
  const placeLabel = geo.label[language] || geo.label.en

  return (
    <div
      data-testid="geo-suggest-toast"
      className={cn(
        'fixed z-[90] md:right-6 md:bottom-6 bottom-[90px] left-4 right-4 md:left-auto md:max-w-sm',
        'pointer-events-none',
      )}
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto rounded-2xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]',
          'border border-slate-200 p-5 pr-4',
          'transform-gpu transition-all duration-300 ease-out',
          closing
            ? 'translate-y-4 opacity-0 scale-[0.98]'
            : 'translate-y-0 opacity-100 scale-100',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-[#006666] text-white shadow-[0_6px_18px_rgba(0,102,102,0.3)]">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif text-lg font-semibold tracking-tight text-slate-900 leading-tight">
                {s.title}
              </p>
              <button
                type="button"
                onClick={dismiss}
                aria-label={s.ariaClose}
                data-testid="geo-suggest-close"
                className="-mt-1 -mr-1 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">
              <span className="inline-flex items-center gap-1 text-teal-700">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                <span className="font-semibold">{placeLabel}</span>
              </span>{' '}
              — {s.sub}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAccept}
                data-testid="geo-suggest-accept"
                className="rounded-full bg-[#006666] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(0,102,102,0.28)] transition-all hover:bg-[#005555] active:scale-95"
              >
                {s.primary} →
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                {s.secondary}
              </button>
              <span className="ml-auto hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 md:block">
                {getSiteDisplayName()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
