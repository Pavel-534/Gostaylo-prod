'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Единая ссылка для push: /messages/[conversationId] → нужный кабинет по роли.
 */
export default function UniversalMessageDeepLink() {
  const params = useParams()
  const router = useRouter()
  const [error, setError] = useState(null)

  useEffect(() => {
    const id = params?.id
    const nav = (href) => router.replace(href, { scroll: false })

    if (!id || typeof id !== 'string') {
      nav('/')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (!data.success || !data.user) {
          nav('/')
          return
        }
        const role = String(data.user.role || '').toUpperCase()
        if (role === 'PARTNER') {
          nav(`/partner/messages/${encodeURIComponent(id)}`)
          return
        }
        if (role === 'ADMIN' || role === 'MODERATOR') {
          nav(`/admin/messages/?open=${encodeURIComponent(id)}`)
          return
        }
        nav(`/renter/messages/${encodeURIComponent(id)}`)
      } catch {
        if (!cancelled) setError('network')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params?.id, router])

  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4 text-center text-slate-600">
        Не удалось загрузить.{' '}
        <button type="button" className="text-teal-600 underline" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      <p className="text-sm">Открываем чат…</p>
    </div>
  )
}
