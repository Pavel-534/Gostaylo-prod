'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { signUp } from '@/lib/auth'
import { isAuthPasswordCompliant, AUTH_PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'
import {
  getStableReferralFingerprint,
  PENDING_REF_COOKIE,
  PENDING_REF_LS,
  readPendingRefFromCookie,
} from '@/contexts/auth/auth-referral-handler'

export function AuthEmailRegisterForm({ legalConsent = false, onLegalRequired }) {
  const router = useRouter()
  const { language } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!legalConsent) {
        onLegalRequired?.()
        setError(getUIText('auth_registerLegalRequired', language))
        return
      }
      if (!isAuthPasswordCompliant(password)) {
        setError(
          password.length < AUTH_PASSWORD_MIN_LENGTH
            ? getAuthErrorMessage('AUTH_PASSWORD_TOO_SHORT', language)
            : getAuthErrorMessage('AUTH_PASSWORD_REQUIREMENTS', language),
        )
        return
      }

      setBusy(true)
      setError('')

      try {
        const typedRef = String(promoCode || '').trim().toUpperCase()
        let fallbackRef = ''
        try {
          fallbackRef =
            readPendingRefFromCookie().trim().toUpperCase() ||
            String(localStorage.getItem(PENDING_REF_LS) || '').trim().toUpperCase()
        } catch {
          fallbackRef = ''
        }
        const effectiveRef = typedRef || fallbackRef || ''
        let referredByPayload = null

        if (effectiveRef) {
          const vr = await fetch('/api/v2/referral/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: effectiveRef,
              email: email.toLowerCase().trim(),
              fingerprint: getStableReferralFingerprint(),
            }),
          })
          const vjson = await vr.json().catch(() => ({}))
          if (!vr.ok || !vjson?.valid) {
            setError(getAuthErrorMessage(vjson?.error_code, language))
            setBusy(false)
            return
          }
          referredByPayload = effectiveRef
        }

        const result = await signUp({
          email: email.toLowerCase().trim(),
          password,
          name: name.trim(),
          role: 'RENTER',
          referredBy: referredByPayload,
          referralFingerprint: getStableReferralFingerprint(),
          acceptedLegalTerms: true,
        })

        if (!result.success) {
          setError(getAuthErrorMessage(result.error_code, language))
          return
        }

        try {
          document.cookie = `${PENDING_REF_COOKIE}=; Path=/; Max-Age=0`
          localStorage.removeItem(PENDING_REF_LS)
        } catch {
          /* ignore */
        }

        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
      } catch {
        setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        setBusy(false)
      }
    },
    [legalConsent, password, promoCode, email, name, language, router, onLegalRequired],
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="auth-name">{getUIText('auth_field_firstName', language)}</Label>
        <Input
          id="auth-name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={getUIText('auth_field_firstNamePlaceholder', language)}
          className="h-12 text-base"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-referral">{getUIText('auth_referral_label', language)}</Label>
        <Input
          id="auth-referral"
          value={promoCode}
          onChange={(e) => setPromoCode(String(e.target.value || '').toUpperCase())}
          placeholder={getUIText('auth_referral_placeholder', language)}
          className="h-12 text-base uppercase"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-email">{getUIText('email', language)}</Label>
        <Input
          id="auth-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          placeholder={getUIText('auth_email_placeholder', language)}
          className="h-12 text-base"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-password">{getUIText('password', language)}</Label>
        <div className="relative">
          <Input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 pr-12 text-base"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 flex min-h-12 min-w-12 -translate-y-1/2 items-center justify-center text-slate-400"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-500">{getUIText('auth_password_minHint', language)}</p>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button
        type="submit"
        variant="brand"
        className="h-12 w-full text-base"
        disabled={busy || !legalConsent || !isAuthPasswordCompliant(password)}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {getUIText('auth_modal_submitCreate', language)}
      </Button>
      <p className="text-center text-sm text-slate-500">
        {getUIText('auth_haveAccount', language)}{' '}
        <Link href="/auth/login" className="text-brand hover:underline">
          {getUIText('login', language)}
        </Link>
      </p>
    </form>
  )
}

export default AuthEmailRegisterForm
