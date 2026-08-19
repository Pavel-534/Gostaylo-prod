import Link from 'next/link'
import { PublicLeaderboard } from '@/components/referral/PublicLeaderboard'
import { Button } from '@/components/ui/button'
import { getSiteDisplayName } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

const disclaimer = 'Доход зависит от активности. Не гарантирован.'

export const metadata = {
  title: `Топ амбассадоров ${getSiteDisplayName()}`,
  description: `Посмотри, кто зарабатывает на рефералке. ${disclaimer}`,
  robots: { index: 'index, follow' },
}

export default function LeaderboardPage({ searchParams }) {
  const period = String(searchParams?.period || 'month').toLowerCase() === 'alltime' ? 'alltime' : 'month'

  const heroTitle =
    period === 'alltime' ? 'Топ-10 амбассадоров за всё время' : 'Топ-10 амбассадоров этого месяца'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <section className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand via-brand-hover to-teal-900 text-white p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-white/80">Referral leaderboard</div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{heroTitle}</h1>
            <p className="text-sm text-white/85">{disclaimer}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              variant={period === 'month' ? 'brand' : 'outline'}
              className="min-h-[44px] whitespace-nowrap"
            >
              <Link href="/leaderboard?period=month">Этот месяц</Link>
            </Button>
            <Button
              asChild
              variant={period === 'alltime' ? 'brand' : 'outline'}
              className="min-h-[44px] whitespace-nowrap"
            >
              <Link href="/leaderboard?period=alltime">За всё время</Link>
            </Button>

            <Button asChild variant="brand" className="min-h-[44px] ml-auto">
              <Link href="/partner">Стать амбассадором →</Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicLeaderboard period={period} limit={10} />

      <p className="text-xs sm:text-sm text-slate-600">
        {disclaimer}
      </p>
    </div>
  )
}

