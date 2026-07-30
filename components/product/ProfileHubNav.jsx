'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GSL_HUB_NAV } from '@/lib/theme/product-ui'
import {
  PROFILE_HUB_PREFETCH_PATHS,
  matchesOptimisticNavHref,
  useOptimisticNavHref,
} from '@/hooks/use-optimistic-nav-href'

const HUB_ITEMS = [
  { href: '/profile/referral', key: 'invite' },
  { href: '/profile/wallet', key: 'wallet' },
  { href: '/profile/status', key: 'status' },
]

/**
 * Stage 115.0 — единая навигация хаба профиля (referral / wallet / status).
 * Stage 200.14 — optimistic pending + prefetch.
 * @param {{ t: (key: string) => string, className?: string }} props
 */
export function ProfileHubNav({ t, className }) {
  const pathname = usePathname()
  const router = useRouter()
  const { pendingHref, markPending } = useOptimisticNavHref({
    prefetchPaths: PROFILE_HUB_PREFETCH_PATHS,
  })

  return (
    <nav className={cn(GSL_HUB_NAV, className)} aria-label={t('stage115_profileHubAria')}>
      {HUB_ITEMS.map((item) => {
        const routeActive =
          item.href === '/profile/referral'
            ? pathname?.startsWith('/profile/referral')
            : pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const active = routeActive || matchesOptimisticNavHref(pendingHref, item.href)
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
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg min-h-9 touch-manipulation',
              !active && 'text-slate-700 hover:bg-slate-50',
            )}
            onClick={() => {
              markPending(item.href)
              router.push(item.href)
            }}
          >
            {t(labelKey)}
          </Button>
        )
      })}
    </nav>
  )
}
