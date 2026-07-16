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
import { signIn } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'
import { finishAuthNavigation } from '@/lib/auth/auth-redirect'
import { useAuth } from '@/contexts/auth-context'
import { safeInternalPath } from '@/lib/security/safe-internal-path'

export function AuthEmailLoginForm() {
  const router = useRouter()
  const { language } = useI18n()
  const { refreshUserFromServer } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setBusy(true)
      setError('')
      try {
        const savedRedirect = sessionStorage.getItem('gostaylo_redirect_after_login')
        const customRedirect = savedRedirect?.startsWith('/') ? safeInternalPath(savedRedirect, '/') : null
        const result = await signIn(email.toLowerCase().trim(), password, customRedirect)

        if (result.requiresVerification) {
          router.push(`/auth/verify-email?email=${encodeURIComponent(result.email || email)}`)
          return
        }
        if (!result.success) {
          setError(getAuthErrorMessage(result.error_code, language))
          return
        }

        const verified = await getCurrentUser()
        if (!verified) {
          setError(getAuthErrorMessage('AUTH_INTERNAL', language))
          return
        }
        await refreshUserFromServer()
        try {
          localStorage.setItem('gostaylo_user', JSON.stringify(verified))
        } catch {
          /* ignore */
        }
        finishAuthNavigation(router, result.redirectTo || '/profile/')
      } catch {
        setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        setBusy(false)
      }
    },
    [email, password, language, router, refreshUserFromServer],
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="auth-email">{getUIText('email', language)}</Label>
        <Input
          id="auth-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={getUIText('auth_email_placeholder', language)}
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          className="h-12 text-base"
          required
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="auth-password">{getUIText('password', language)}</Label>
          <Link
            href="/auth/forgot-password"
            className="inline-flex min-h-12 items-center px-1 text-sm text-brand hover:underline"
          >
            {getUIText('auth_forgot_password', language)}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 pr-12 text-base"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 flex min-h-12 min-w-12 -translate-y-1/2 items-center justify-center text-slate-400"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {getUIText('loginButton', language)}
      </Button>
    </form>
  )
}

export default AuthEmailLoginForm
