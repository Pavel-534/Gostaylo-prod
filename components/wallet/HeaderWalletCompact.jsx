'use client'

/**
 * Компактный баланс для шапки: иконка (+ сумма с md); детали в dropdown (GET /api/v2/wallet/me).
 * Stage 200.1 — close on referral navigate / pathname.
 * Stage 200.2 — mobile icon-only trigger (no overflow on large balances).
 * Stage 201.07 — two products (listings vs invites), short labels, role CTAs.
 */

import Link from 'next/link'
import { Wallet, Landmark, PiggyBank, Banknote, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMemo, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import {
  PartnerHostLedgerAmount,
  PartnerHostMidFxFootnote,
} from '@/components/partner/finances/partner-host-amount-display'
import { ReferralBalanceBreakdown } from '@/components/referral/ReferralBalanceBreakdown'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'

function summarizePayload(data) {
  const w = data?.wallet
  const balances = data?.balances
  const wd = Number(balances?.withdrawableBalanceThb ?? w?.withdrawable_balance_thb ?? 0)
  const internal = Number(balances?.internalCreditsThb ?? w?.internal_credits_thb ?? 0)
  const marketing = Math.max(0, wd + internal)
  const esc = data?.partnerEscrow
  const frozen = esc ? Number(esc.frozenBalanceThb ?? 0) : 0
  const avail = esc ? Number(esc.availableBalanceThb ?? 0) : 0
  const escrowTotal = Math.max(0, frozen + avail)
  const headerTotal = Math.round((marketing + escrowTotal) * 100) / 100
  return { wd, internal, marketing, frozen, avail, escrowTotal, headerTotal }
}

function HeaderWalletHint({ tooltip, ariaLabel }) {
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600 md:min-h-0 md:min-w-0 md:p-1"
          aria-label={ariaLabel}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="z-[230] max-w-xs p-3 text-left text-xs leading-snug">
        {tooltip}
      </PopoverContent>
    </Popover>
  )
}

function HeaderWalletRow({ icon: Icon, iconClassName, label, thb, tooltip, hintAria }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="flex min-w-0 items-center gap-1 text-slate-600">
        <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden />
        <span className="truncate">{label}</span>
        <HeaderWalletHint tooltip={tooltip} ariaLabel={hintAria} />
      </span>
      <span className="shrink-0 tabular-nums font-medium">
        <PartnerHostLedgerAmount thb={thb} />
      </span>
    </div>
  )
}

function HeaderWalletSection({ title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  )
}

export function HeaderWalletCompact({ className = '', variant = 'default', density = 'header' }) {
  const { user } = useAuth()
  const { language } = useI18n()
  const pathname = usePathname()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { data, isLoading, isError } = useWalletMeQuery({ enabled: !!user })
  const [open, setOpen] = useState(false)
  const expanded = density === 'expanded'
  const role = String(user?.role || '').toUpperCase()
  const showPartnerFinancesCta =
    role === 'PARTNER' || role === 'ADMIN' || role === 'MODERATOR' || String(pathname || '').startsWith('/partner')
  const hintAria = t('stage73_walletHeaderHintAria')

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (!user) return null

  const summary = data ? summarizePayload(data) : null
  const triggerTone =
    variant === 'inverted'
      ? 'border-white/25 text-white hover:bg-white/10 hover:text-white'
      : 'border-slate-200 hover:bg-slate-50'
  const iconTone = variant === 'inverted' ? 'text-brand/70' : 'text-brand'
  const amountTone = variant === 'inverted' ? 'text-white' : 'text-slate-900'
  const triggerSize = expanded
    ? 'h-9 min-w-0 px-2.5 gap-1.5'
    : 'relative h-11 min-w-[44px] rounded-full border px-0 sm:h-9 sm:min-w-0 sm:px-2.5 gap-1.5'

  const go = (href) => {
    dispatchOptimisticNavPending(href)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${triggerSize} rounded-full border ${triggerTone} ${className}`}
          aria-label={t('stage73_walletHeaderAria')}
        >
          <Wallet className={`h-4 w-4 shrink-0 ${iconTone}`} />
          {isLoading ? (
            <Loader2
              className={
                expanded
                  ? 'h-3.5 w-3.5 animate-spin text-slate-400'
                  : 'hidden h-3.5 w-3.5 animate-spin text-slate-400 md:inline'
              }
            />
          ) : isError ? (
            <span className={expanded ? 'text-xs text-amber-700' : 'hidden text-xs text-amber-700 md:inline'}>
              —
            </span>
          ) : (
            <>
              {!expanded && (summary?.headerTotal ?? 0) > 0 ? (
                <span
                  className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand md:hidden"
                  aria-hidden
                />
              ) : null}
              <span
                className={
                  expanded
                    ? `text-sm font-semibold tabular-nums ${amountTone}`
                    : `hidden max-w-[7.5rem] truncate text-sm font-semibold tabular-nums md:inline ${amountTone}`
                }
              >
                <PartnerHostLedgerAmount thb={summary?.headerTotal ?? 0} />
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[220] w-72">
        <DropdownMenuLabel className="font-normal space-y-1">
          <p className="text-xs text-slate-500">{t('stage73_walletHeaderTitle')}</p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">
            <PartnerHostLedgerAmount thb={summary?.headerTotal ?? 0} />
          </p>
          <PartnerHostMidFxFootnote t={t} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-3 px-2 py-2 text-sm">
          {showPartnerFinancesCta ? (
            <HeaderWalletSection title={t('stage73_walletHeaderSectionListings')}>
              <HeaderWalletRow
                icon={Landmark}
                iconClassName="text-amber-700"
                label={t('stage73_walletHeaderFromOrders')}
                thb={summary?.escrowTotal ?? 0}
                tooltip={t('referralStage726_tooltipEscrowBlock')}
                hintAria={hintAria}
              />
            </HeaderWalletSection>
          ) : null}

          <HeaderWalletSection title={t('stage73_walletHeaderSectionInvites')}>
            <HeaderWalletRow
              icon={Banknote}
              iconClassName="text-emerald-600"
              label={t('stage73_walletHeaderToCard')}
              thb={summary?.wd ?? 0}
              tooltip={t('referralStage726_tooltipWithdrawable')}
              hintAria={hintAria}
            />
            <HeaderWalletRow
              icon={PiggyBank}
              iconClassName="text-indigo-600"
              label={t('stage73_walletHeaderToBookings')}
              thb={summary?.internal ?? 0}
              tooltip={t('referralStage726_tooltipInternal')}
              hintAria={hintAria}
            />
            <ReferralBalanceBreakdown walletData={data} variant="header" />
          </HeaderWalletSection>
        </div>
        <DropdownMenuSeparator />
        <div className="space-y-1 px-2 pb-2">
          {showPartnerFinancesCta ? (
            <>
              <Button asChild variant="outline" size="sm" className="w-full min-h-[44px]">
                <Link href="/partner/finances" onClick={() => go('/partner/finances')}>
                  {t('stage73_walletHeaderFinancesCta')}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full min-h-[44px] text-slate-600">
                <Link href="/profile/referral" onClick={() => go('/profile/referral')}>
                  {t('stage73_walletHeaderBonusesCta')}
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" size="sm" className="w-full min-h-[44px]">
              <Link href="/profile/referral" onClick={() => go('/profile/referral')}>
                {t('stage73_walletHeaderDetails')}
              </Link>
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
