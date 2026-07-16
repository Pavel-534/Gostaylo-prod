'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { AuthOtpInput } from '@/components/auth/AuthOtpInput'
import { finishAuthNavigation } from '@/lib/auth/auth-redirect'
import { useAuth } from '@/contexts/auth-context'

/**
 * @param {{ requireLegalConsent?: boolean, legalConsent?: boolean, onLegalRequired?: () => void }} props
 */
export function AuthPhoneFlow({ requireLegalConsent = false, legalConsent = true, onLegalRequired }) {
  const router = useRouter()
  const { language } = useI18n()
  const { refreshUserFromServer } = useAuth()
  const [phone, setPhone] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sendOtp = useCallback(async () => {
    if (requireLegalConsent && !legalConsent) {
      onLegalRequired?.()
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v2/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(getAuthErrorMessage(json.error_code, language))
        return
      }
      setChallengeId(json.challengeId)
      setStep('otp')
      if (json.mockCode) {
        toast.message(getUIText('auth_phone_mockCode', language, { code: json.mockCode }))
      }
    } catch {
      setError(getAuthErrorMessage('AUTH_INTERNAL', language))
    } finally {
      setBusy(false)
    }
  }, [phone, requireLegalConsent, legalConsent, onLegalRequired, language])

  const verifyOtp = useCallback(async () => {
    if (otp.length !== 6) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v2/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeId,
          code: otp,
          acceptedLegalTerms: requireLegalConsent ? legalConsent : false,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(getAuthErrorMessage(json.error_code, language))
        return
      }
      await refreshUserFromServer()
      if (json.user) {
        try {
          localStorage.setItem('gostaylo_user', JSON.stringify(json.user))
        } catch {
          /* ignore */
        }
      }
      finishAuthNavigation(router)
    } catch {
      setError(getAuthErrorMessage('AUTH_INTERNAL', language))
    } finally {
      setBusy(false)
    }
  }, [otp, challengeId, requireLegalConsent, legalConsent, language, refreshUserFromServer, router])

  if (step === 'otp') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{getUIText('auth_phone_otpLead', language)}</p>
        <AuthOtpInput value={otp} onChange={setOtp} disabled={busy} />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <Button
          type="button"
          variant="brand"
          className="h-12 w-full text-base"
          disabled={busy || otp.length !== 6}
          onClick={() => void verifyOtp()}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {getUIText('auth_phone_verifyCta', language)}
        </Button>
        <button
          type="button"
          className="min-h-12 w-full text-sm text-slate-500 hover:text-slate-700"
          onClick={() => {
            setStep('phone')
            setOtp('')
            setError('')
          }}
        >
          {getUIText('auth_phone_changeNumber', language)}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="auth-phone">{getUIText('auth_phone_label', language)}</Label>
        <Input
          id="auth-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          placeholder={getUIText('auth_phone_placeholder', language)}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-12 text-base"
          enterKeyHint="done"
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button
        type="button"
        variant="brand"
        className="h-12 w-full text-base"
        disabled={busy || phone.replace(/\D/g, '').length < 10}
        onClick={() => void sendOtp()}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {getUIText('auth_phone_sendCode', language)}
      </Button>
    </div>
  )
}

export default AuthPhoneFlow
