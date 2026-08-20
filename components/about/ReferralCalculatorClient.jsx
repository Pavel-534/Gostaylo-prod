'use client'

import Link from 'next/link'
import { Calculator } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { ReferralCalculatorV2 } from '@/components/referral/ReferralCalculatorV2'

/**
 * Stage 131.A5.B2 — public /about/referral calculator uses shared v2 UI.
 */
export function ReferralCalculatorClient() {
  const { isAuthenticated } = useAuth()
  const { language } = useI18n()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm text-brand font-medium">
          <Calculator className="h-4 w-4" />
          Ambassador Program
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {language === 'en' ? 'Referral earnings calculator' : 'Калькулятор дохода амбассадора'}
        </h1>
        <p className="text-slate-600 max-w-xl mx-auto">
          {language === 'en'
            ? 'Estimate what you can earn from invitees — based on current program settings.'
            : 'Оцените доход от приглашённых — по актуальным настройкам программы.'}
        </p>
      </div>

      <ReferralCalculatorV2 />

      <div className="text-center text-sm text-slate-600">
        {isAuthenticated ? (
          <Link href="/profile/referral" className="text-brand font-medium underline">
            {language === 'en' ? 'My referral hub →' : 'Мой реферальный кабинет →'}
          </Link>
        ) : (
          <Link href="/login?next=/about/referral" className="text-brand font-medium underline">
            {language === 'en' ? 'Sign in and get your link →' : 'Войти и получить ссылку →'}
          </Link>
        )}
      </div>
    </div>
  )
}
