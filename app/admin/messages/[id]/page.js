'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AdminMessagesThreadClient } from '@/components/chat/AdminMessagesThreadClient'
import { useI18n } from '@/contexts/i18n-context'

function AdminThreadPageContent() {
  const params = useParams()
  const router = useRouter()
  const { language } = useI18n()
  const conversationId = params?.id ? String(params.id) : null
  const [me, setMe] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (!data.success || !data.user) {
          setMe(null)
        } else if (!['ADMIN', 'MODERATOR'].includes(data.user.role)) {
          setMe(null)
        } else {
          setMe(data.user)
        }
      } catch {
        setMe(null)
      } finally {
        setAuthChecked(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!conversationId) router.replace('/admin/messages/')
  }, [conversationId, router])

  if (!authChecked) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-slate-600">
          {language === 'en' ? 'Admin or moderator sign-in required.' : 'Требуется вход администратора или модератора.'}
        </p>
      </div>
    )
  }

  if (!conversationId) return null

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AdminMessagesThreadClient conversationId={conversationId} me={me} language={language} />
    </div>
  )
}

export default function AdminMessageThreadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <AdminThreadPageContent />
    </Suspense>
  )
}
