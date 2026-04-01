'use client'

/**
 * @file components/chat/ChatHeaderActions.jsx
 *
 * Правая колонка кнопок в StickyChatHeader:
 *   – Кнопки управления бронью (Confirm / Decline) — только для партнёра
 *   – Кнопка «Оплатить» — только для рентера при CONFIRMED + неоплаченном счёте
 *   – Кнопка «Поддержка» (эскалация тикета)
 *   – Кнопка медиа-галереи 🖼️
 *   – Кнопка поиска по сообщениям 🔍
 *   – children — слот для произвольных кнопок
 *
 * Примечание: присутствие (Online/Offline/typing) намеренно оставлено в StickyChatHeader
 * (левая колонка), так как присутствие привязано к имени собеседника, а не к действиям.
 *
 * @param {Object}   props
 * @param {boolean}  [props.isAdminView]
 * @param {Object}   [props.partnerBookingActions]   — { visible, loading, onConfirm, onDecline }
 * @param {string}   [props.payNowHref]
 * @param {Function} [props.onSupportClick]
 * @param {boolean}  [props.supportLoading]
 * @param {boolean}  [props.supportPriorityActive]
 * @param {string}   [props.supportLabel]
 * @param {string}   [props.supportDoneLabel]
 * @param {Function} [props.onMediaGallery]
 * @param {Function} [props.onSearchToggle]
 * @param {Function} [props.onDealInfoClick] — мобиле: открыть Sheet с деталями сделки (иконка скрыта на lg+)
 * @param {boolean}  [props.searchActive]
 * @param {string}   [props.language]
 * @param {boolean}  [props.compact]
 * @param {React.ReactNode} [props.children]
 */

