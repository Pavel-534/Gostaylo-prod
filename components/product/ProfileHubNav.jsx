'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GSL_HUB_NAV } from '@/lib/theme/product-ui'

const HUB_ITEMS = [
  { href: '/profile/referral', key: 'invite' },
  { href: '/profile/wallet', key: 'wallet' },
  { href: '/profile/status', key: 'status' },
]

/**
 * Stage 115.0 — единая навигация хаба профиля (referral / wallet / status).
 * @param {{ t: (key: string) => string, className?: string }} props
 */
export function ProfileHubNav({ t, className }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className={cn(GSL_HUB_NAV, className)} aria-label={t('stage115_profileHubAria')}>
      {HUB_ITEMS.map((item) => {
        const active =
          item.href === '/profile/referral'
            ? pathname?.startsWith('/profile/referral')
            : pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const labelKey =
          item.key === 'invite'
            ? 'stage1143_tabNavInvite'
            : item.key === 'wallet'
              ? 'stage1143_tabNavWallet'
              : 'stage1143_tabNavStatus'
        return (
          <Button
            key={item.href}
            type="button"
            size="sm"
            variant={active ? 'brand' : 'ghost'}
            className={cn('rounded-lg min-h-9', !active && 'text-slate-700 hover:bg-slate-50')}
            onClick={() => router.push(item.href)}
          >
            {t(labelKey)}
          </Button>
        )
      })}
    </nav>
  )
}
