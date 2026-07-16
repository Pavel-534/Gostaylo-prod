'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { toast } from 'sonner'

export default function AuthForgotPasswordPage() {
  const { language } = useI18n()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setBusy(true)
      setError('')
      try {
        const res = await fetch('/api/v2/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
        })
        const json = await res.json().catch(() => ({}))
        if (json.success) {
          setSent(true)
          toast.success(getUIText('auth_forgot_toastSent', language))
        } else {
          setError(getAuthErrorMessage(json.error_code, language))
        }
      } catch {
        setError(getAuthErrorMessage('AUTH_INTERNAL', language))
      } finally {
        setBusy(false)
      }
    },
    [email, language],
  )

  return (
    <AuthPageShell
      title={getUIText('auth_forgot_title', language)}
      subtitle={getUIText('auth_forgot_description', language)}
      backHref="/auth/login"
    >
      {sent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-slate-600">
            {getUIText('auth_forgot_sentLead', language)}
            <br />
            <strong className="text-slate-900">{email}</strong>
          </p>
          <p className="text-sm text-slate-500">{getUIText('auth_forgot_sentInstructions', language)}</p>
          <Button asChild variant="outline" className="h-12 px-6">
            <Link href="/auth/login">{getUIText('auth_backToLogin', language)}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">{getUIText('email', language)}</Label>
            <Input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              className="h-12 text-base"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {getUIText('auth_forgot_sendLink', language)}
          </Button>
        </form>
      )}
    </AuthPageShell>
  )
}
