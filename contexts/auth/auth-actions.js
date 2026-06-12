'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { isAuthPasswordCompliant, AUTH_PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'
import { signIn, signUp } from '@/lib/auth'
import { getOAuthBrowserSupabase, getOAuthRedirectOrigin } from '@/lib/supabase/oauth-browser-client'
import { safeInternalPath } from '@/lib/security/safe-internal-path'
import {
  PENDING_REF_COOKIE,
  PENDING_REF_LS,
  readPendingRefFromCookie,
  getStableReferralFingerprint,
} from '@/contexts/auth/auth-referral-handler'
import { useGeo } from '@/contexts/geo-context'

const OAUTH_RETURN_TO_LS = 'gostaylo_oauth_return_to'

export function useAuthActions(params) {
  const {
    authMode,
    registerLegalConsent,
    language,
    pathname,
    router,
    persistOAuthLegalCookie,
    email,
    password,
    name,
    promoCode,
    closeLoginModal,
    setAuthMode,
    setError,
    setSubmitting,
    setGoogleOAuthBusy,
    setVerificationEmail,
    setUser,
    normalizeAuthUser,
    setPromoStatus,
    setPromoMessage,
    setPromoCode,
    setForgotPasswordSent,
  } = params

  const { isRussia } = useGeo()

  const startGoogleOAuth = useCallback(async () => {
    if (isRussia) {
      const msg =
        language === 'ru'
          ? 'Вход через Google недоступен в вашем регионе. Используйте email и пароль.'
          : 'Google sign-in is not available in your region. Use email and password.'
      setError(msg)
      toast.error(msg)
      return
    }
    if (authMode === 'register' && !registerLegalConsent) {
      setError(getUIText('auth_registerLegalRequired', language))
      return
    }
    persistOAuthLegalCookie(authMode === 'register')
    const sb = getOAuthBrowserSupabase()
    if (!sb) {
      toast.error(getAuthErrorMessage('AUTH_OAUTH_UNAVAILABLE', language))
      return
    }
    setGoogleOAuthBusy(true)
    setError('')
    try {
      let nextPath = pathname || '/profile/'
      try {
        const saved = sessionStorage.getItem('gostaylo_redirect_after_login')
        if (saved?.startsWith('/')) nextPath = saved
        const current = `${window.location.pathname || '/'}${window.location.search || ''}`
        if (current.startsWith('/') && !current.startsWith('//')) {
          localStorage.setItem(OAUTH_RETURN_TO_LS, current)
          if (!saved?.startsWith('/')) nextPath = current
        }
      } catch {
        // ignore
      }
      if (!nextPath.startsWith('/') || nextPath.startsWith('//')) nextPath = '/profile/'
      const withSlash = nextPath.endsWith('/') ? nextPath : `${nextPath}/`

      const origin = getOAuthRedirectOrigin()
      if (!origin) {
        toast.error(getAuthErrorMessage('AUTH_OAUTH_UNAVAILABLE', language))
        return
      }
      const callback = new URL(`${origin}/auth/callback/`)
      callback.searchParams.set('next', withSlash)

      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback.toString(),
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      })
      if (error) throw error
      if (data?.url) {
        window.location.assign(data.url)
      }
    } catch (e) {
      console.error('[oauth google]', e)
      toast.error(getAuthErrorMessage('AUTH_OAUTH_FAILED', language))
      persistOAuthLegalCookie(false)
    } finally {
      setGoogleOAuthBusy(false)
    }
  }, [
    isRussia,
    authMode,
    registerLegalConsent,
    setError,
    language,
    persistOAuthLegalCookie,
    setGoogleOAuthBusy,
    pathname,
  ])

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault()
      setSubmitting(true)
      setError('')

      try {
        const savedRedirect = sessionStorage.getItem('gostaylo_redirect_after_login')
        const currentPath = window.location.pathname
        const stayOnCurrentPage =
          currentPath.startsWith('/partner/') ||
          currentPath.startsWith('/admin/') ||
          currentPath.startsWith('/renter/')
        const customRedirect =
          savedRedirect || stayOnCurrentPage ? safeInternalPath(savedRedirect || currentPath, '/') : null

        const result = await signIn(email.toLowerCase().trim(), password, customRedirect)

        if (result.requiresVerification) {
          setVerificationEmail(result.email || email)
          setAuthMode('verification_pending')
          setSubmitting(false)
          return
        }
        if (!result.success) {
          setError(getAuthErrorMessage(result.error_code, language))
          setSubmitting(false)
          return
        }

        const normalizedLogin = normalizeAuthUser(result.user)
        setUser(normalizedLogin)
        localStorage.setItem('gostaylo_user', JSON.stringify(normalizedLogin))
        closeLoginModal()

        if (savedRedirect) sessionStorage.removeItem('gostaylo_redirect_after_login')
        window.dispatchEvent(new CustomEvent('auth-change', { detail: normalizedLogin }))

        if (savedRedirect) {
          router.push(safeInternalPath(savedRedirect, '/'))
        } else if (stayOnCurrentPage) {
          router.refresh()
        } else if (result.redirectTo) {
          router.push(safeInternalPath(result.redirectTo, '/'))
        }
      } catch {
        setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        setSubmitting(false)
      }
    },
    [
      setSubmitting,
      setError,
      email,
      password,
      setVerificationEmail,
      setAuthMode,
      language,
      normalizeAuthUser,
      setUser,
      closeLoginModal,
      router,
    ],
  )

  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault()
      setSubmitting(true)
      setError('')

      try {
        if (!isAuthPasswordCompliant(password)) {
          if (!password || password.length < AUTH_PASSWORD_MIN_LENGTH) {
            setError(getAuthErrorMessage('AUTH_PASSWORD_TOO_SHORT', language))
          } else {
            setError(getAuthErrorMessage('AUTH_PASSWORD_REQUIREMENTS', language))
          }
          setSubmitting(false)
          return
        }

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
          try {
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
              setSubmitting(false)
              return
            }
            referredByPayload = effectiveRef
            setPromoStatus('valid')
            setPromoMessage(getUIText('auth_promoAccepted', language))
            setPromoCode(effectiveRef)
          } catch {
            setError(getAuthErrorMessage('AUTH_INTERNAL', language))
            setSubmitting(false)
            return
          }
        }

        if (!registerLegalConsent) {
          setError(getUIText('auth_registerLegalRequired', language))
          setSubmitting(false)
          return
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
          setSubmitting(false)
          return
        }

        try {
          document.cookie = `${PENDING_REF_COOKIE}=; Path=/; Max-Age=0`
          localStorage.removeItem(PENDING_REF_LS)
        } catch {
          // ignore
        }

        setVerificationEmail(email)
        setAuthMode('verification_pending')

        if (result.email_error_code) {
          toast.error(getAuthErrorMessage(result.email_error_code, language))
        } else if (result.requiresVerification && result.emailSent === false) {
          toast.warning(getAuthErrorMessage('AUTH_VERIFICATION_EMAIL_PENDING', language))
        }
      } catch {
        setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        setSubmitting(false)
      }
    },
    [
      setSubmitting,
      setError,
      password,
      language,
      promoCode,
      email,
      setPromoStatus,
      setPromoMessage,
      setPromoCode,
      registerLegalConsent,
      name,
      setVerificationEmail,
      setAuthMode,
    ],
  )

  const validatePromoCode = useCallback(async () => {
    const code = String(promoCode || '').trim().toUpperCase()
    if (!code) {
      setPromoStatus('idle')
      setPromoMessage('')
      return false
    }
    setPromoStatus('checking')
    setPromoMessage('')
    try {
      const res = await fetch('/api/v2/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          email: email.toLowerCase().trim(),
          fingerprint: getStableReferralFingerprint(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.valid) {
        setPromoCode(code)
        setPromoStatus('valid')
        setPromoMessage(getUIText('auth_promoAccepted', language))
        return true
      }
      setPromoStatus('invalid')
      setPromoMessage(getAuthErrorMessage(json?.error_code, language))
      return false
    } catch {
      setPromoStatus('invalid')
      setPromoMessage(getAuthErrorMessage('AUTH_INTERNAL', language))
      return false
    }
  }, [promoCode, setPromoStatus, setPromoMessage, email, setPromoCode, language])

  const handleForgotPassword = useCallback(
    async (e) => {
      e.preventDefault()
      setSubmitting(true)
      setError('')

      try {
        const response = await fetch('/api/v2/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
        })
        const result = await response.json().catch(() => ({}))

        if (result.success) {
          setForgotPasswordSent(true)
          toast.success(getUIText('auth_forgot_toastSent', language))
        } else {
          setError(getAuthErrorMessage(result.error_code, language))
        }
      } catch {
        setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        setSubmitting(false)
      }
    },
    [setSubmitting, setError, email, setForgotPasswordSent, language],
  )

  return {
    startGoogleOAuth,
    handleLogin,
    handleRegister,
    validatePromoCode,
    handleForgotPassword,
  }
}

export default useAuthActions
