'use client'

/**
 * Error Boundary for /partner segment
 * Shows friendly message instead of white screen
 */

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PartnerError({ error, reset }) {
  useEffect(() => {
    console.error('[Partner Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Произошла ошибка</h2>
          <p className="text-slate-600 mb-6">
            Не удалось загрузить панель партнёра. Попробуйте обновить страницу или вернуться в личный кабинет.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset} variant="default" className="bg-teal-600 hover:bg-teal-700">
              Попробовать снова
            </Button>
            <Button asChild variant="outline">
              <Link href="/partner/dashboard" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                В кабинет
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
