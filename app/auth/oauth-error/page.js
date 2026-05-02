'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Inner() {
  const sp = useSearchParams()
  const reason = sp.get('reason') || ''

  return (
    <main className='min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 font-sans'>
      <div className='max-w-md text-center'>
        <h1 className='text-xl font-semibold text-slate-900 mb-3'>Не удалось войти через соцсеть</h1>
        <p className='text-sm text-slate-600 mb-6'>
          {reason ? (
            <>
              Детали: <span className='font-mono text-slate-800'>{reason}</span>
            </>
          ) : (
            'Проверьте настройки Google / Apple и redirect URL в Supabase.'
          )}
        </p>
        <Link href='/' className='text-teal-700 underline text-sm'>
          На главную
        </Link>
      </div>
    </main>
  )
}

export default function OAuthErrorPage() {
  return (
    <Suspense
      fallback={
        <main className='min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm'>
          …
        </main>
      }
    >
      <Inner />
    </Suspense>
  )
}
