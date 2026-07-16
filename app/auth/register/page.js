'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthPhoneFlow } from '@/components/auth/AuthPhoneFlow'
import { AuthEmailRegisterForm } from '@/components/auth/AuthEmailRegisterForm'
import { AuthProviderButtons } from '@/components/auth/AuthProviderButtons'
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton'
import { AuthLegalConsentBlock } from '@/components/auth/AuthLegalConsentBlock'

const TABS = ['phone', 'email']

export default function AuthRegisterPage() {
  const { language } = useI18n()
  const brand = getSiteDisplayName()
  const [tab, setTab] = useState('phone')
  const [legalConsent, setLegalConsent] = useState(false)
  const [legalError, setLegalError] = useState(false)

  const onLegalRequired = () => setLegalError(true)

  return (
    <AuthPageShell
      title={getUIText('register', language)}
      subtitle={getUIText('auth_modal_subtitleRegister', language, { brand })}
      backHref="/auth/login"
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

        <div className="relative py-2">
          <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden />
          <p className="relative mx-auto w-fit bg-slate-50 px-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {getUIText('auth_oauthDivider', language)}
          </p>
        </div>

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
          <Link href="/auth/login" className="font-medium text-brand hover:underline">
            {getUIText('login', language)}
          </Link>
        </p>
      </div>
    </AuthPageShell>
  )
}
