'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthOauthDivider } from '@/components/auth/AuthOauthDivider'
import { AuthPhoneFlow } from '@/components/auth/AuthPhoneFlow'
import { AuthEmailRegisterForm } from '@/components/auth/AuthEmailRegisterForm'
import { AuthProviderButtons } from '@/components/auth/AuthProviderButtons'
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton'
import { AuthLegalConsentBlock } from '@/components/auth/AuthLegalConsentBlock'
import {
  buildAuthEntryHref,
  persistRedirectBeforeAuth,
  readRedirectFromAuthQuery,
} from '@/lib/auth/auth-redirect'

const TABS = ['phone', 'email']

function AuthRegisterInner() {
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const brand = getSiteDisplayName()
  const [tab, setTab] = useState('phone')
  const [legalConsent, setLegalConsent] = useState(false)
  const [legalError, setLegalError] = useState(false)

  useEffect(() => {
    const redirect = readRedirectFromAuthQuery(searchParams)
    if (!redirect) return
    persistRedirectBeforeAuth(redirect)
  }, [searchParams])

  const onLegalRequired = () => setLegalError(true)
  const loginHref = buildAuthEntryHref('login', readRedirectFromAuthQuery(searchParams))
  const backHref = loginHref

  return (
    <AuthPageShell
      title={getUIText('register', language)}
      subtitle={getUIText('auth_modal_subtitleRegister', language, { brand })}
      backHref={backHref}
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

        {tab === 'phone' ? (
          <AuthPhoneFlow
            requireLegalConsent
            legalConsent={legalConsent}
            onLegalRequired={onLegalRequired}
          />
        ) : (
          <AuthEmailRegisterForm legalConsent={legalConsent} onLegalRequired={onLegalRequired} />
        )}

        <AuthLegalConsentBlock
          checked={legalConsent}
          onCheckedChange={(v) => {
            setLegalConsent(v)
            if (v) setLegalError(false)
          }}
          showError={legalError}
          id="auth-register-legal"
        />

        <AuthOauthDivider />

        <TelegramLoginButton
          requireLegalConsent
          legalConsent={legalConsent}
          onLegalRequired={onLegalRequired}
        />
        <AuthProviderButtons
          requireLegalConsent
          legalConsent={legalConsent}
          onLegalRequired={onLegalRequired}
        />

        <p className="mt-auto text-center text-sm text-slate-500">
          {getUIText('auth_haveAccount', language)}{' '}
          <Link href={loginHref} className="font-medium text-brand hover:underline">
            {getUIText('login', language)}
          </Link>
        </p>
      </div>
    </AuthPageShell>
  )
}

export default function AuthRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gradient-to-tr from-slate-50 via-slate-50 to-brand/10" />}>
      <AuthRegisterInner />
    </Suspense>
  )
}
