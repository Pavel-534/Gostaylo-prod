'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, ArrowRight, Home, Mail } from 'lucide-react'
import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'

export default function PartnerApplicationSuccessPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Check if user came from application form
    const hasApplied = localStorage.getItem('gostaylo_partner_applied')
    if (!hasApplied) {
      // If not, they might have landed here directly - still show the page
      // but they can navigate away
    }
  }, [])

  return (
    <div className='min-h-screen bg-gradient-to-b from-teal-50 to-white flex items-center justify-center p-4'>
      <div className='max-w-md w-full'>
        {/* Success Animation */}
        <div className='text-center mb-6'>
          <div className='w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow'>
            <CheckCircle className='h-10 w-10 text-teal-600' />
          </div>
          <h1 className='text-2xl font-bold text-slate-900 mb-2'>
            Заявка принята!
          </h1>
          <p className='text-slate-600'>
            Спасибо за интерес к партнёрству с {getSiteDisplayName()}
          </p>
        </div>

        {/* Info Card */}
        <Card className='mb-6 border-teal-200'>
          <CardContent className='pt-6'>
            <div className='flex items-start gap-4 mb-4'>
              <div className='w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0'>
                <Clock className='h-5 w-5 text-amber-600' />
              </div>
              <div>
                <h3 className='font-semibold text-slate-900'>Время рассмотрения</h3>
                <p className='text-sm text-slate-600 mt-1'>
                  Наш модератор проверит вашу заявку в течение <strong>24 часов</strong>.
                </p>
              </div>
            </div>
            
            <div className='flex items-start gap-4'>
              <div className='w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0'>
                <Mail className='h-5 w-5 text-blue-600' />
              </div>
              <div>
                <h3 className='font-semibold text-slate-900'>Уведомление</h3>
                <p className='text-sm text-slate-600 mt-1'>
                  Вы получите email с результатом рассмотрения. Также проверьте папку "Спам".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's Next */}
        <Card className='mb-6 bg-slate-50'>
          <CardContent className='pt-6'>
            <h3 className='font-semibold text-slate-900 mb-3'>Что дальше?</h3>
            <ul className='space-y-2 text-sm text-slate-600'>
              <li className='flex items-start gap-2'>
                <span className='w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0'>1</span>
                <span>Модератор проверит информацию о вас</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0'>2</span>
                <span>После одобрения вы получите доступ к панели партнёра</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0'>3</span>
                <span>Добавьте ваши объекты и начните зарабатывать!</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className='space-y-3'>
          <Button 
            asChild
            className='w-full bg-teal-600 hover:bg-teal-700'
          >
            <Link href='/'>
              <Home className='h-4 w-4 mr-2' />
              Вернуться на главную
            </Link>
          </Button>
          
          <Button 
            asChild
            variant='outline'
            className='w-full'
          >
            <Link href='/profile'>
              Перейти в профиль
              <ArrowRight className='h-4 w-4 ml-2' />
            </Link>
          </Button>
        </div>

        {/* Support */}
        <p className='text-center text-xs text-slate-500 mt-6'>
          Вопросы? Напишите нам в{' '}
          <a 
            href='https://t.me/gostaylo_support' 
            target='_blank' 
            rel='noopener noreferrer'
            className='text-teal-600 hover:underline'
          >
            Telegram
          </a>
        </p>
      </div>

      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
