'use client'

/**
 * EmptyState — premium "ничего не найдено" блок в стиле Premium Air.
 *
 * Визуал:
 * - Мягкая teal-ring иллюстрация с иконкой в центре
 * - Serif-заголовок (Cormorant Garamond)
 * - Подсказка + CTA "Показать все" (или кастомный)
 *
 * Используется в:
 * - TopListingsGrid (на главной)
 * - ListingSidebar (на /listings)
 *
 * @created 2026-02 Sprint P3 — Smart Empty States
 */

import Link from 'next/link'
import { Search, MapPin, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

function defaultTitle(language) {
  return language === 'ru'
    ? 'Ничего не нашлось'
    : language === 'zh'
      ? '没有找到结果'
      : language === 'th'
        ? 'ไม่พบผลลัพธ์'
        : 'No results found'
}

function defaultHint(language) {
  return language === 'ru'
    ? 'Попробуйте изменить даты, локацию или категорию — или посмотрите все доступные объекты.'
    : language === 'zh'
      ? '请尝试更改日期、位置或类别 — 或查看所有可用房源。'
      : language === 'th'
        ? 'ลองเปลี่ยนวันที่ สถานที่ หรือหมวดหมู่ — หรือดูที่พักทั้งหมด'
        : 'Try changing dates, location, or category — or browse all available listings.'
}

function defaultCta(language) {
  return language === 'ru'
    ? 'Показать все объявления'
    : language === 'zh'
      ? '查看所有房源'
      : language === 'th'
        ? 'แสดงที่พักทั้งหมด'
        : 'Show all listings'
}

/**
 * @param {object} p
 * @param {string} [p.language='ru']
 * @param {string} [p.title]
 * @param {string} [p.hint]
 * @param {string} [p.ctaLabel]
 * @param {string} [p.ctaHref='/listings']
 * @param {() => void} [p.onCtaClick] — если передан, используется вместо ссылки
 * @param {React.ReactNode} [p.children] — доп. элементы (badge, secondary button)
 * @param {'compact' | 'full'} [p.variant='full']
 */
export function EmptyState({
  language = 'ru',
  title,
  hint,
  ctaLabel,
  ctaHref = '/listings',
  onCtaClick,
  children,
  variant = 'full',
}) {
  const heading = title || defaultTitle(language)
  const subline = hint || defaultHint(language)
  const buttonLabel = ctaLabel || defaultCta(language)

  return (
    <div
      data-testid="empty-state"
      className={
        variant === 'compact'
          ? 'flex flex-col items-center justify-center py-12 px-4 text-center'
          : 'flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center'
      }
    >
      {/* Иллюстрация: концентрические круги + иконка */}
      <div className="relative mb-6 flex items-center justify-center" aria-hidden>
        <div className="absolute h-36 w-36 rounded-full bg-teal-50/80" />
        <div className="absolute h-28 w-28 rounded-full bg-teal-100/60" />
        <div className="absolute h-20 w-20 rounded-full bg-white shadow-[0_10px_28px_rgba(0,102,102,0.18)]" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-brand shadow-[0_8px_20px_rgba(0,102,102,0.38)]">
          <Search className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        {/* Декоративные "плавающие" маркеры */}
        <div className="absolute -right-2 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-teal-100">
          <MapPin className="h-3.5 w-3.5 text-teal-600" />
        </div>
        <div className="absolute -bottom-1 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-amber-100">
          <Calendar className="h-3 w-3 text-amber-600" />
        </div>
      </div>

      <h3 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-2">
        {heading}
      </h3>
      <p className="max-w-md text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
        {subline}
      </p>

      {onCtaClick ? (
        <Button
          onClick={onCtaClick}
          data-testid="empty-state-cta"
          className="rounded-2xl px-6 py-5 text-sm font-semibold"
          variant="brand"
        >
          {buttonLabel} →
        </Button>
      ) : (
        <Button
          asChild
          data-testid="empty-state-cta"
          className="rounded-2xl px-6 py-5 text-sm font-semibold"
          variant="brand"
        >
          <Link href={ctaHref}>{buttonLabel} →</Link>
        </Button>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export default EmptyState
