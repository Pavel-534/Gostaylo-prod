'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthOtpInput } from '@/components/auth/AuthOtpInput'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { finishAuthNavigation } from '@/lib/auth/auth-redirect'

function LinkConflictInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const brand = getSiteDisplayName()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [conflict, setConflict] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mergeStep, setMergeStep] = useState('idle')
  const [challengeId, setChallengeId] = useState('')
  const [mockCode, setMockCode] = useState('')
  const [otp, setOtp] = useState('')

  useEffect(() => {
    if (!token) {
      setError(getAuthErrorMessage('AUTH_LINK_CONFLICT_NOT_FOUND', language))
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/v2/auth/link-conflict?token=${encodeURIComponent(token)}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.success) {
          if (!cancelled) {
            setError(getAuthErrorMessage(json?.error_code, language))
          }
          return
        }
        if (!cancelled) setConflict(json.conflict)
      } catch {
        if (!cancelled) setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, language])

  const onLoginExisting = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v2/auth/link-conflict/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login_existing' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(getAuthErrorMessage(json?.error_code, language))
        return
      }
      router.push(json.redirectTo || '/auth/login')
    } catch {
      setError(getAuthErrorMessage('AUTH_INTERNAL', language))
    } finally {
      setBusy(false)
    }
  }, [token, language, router])

  const onSendMergeOtp = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v2/auth/link-conflict/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'send_merge_otp' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(getAuthErrorMessage(json?.error_code, language))
        return
      }
      setChallengeId(json.challengeId || '')
      setMockCode(json.mockCode || '')
      setMergeStep('otp')
    } catch {
      setError(getAuthErrorMessage('AUTH_INTERNAL', language))
    } finally {
      setBusy(false)
    }
  }, [token, language])

  const onConfirmMerge = useCallback(async () => {
    if (otp.length !== 6) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v2/auth/link-conflict/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'confirm_merge',
          challengeId,
          code: otp,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(getAuthErrorMessage(json?.error_code, language))
        return
      }
      finishAuthNavigation(router, '/profile')
    } catch {
      setError(getAuthErrorMessage('AUTH_INTERNAL', language))
    } finally {
      setBusy(false)
    }
  }, [token, challengeId, otp, language, router])

  const providerLabel = conflict?.providerLabel || conflict?.provider || ''

  return (
    <AuthPageShell
      title={getUIText('auth_linkConflict_title', language)}
      subtitle={getUIText('auth_linkConflict_lead', language, { brand, provider: providerLabel })}
      backHref="/auth/login"
    >
      <div className="flex flex-1 flex-col gap-5 py-2">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : null}

        {!loading && conflict ? (
          <>
            <p className="text-sm text-slate-600">
              {getUIText('auth_linkConflict_body', language, { provider: providerLabel })}
            </p>
            {conflict.maskedEmail ? (
              <p className="text-sm text-slate-500">
                {getUIText('auth_linkConflict_emailHint', language, { email: conflict.maskedEmail })}
              </p>
            ) : null}

            <Button
              type="button"
              variant="brand"
              className="h-12 w-full text-base"
              disabled={busy}
              onClick={onLoginExisting}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {getUIText('auth_linkConflict_loginExisting', language)}
            </Button>

            {conflict.canMerge ? (
              mergeStep === 'otp' ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">
                    {getUIText('auth_linkConflict_mergeOtpLead', language)}
                  </p>
                  {mockCode ? (
                    <p className="text-xs text-slate-500">
                      {getUIText('auth_phone_mockCode', language, { code: mockCode })}
                    </p>
                  ) : null}
                  <AuthOtpInput value={otp} onChange={setOtp} />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full text-base"
                    disabled={busy || otp.length !== 6}
                    onClick={onConfirmMerge}
                  >
                    {getUIText('auth_linkConflict_confirmMerge', language)}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full text-base"
                  disabled={busy}
                  onClick={onSendMergeOtp}
                >
                  {getUIText('auth_linkConflict_mergeSms', language)}
                </Button>
              )
            ) : null}
          </>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </AuthPageShell>
  )
}

export default function AuthLinkConflictPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-slate-50" />}>
      <LinkConflictInner />
    </Suspense>
  )
}
