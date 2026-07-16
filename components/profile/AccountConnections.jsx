'use client'

/**
 * Stage 189.3 — Account connections list for profile (Path B).
 * Telegram while logged-in → deep-link notify bot (not Login Widget).
 */
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, Mail, Phone, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { telegramAccountLinkUrl } from '@/lib/telegram-bot-public'
import { useAccountConnections } from '@/hooks/use-account-connections'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PROVIDER_META = {
  email: { labelKey: 'auth_connections_email', icon: Mail },
  phone: { labelKey: 'auth_connections_phone', icon: Phone },
  telegram: { labelKey: 'auth_connections_telegram', icon: MessageCircle },
  google: { labelKey: 'auth_continueGoogle', glyph: 'G' },
  apple: { labelKey: 'auth_continueApple', glyph: '' },
  yandex: { labelKey: 'auth_continueYandex', glyph: 'Я' },
  vk: { labelKey: 'auth_continueVk', glyph: 'VK' },
}

function ProviderIcon({ provider, className }) {
  const meta = PROVIDER_META[provider] || {}
  if (meta.icon) {
    const Icon = meta.icon
    return <Icon className={cn('h-5 w-5 text-slate-600', className)} aria-hidden />
  }
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-700',
        className,
      )}
      aria-hidden
    >
      {meta.glyph || '?'}
    </span>
  )
}

/**
 * @param {{ enabled?: boolean, className?: string }} [props]
 */
export function AccountConnections({ enabled = true, className }) {
  const router = useRouter()
  const { language } = useI18n()
  const { user } = useAuth()
  const { connections, loading, errorCode, refresh, unlink } = useAccountConnections({ enabled })

  const onLink = useCallback(
    (provider) => {
      if (provider === 'telegram') {
        const id = user?.id
        if (!id) {
          router.push(`/auth/login?redirect=${encodeURIComponent('/profile')}`)
          return
        }
        window.open(telegramAccountLinkUrl(id), '_blank', 'noopener,noreferrer')
        return
      }
      if (provider === 'email' || provider === 'phone') {
        router.push(`/auth/login?redirect=${encodeURIComponent('/profile')}`)
        return
      }
      try {
        sessionStorage.setItem('gostaylo_oauth_return_to', '/profile')
      } catch {
        /* ignore */
      }
      router.push(
        `/auth/login?redirect=${encodeURIComponent('/profile')}&link=${encodeURIComponent(provider)}`,
      )
    },
    [router, user?.id],
  )

  const onUnlink = useCallback(
    async (provider) => {
      const result = await unlink(provider)
      if (!result.ok) {
        toast.error(getAuthErrorMessage(result.error_code, language))
        return
      }
      toast.success(getUIText('auth_connections_unlinked', language))
    },
    [unlink, language],
  )

  return (
    <section
      id="account-connections"
      className={cn('scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white', className)}
    >
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          {getUIText('auth_connections_title', language)}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {getUIText('auth_connections_subtitle', language)}
        </p>
      </header>

          {errorCode ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-red-500">{getAuthErrorMessage(errorCode, language)}</p>
          <Button type="button" variant="outline" className="h-12 shrink-0" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {loading && connections.length === 0 ? (
          <li className="flex min-h-[52px] items-center justify-center px-4 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </li>
        ) : null}

        {connections.map((row) => {
          const meta = PROVIDER_META[row.provider] || {}
          const label = getUIText(meta.labelKey || row.provider, language)
          const unavailable = !row.available
          const connected = row.connected

          return (
            <li key={row.provider}>
              <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                <ProviderIcon provider={row.provider} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {unavailable
                      ? getUIText('auth_connections_unavailable', language)
                      : connected
                        ? getUIText('auth_connections_connected', language)
                        : getUIText('auth_connections_notConnected', language)}
                  </p>
                </div>

                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : unavailable ? null : connected && row.canUnlink ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 min-w-[88px] px-3 text-sm text-slate-600"
                    onClick={() => void onUnlink(row.provider)}
                  >
                    {getUIText('auth_connections_unlink', language)}
                  </Button>
                ) : connected ? (
                  <span className="text-xs font-medium text-brand">
                    {getUIText('auth_connections_connected', language)}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 min-w-[104px] gap-1 px-3 text-sm"
                    onClick={() => onLink(row.provider)}
                  >
                    {getUIText('auth_connections_link', language)}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default AccountConnections
