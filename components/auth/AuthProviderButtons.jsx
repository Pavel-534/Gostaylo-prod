'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useGeo } from '@/contexts/geo-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { getOAuthBrowserSupabase, getOAuthRedirectOrigin } from '@/lib/supabase/oauth-browser-client'
import {
  isAuthProviderVisible,
  SUPABASE_OAUTH_PROVIDER_MAP,
} from '@/lib/auth/auth-provider-policy'
import { Button } from '@/components/ui/button'

const OAUTH_RETURN_TO_LS = 'gostaylo_oauth_return_to'

function ProviderGlyph({ provider, className = 'h-5 w-5' }) {
  if (provider === 'google') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    )
  }
  if (provider === 'apple') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.47-.12-1.06.46-2.2 1.168-3.01.783-.89 2.12-1.55 2.996-1.54zM20.88 17.17c-.57 1.3-.85 1.89-1.588 3.04-1.03 1.62-2.48 3.64-4.28 3.66-1.6.02-2.01-1.03-4.19-1.02-2.18.01-2.63 1.04-4.23 1.02-1.8-.02-3.17-1.88-4.2-3.5-2.89-4.56-3.2-9.9-1.41-12.74 1.26-2.03 3.26-3.22 5.14-3.22 2.02 0 3.29 1.04 4.96 1.04 1.6 0 2.57-1.04 4.87-1.04 1.74 0 3.58.95 4.84 2.6-4.26 2.33-3.57 8.39.71 10.14z" />
      </svg>
    )
  }
  if (provider === 'yandex') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand text-[10px] font-bold text-white">
        Я
      </span>
    )
  }
  if (provider === 'vk') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand-navy text-[9px] font-bold text-white">
        VK
      </span>
    )
  }
  return null
}

const LABEL_KEYS = {
  google: 'auth_continueGoogle',
  apple: 'auth_continueApple',
  yandex: 'auth_continueYandex',
  vk: 'auth_continueVk',
}

/**
 * @param {{ requireLegalConsent?: boolean, legalConsent?: boolean, onLegalRequired?: () => void }} props
 */
export function AuthProviderButtons({ requireLegalConsent = false, legalConsent = true, onLegalRequired }) {
  const { isRussia } = useGeo()
  const { language } = useI18n()
  const [busyProvider, setBusyProvider] = useState(null)

  const startOAuth = useCallback(
    async (provider) => {
      if (!isAuthProviderVisible(provider, { isRussia })) {
        toast.error(getAuthErrorMessage('AUTH_OAUTH_REGION_RESTRICTED', language))
        return
      }
      if (requireLegalConsent && !legalConsent) {
        onLegalRequired?.()
        return
      }

      const sb = getOAuthBrowserSupabase()
      if (!sb) {
        toast.error(getAuthErrorMessage('AUTH_OAUTH_UNAVAILABLE', language))
        return
      }

      const supabaseProvider = SUPABASE_OAUTH_PROVIDER_MAP[provider]
      if (!supabaseProvider) return

      setBusyProvider(provider)
      try {
        const secure = window.location.protocol === 'https:'
        if (requireLegalConsent && legalConsent) {
          document.cookie = `gostaylo_oauth_legal=1; Path=/; Max-Age=600; SameSite=Lax${secure ? '; Secure' : ''}`
        }

        const current = `${window.location.pathname || '/'}${window.location.search || ''}`
        try {
          if (current.startsWith('/') && !current.startsWith('//')) {
            localStorage.setItem(OAUTH_RETURN_TO_LS, current)
          }
        } catch {
          /* ignore */
        }

        const origin = getOAuthRedirectOrigin()
        if (!origin) {
          toast.error(getAuthErrorMessage('AUTH_OAUTH_UNAVAILABLE', language))
          return
        }
        const callback = new URL(`${origin}/auth/callback/`)
        const saved = sessionStorage.getItem('gostaylo_redirect_after_login')
        const next = saved?.startsWith('/') ? saved : '/profile/'
        callback.searchParams.set('next', next.endsWith('/') ? next : `${next}/`)

        const options = { redirectTo: callback.toString() }
        if (provider === 'google') {
          options.queryParams = { access_type: 'offline', prompt: 'select_account' }
        }

        const { data, error } = await sb.auth.signInWithOAuth({
          provider: supabaseProvider,
          options,
        })
        if (error) throw error
        if (data?.url) window.location.assign(data.url)
      } catch (e) {
        console.error('[oauth]', provider, e)
        toast.error(getAuthErrorMessage('AUTH_OAUTH_FAILED', language))
      } finally {
        setBusyProvider(null)
      }
    },
    [isRussia, requireLegalConsent, legalConsent, onLegalRequired, language],
  )

  const providers = ['yandex', 'vk', 'google', 'apple'].filter((p) =>
    isAuthProviderVisible(p, { isRussia }),
  )

  if (!providers.length) return null

  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => void startOAuth(provider)}
          disabled={Boolean(busyProvider)}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-brand/30 hover:bg-slate-50 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          {busyProvider === provider ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
          ) : (
            <ProviderGlyph provider={provider} />
          )}
          {getUIText(LABEL_KEYS[provider], language)}
        </button>
      ))}
    </div>
  )
}

export default AuthProviderButtons
