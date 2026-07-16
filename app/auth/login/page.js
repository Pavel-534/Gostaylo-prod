'use client'

/** Ensure auth UI strings exist in the client `uiTranslations` bag (Stage 189 hotfix). */
import '@/lib/translations/register-auth-i18n'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthOauthDivider } from '@/components/auth/AuthOauthDivider'
import { AuthPhoneFlow } from '@/components/auth/AuthPhoneFlow'
import { AuthEmailLoginForm } from '@/components/auth/AuthEmailLoginForm'
import { AuthProviderButtons } from '@/components/auth/AuthProviderButtons'
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton'

/** Login defaults to email/password — phone is one tap away. */
const TABS = ['email', 'phone']

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
  const [tab, setTab] = useState('email')

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
        <div
          className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label={getUIText('loginTitle', language)}
        >
          {TABS.map((id) => {
            const selected = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(id)}
                className={`min-h-12 rounded-lg text-sm font-medium transition ${
                  selected ? 'bg-white text-brand shadow-sm' : 'text-slate-600'
                }`}
              >
                {getUIText(id === 'phone' ? 'auth_tab_phone' : 'auth_tab_email', language)}
              </button>
            )
          })}
        </div>

        {tab === 'email' ? <AuthEmailLoginForm /> : <AuthPhoneFlow />}

        <AuthOauthDivider />

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
