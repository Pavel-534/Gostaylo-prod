import { Suspense } from 'react'
import { ReferralCalculatorClient } from '@/components/about/ReferralCalculatorClient'
import { getSiteDisplayName } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: `Калькулятор амбассадора | ${getSiteDisplayName()}`,
  description:
    'Оцените доход L1, L2 и cashback друга с одной завершённой поездки по актуальным настройкам Ambassador Program.',
}

export default function AboutReferralPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500">Загрузка…</div>}>
      <ReferralCalculatorClient />
    </Suspense>
  )
}
