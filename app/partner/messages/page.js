'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PartnerMessagesIndex() {
  const router = useRouter()

  useEffect(() => {
    async function loadFirstConversation() {
      try {
        const res = await fetch('/api/conversations?userId=partner-1&role=PARTNER')
        const data = await res.json()
        
        if (data.success && data.data?.length > 0) {
          router.push(`/partner/messages/${data.data[0].id}`)
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
      }
    }
    
    loadFirstConversation()
  }, [router])

  return (
    <div className='p-4 lg:p-8'>
      <div className='flex flex-col items-center justify-center h-96'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4'></div>
        <p className='text-slate-600'>Загрузка сообщений...</p>
      </div>
    </div>
  );
}
