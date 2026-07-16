'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { AuthPageShell } from '@/components/auth/AuthPageShell'

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const email = searchParams.get('email') || ''

  return (
    <AuthPageShell
      title={getUIText('auth_verify_emailTitle', language)}
      subtitle={getUIText('auth_verify_emailInstructions', language)}
      backHref="/auth/login"
    >
      <div className="flex flex-1 flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15">
          <Mail className="h-8 w-8 text-brand" />
        </div>
        <p className="text-slate-600">{getUIText('auth_verify_emailSent', language)}</p>
        {email ? <p className="font-medium text-slate-900">{email}</p> : null}
        <Button asChild variant="outline" className="mt-4 h-12 px-6">
          <Link href="/auth/login">{getUIText('auth_backToLogin', language)}</Link>
        </Button>
      </div>
    </AuthPageShell>
  )
}

export default function AuthVerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  )
}
