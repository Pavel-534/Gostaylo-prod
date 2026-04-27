'use client'

/**
 * Компактный баланс для шапки: иконка + сумма; раскладка в выпадающем меню (GET /api/v2/wallet/me, кэш wallet-me).
 */

import Link from 'next/link'
import { Wallet, Landmark, PiggyBank, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useMemo } from 'react'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

function formatCompactThb(n, locale = 'ru-RU') {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return v.toLocaleString(locale, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
}

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

export function HeaderWalletCompact({ className = '', variant = 'default' }) {
  const { user } = useAuth()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale =
    language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { data, isLoading, isError } = useWalletMeQuery({ enabled: !!user })

  if (!user) return null

  const summary = data ? summarizePayload(data) : null
  const triggerTone =
    variant === 'inverted'
      ? 'border-white/25 text-white hover:bg-white/10 hover:text-white'
      : 'border-slate-200 hover:bg-slate-50'
  const iconTone = variant === 'inverted' ? 'text-teal-300' : 'text-teal-600'
  const amountTone = variant === 'inverted' ? 'text-white' : 'text-slate-900'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 sm:h-9 px-2 rounded-full border gap-1.5 ${triggerTone} ${className}`}
          aria-label={t('stage73_walletHeaderAria')}
        >
          <Wallet className={`h-4 w-4 shrink-0 ${iconTone}`} />
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : isError ? (
            <span className="text-xs text-amber-700">—</span>
          ) : (
            <span className={`text-xs sm:text-sm font-semibold tabular-nums ${amountTone}`}>
              ฿{formatCompactThb(summary?.headerTotal ?? 0, locale)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal space-y-1">
          <p className="text-xs text-slate-500">{t('stage73_walletHeaderTitle')}</p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">
            ฿{formatCompactThb(summary?.headerTotal ?? 0, locale)}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 text-slate-600">
              <PiggyBank className="h-4 w-4 text-emerald-600 shrink-0" />
              {t('referralStage726_withdrawableLabel')}
            </span>
            <span className="tabular-nums font-medium">฿{formatCompactThb(summary?.wd ?? 0, locale)}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 text-slate-600">
              <PiggyBank className="h-4 w-4 text-indigo-600 shrink-0" />
              {t('referralStage726_internalServicesLabel')}
            </span>
            <span className="tabular-nums font-medium">฿{formatCompactThb(summary?.internal ?? 0, locale)}</span>
          </div>
          {(summary?.escrowTotal ?? 0) > 0 ? (
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Landmark className="h-4 w-4 text-amber-700 shrink-0" />
                {t('referralStage726_escrowWalletLabel')}
              </span>
              <span className="tabular-nums font-medium">฿{formatCompactThb(summary?.escrowTotal ?? 0, locale)}</span>
            </div>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 pb-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/profile/referral">{t('stage73_walletHeaderDetails')}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
