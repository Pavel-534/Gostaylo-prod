/**
 * Role-based dashboard router (legacy `/dashboard` entry).
 * Stage 200.65 — LoadingPageShell while resolving `/api/v2/auth/me`.
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'

export default function DashboardRouter() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function checkRoleAndRedirect() {
      try {
        const res = await fetch('/api/v2/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        })
        const payload = await res.json().catch(() => ({}))

        if (cancelled) return

        if (res.status === 401 || !payload?.success || !payload?.user) {
          router.replace('/auth/login')
          return
        }

        const role = String(payload.user.role || 'RENTER').toUpperCase()

        switch (role) {
          case 'ADMIN':
          case 'MODERATOR':
            router.replace('/admin')
            break
          case 'PARTNER':
            router.replace('/partner/dashboard')
            break
          case 'RENTER':
          default:
            router.replace('/renter/dashboard')
            break
        }
      } catch (error) {
        console.error('[DASHBOARD] Error:', error)
        if (!cancelled) router.replace('/')
      }
    }

    void checkRoleAndRedirect()
    return () => {
      cancelled = true
    }
  }, [router])

  return <LoadingPageShell label="Перенаправление…" />
}
