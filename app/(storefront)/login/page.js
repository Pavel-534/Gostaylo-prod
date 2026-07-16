'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/** Только внутренние пути — без open-redirect на //evil.com */
function safeInternalRedirect(raw) {
  if (!raw || typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  return t.slice(0, 2048)
}

function LoginRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const redirect = safeInternalRedirect(searchParams.get('redirect'))
    if (redirect) {
      try {
        sessionStorage.setItem('gostaylo_redirect_after_login', redirect)
      } catch {
        /* ignore quota / private mode */
      }
    }
    router.replace('/profile?login=true')
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
      <Loader2 className="h-10 w-10 animate-spin text-teal-600" aria-hidden />
      <p className="text-sm">Перенаправление на вход…</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      }
    >
      <LoginRedirectInner />
    </Suspense>
  )
}