import Link from 'next/link'
import { Check, CreditCard, Images, Info, LifeBuoy, Loader2, MoreHorizontal, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ChatHeaderActions({
  isAdminView = false,
  partnerBookingActions = null,
  payNowHref = null,
  onSupportClick = null,
  supportLoading = false,
  supportPriorityActive = false,
  supportLabel = 'Помощь',
  supportDoneLabel = 'В очереди у поддержки',
  onMediaGallery = null,
  onSearchToggle = null,
  onDealInfoClick = null,
  searchActive = false,
  language = 'ru',
  compact = false,
  groupDesktopTools = false,
  children,
}) {
  if (isAdminView) return null

  const hasActions =
    partnerBookingActions?.visible ||
    payNowHref ||
    onSupportClick ||
    onMediaGallery ||
    onSearchToggle ||
    onDealInfoClick ||
    children

  if (!hasActions) return null

  const isRu = language !== 'en' && language !== 'th' && language !== 'zh'
  const secondaryCount =
    (onSupportClick ? 1 : 0) + (onMediaGallery ? 1 : 0) + (onSearchToggle ? 1 : 0)
  const showDesktopMoreMenu = groupDesktopTools && secondaryCount > 0

  return (
    <div
      className={cn(
        /* min-w-0 + shrink: иначе длинная строка «Помощь + (В очереди…)» не сжимается и вылезает под соседнюю колонку грида */
        'flex min-w-0 shrink items-center',
        groupDesktopTools
          ? 'flex-row flex-wrap justify-end gap-1'
          : compact
            ? 'flex-row flex-wrap justify-end gap-1.5 sm:flex-col sm:items-end sm:gap-2'
            : 'flex-col items-end gap-2'
      )}
    >
      {/* Кнопки управления бронью — на мобиле дублируют ChatActionBar, скрываем */}
      {partnerBookingActions?.visible ? (
        <div className="hidden lg:flex flex-wrap justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={partnerBookingActions.loading}
            onClick={partnerBookingActions.onConfirm}
          >
            {partnerBookingActions.loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Confirm Booking
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 px-2.5 text-xs"
            disabled={partnerBookingActions.loading}
            onClick={partnerBookingActions.onDecline}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Decline
          </Button>
        </div>
      ) : null}

      {/* Кнопка «Оплатить» — на мобиле обычно в ChatActionBar */}
      {payNowHref ? (
        <Button
          asChild
          size="sm"
          className="hidden lg:inline-flex h-8 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm shrink-0"
        >
          <Link href={payNowHref}>
            <CreditCard className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {language === 'en' ? 'Pay now' : 'Оплатить'}
          </Link>
        </Button>
      ) : null}

      {/* Десктоп: одно меню вместо трёх кнопок */}
      {showDesktopMoreMenu ? (
        <div className="hidden lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 border-slate-200 text-slate-700 hover:bg-slate-50"
                title={isRu ? 'Ещё: поддержка, медиа, поиск' : 'More: support, media, search'}
                aria-label={isRu ? 'Дополнительные действия' : 'More actions'}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {onSupportClick ? (
                <DropdownMenuItem
                  disabled={supportLoading}
                  onClick={() => onSupportClick()}
                  className="gap-2 cursor-pointer"
                >
                  {supportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <LifeBuoy className="h-4 w-4 shrink-0 text-teal-600" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {isRu ? 'Поддержка GoStayLo' : 'GoStayLo support'}
                    </span>
                    {supportPriorityActive ? (
                      <span className="text-[11px] font-normal text-amber-700">{supportDoneLabel}</span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {isRu ? 'Вопросы и споры по брони' : 'Questions & disputes'}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ) : null}
              {onMediaGallery ? (
                <DropdownMenuItem onClick={() => onMediaGallery()} className="gap-2 cursor-pointer">
                  <Images className="h-4 w-4 shrink-0 text-slate-600" />
                  {isRu ? 'Медиафайлы в чате' : 'Media in chat'}
                </DropdownMenuItem>
              ) : null}
              {onSearchToggle ? (
                <DropdownMenuItem onClick={() => onSearchToggle()} className="gap-2 cursor-pointer">
                  <Search className="h-4 w-4 shrink-0 text-slate-600" />
                  {isRu ? 'Поиск по сообщениям' : 'Search messages'}
                  {searchActive ? (
                    <span className="ml-auto text-[10px] text-teal-600">{isRu ? 'вкл.' : 'on'}</span>
                  ) : null}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {/* Кнопка поддержки — на мобиле в панели «Инфо»; отдельно на десктопе если не groupDesktopTools */}
      {onSupportClick && !showDesktopMoreMenu ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'hidden min-w-0 max-w-full overflow-hidden lg:inline-flex border-slate-200 text-slate-800 hover:bg-slate-50 items-center',
            compact
              ? 'h-8 w-8 shrink-0 p-0 sm:h-8 sm:w-auto sm:max-w-[min(100%,14rem)] sm:px-2.5 sm:text-xs'
              : 'h-8 max-w-[min(100%,14rem)] px-2.5 text-xs sm:max-w-[min(100%,18rem)]'
          )}
          onClick={onSupportClick}
          disabled={supportLoading}
          title={supportPriorityActive ? `${supportLabel} — ${supportDoneLabel}` : supportLabel}
        >
          {supportLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <LifeBuoy className="h-3.5 w-3.5 shrink-0 text-teal-600" />
          )}
          <span
            className={cn(
              'min-w-0 truncate',
              compact ? 'hidden sm:ml-1.5 sm:inline sm:max-w-[7rem] md:max-w-[min(100%,9rem)]' : 'ml-1.5 max-w-[7rem] sm:max-w-[min(100%,9rem)]'
            )}
          >
            {supportLabel}
          </span>
          {supportPriorityActive ? (
            <span className="ml-1 hidden min-w-0 sm:inline text-[10px] font-normal text-amber-700 truncate max-w-[5.5rem]">
              ({supportDoneLabel})
            </span>
          ) : null}
        </Button>
      ) : null}

      {/* Медиа-галерея — на мобиле в панели «Инфо» */}
      {onMediaGallery && !showDesktopMoreMenu ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'hidden lg:inline-flex text-slate-500 hover:bg-slate-100 hover:text-teal-700',
            compact ? 'h-8 w-8' : 'h-9 w-9'
          )}
          onClick={onMediaGallery}
          title={language === 'en' ? 'Media gallery' : 'Медиафайлы'}
          aria-label={language === 'en' ? 'Media gallery' : 'Медиафайлы'}
        >
          <Images className="h-4 w-4" />
        </Button>
      ) : null}

      {/* Поиск — на мобиле в панели «Инфо» */}
      {onSearchToggle && !showDesktopMoreMenu ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'hidden lg:inline-flex hover:bg-slate-100',
            compact ? 'h-8 w-8' : 'h-9 w-9',
            searchActive ? 'text-teal-600 bg-teal-50 hover:bg-teal-100' : 'text-slate-500 hover:text-teal-700'
          )}
          onClick={onSearchToggle}
          title={language === 'en' ? 'Search messages' : 'Поиск по сообщениям'}
          aria-label={language === 'en' ? 'Search messages' : 'Поиск по сообщениям'}
        >
          <Search className="h-4 w-4" />
        </Button>
      ) : null}

      {/* Произвольные кнопки */}
      {children ? (
        <div className={cn('flex items-center gap-1.5 sm:gap-2', compact && 'shrink-0')}>
          {children}
        </div>
      ) : null}

      {/* Детали сделки — справа в ряду (мобиле); на lg+ панель в ChatThreadChrome */}
      {onDealInfoClick ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            'lg:hidden h-8 w-8 shrink-0 border border-slate-300 bg-white text-slate-700 shadow-sm',
            'hover:bg-slate-50 hover:text-slate-900'
          )}
          onClick={onDealInfoClick}
          title={language === 'en' ? 'Deal details' : 'Детали сделки'}
          aria-label={language === 'en' ? 'Deal details' : 'Детали сделки'}
        >
          <Info className="h-4 w-4" strokeWidth={2} />
        </Button>
      ) : null}
    </div>
  )
}
