'use client'

/**
 * Error Boundary for /admin segment
 * (.jsx — UI-компоненты из components/ui/*.jsx без типов children для TSX)
 */

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error('[Admin Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50">
      <div
        className={cn(
          'rounded-xl border bg-card text-card-foreground shadow max-w-md w-full'
        )}
      >
        <div className="p-6 pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Ошибка админ-панели</h2>
          <p className="text-slate-600 mb-6">
            Не удалось загрузить раздел. Попробуйте обновить страницу или вернуться в панель управления.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset} variant="default" className="bg-teal-600 hover:bg-teal-700">
              Попробовать снова
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/dashboard" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                В панель
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
