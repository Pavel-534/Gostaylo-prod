'use client'

/**
 * Финальный шаг OAuth: пользователь уже в JWT-сессии, но без legal_terms_accepted_at — подтверждает оферту.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { LegalConsentCheckboxRow } from '@/components/legal/LegalConsentCheckboxRow'

export default function CompleteLegalPage() {
  const router = useRouter()
  const { loading, user, updateUser, refreshUserFromServer } = useAuth()
  const { language } = useI18n()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const alreadyAccepted =
    user?.termsAccepted === true ||
    user?.terms_accepted === true ||
    Boolean(user?.termsAcceptedAt || user?.terms_accepted_at || user?.legalTermsAcceptedAt || user?.legal_terms_accepted_at)

  useEffect(() => {
    if (!loading && user && alreadyAccepted) {
      router.replace('/profile/')
    }
  }, [alreadyAccepted, loading, router, user])

  const submit = useCallback(async () => {
    setLocalError('')
    if (!checked) {
      setLocalError(getUIText('auth_registerLegalRequired', language))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/v2/auth/accept-legal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acceptedLegalTerms: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setLocalError(
          json.error_code
            ? getAuthErrorMessage(json.error_code, language)
            : getUIText('auth_registerLegalRequired', language),
        )
        return
      }
      const acceptedAt = json?.termsAcceptedAt || json?.legalTermsAcceptedAt || new Date().toISOString()
      if (user) {
        updateUser({
          ...user,
          termsAccepted: true,
          terms_accepted: true,
          termsAcceptedAt: acceptedAt,
          terms_accepted_at: acceptedAt,
          legalTermsAcceptedAt: acceptedAt,
          legal_terms_accepted_at: acceptedAt,
        })
      }
      await refreshUserFromServer()
      try {
        window.dispatchEvent(new CustomEvent('gostaylo-close-auth-modal'))
      } catch {
        /* ignore */
      }
      router.push('/profile/')
      router.refresh()
    } catch {
      setLocalError(getAuthErrorMessage('AUTH_INTERNAL', language))
    } finally {
      setBusy(false)
    }
  }, [checked, language, refreshUserFromServer, router, updateUser, user])

  if (loading) {
    return <main className='min-h-screen bg-slate-50' />
  }

  if (!loading && !user) {
    return (
      <main className='min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 font-sans text-slate-900'>
        <p className='text-slate-600 mb-6'>{getUIText('auth_completeLegal_guestHint', language)}</p>
        <Link href='/profile/' className='text-teal-700 underline'>
          Profile
        </Link>
      </main>
    )
  }

  if (!loading && user && alreadyAccepted) return null

  return (
    <main className='min-h-screen bg-slate-50 font-sans antialiased text-slate-900 py-16 px-6'>
      <div className='mx-auto max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm ring-1 ring-slate-100'>
        <h1 className='text-xl font-semibold tracking-tight text-slate-900'>
          {getUIText('auth_completeLegal_title', language)}
        </h1>
        <p className='mt-3 text-sm leading-relaxed text-slate-600'>
          {getUIText('auth_completeLegal_lead', language)}
        </p>
        <div className='mt-6'>
          <LegalConsentCheckboxRow
            language={language}
            checked={checked}
            onCheckedChange={setChecked}
            id='oauth-complete-legal'
            className='rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5'
          />
        </div>
        {localError ? <p className='mt-3 text-sm text-red-600'>{localError}</p> : null}
        <Button
          type='button'
          disabled={busy || !checked}
          onClick={() => void submit()}
          className='mt-6 w-full h-11 bg-[#006666] hover:bg-[#005555] rounded-xl transition-all'
        >
          {busy ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {getUIText('loading', language)}
            </>
          ) : (
            getUIText('auth_completeLegal_cta', language)
          )}
        </Button>
      </div>
    </main>
  )
}
