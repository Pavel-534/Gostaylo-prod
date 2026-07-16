'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthPhoneFlow } from '@/components/auth/AuthPhoneFlow'
import { AuthEmailLoginForm } from '@/components/auth/AuthEmailLoginForm'
import { AuthProviderButtons } from '@/components/auth/AuthProviderButtons'
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton'
import { useState } from 'react'

const TABS = ['phone', 'email']

function safeInternalRedirect(raw) {
  if (!raw || typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  return t.slice(0, 2048)
}

function AuthLoginInner() {
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const brand = getSiteDisplayName()
  const [tab, setTab] = useState('phone')

  useEffect(() => {
    const redirect = safeInternalRedirect(searchParams.get('redirect'))
    if (!redirect) return
    try {
      sessionStorage.setItem('gostaylo_redirect_after_login', redirect)
    } catch {
      /* ignore */
    }
  }, [searchParams])

  return (
    <AuthPageShell
      title={getUIText('loginTitle', language)}
      subtitle={getUIText('auth_modal_subtitleLogin', language, { brand })}
      backHref="/"
    >
      <div className="flex flex-1 flex-col gap-5 py-2">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-12 rounded-lg text-sm font-medium transition ${
                tab === id ? 'bg-white text-brand shadow-sm' : 'text-slate-600'
              }`}
            >
              {getUIText(id === 'phone' ? 'auth_tab_phone' : 'auth_tab_email', language)}
            </button>
          ))}
        </div>

        {tab === 'phone' ? <AuthPhoneFlow /> : <AuthEmailLoginForm />}

        <div className="relative py-2">
          <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden />
          <p className="relative mx-auto w-fit bg-slate-50 px-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {getUIText('auth_oauthDivider', language)}
          </p>
        </div>

        <TelegramLoginButton />
        <AuthProviderButtons />

        <p className="mt-auto text-center text-sm text-slate-500">
          {getUIText('auth_noAccount', language)}{' '}
          <Link href="/auth/register" className="font-medium text-brand hover:underline">
            {getUIText('register', language)}
          </Link>
        </p>
      </div>
    </AuthPageShell>
  )
}

export default function AuthLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-slate-50" />}>
      <AuthLoginInner />
    </Suspense>
  )
}
