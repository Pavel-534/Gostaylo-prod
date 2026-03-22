'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'

export default function PartnerMessagesIndex() {
  const router = useRouter()
  const [phase, setPhase] = useState('loading')

  useEffect(() => {
    let cancelled = false

    async function loadFirstConversation() {
      try {
        const me = await fetch('/api/v2/auth/me', { credentials: 'include' }).then((r) => r.json())
        if (cancelled) return
        if (!me.success || !me.user) {
          setPhase('unauthorized')
          return
        }

        const res = await fetch('/api/v2/chat/conversations?enrich=1', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return

        if (data.success && data.data?.length > 0) {
          router.replace(`/partner/messages/${data.data[0].id}`)
          return
        }
        setPhase('empty')
      } catch (error) {
        console.error('Failed to load conversations:', error)
        if (!cancelled) setPhase('error')
      }
    }

    loadFirstConversation()
    return () => {
      cancelled = true
    }
  }, [router])

  if (phase === 'unauthorized') {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h3>
          <p className="text-slate-600">Войдите в систему для просмотра сообщений</p>
        </div>
      </div>
    )
  }

  if (phase === 'empty' || phase === 'error') {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <MessageSquare className="h-16 w-16 text-slate-300 mb-4 mx-auto" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {phase === 'error' ? 'Не удалось загрузить' : 'Нет сообщений'}
          </h3>
          <p className="text-slate-600">
            {phase === 'error'
              ? 'Попробуйте обновить страницу.'
              : 'Когда клиенты напишут вам, диалоги появятся здесь.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
        <p className="text-slate-600">Загрузка сообщений...</p>
      </div>
    </div>
  )
}
