import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'
import { Shield, Sparkles, HeartHandshake, Globe2 } from 'lucide-react'

export const metadata = {
  title: `О нас | ${getSiteDisplayName()}`,
  description: 'GoStaylo — премиальная платформа аренды недвижимости, транспорта и яхт на Пхукете.',
}

const PRINCIPLES = [
  {
    icon: Shield,
    title: 'Прозрачность',
    desc: 'Без скрытых комиссий и комиссионеров. Только проверенные партнёры.',
  },
  {
    icon: Sparkles,
    title: 'Премиум-сервис',
    desc: 'Курируем каждый объект, чтобы аренда оставалась впечатлением, а не сделкой.',
  },
  {
    icon: HeartHandshake,
    title: 'Безопасность',
    desc: 'Escrow-защита платежей и круглосуточная поддержка на 4 языках.',
  },
  {
    icon: Globe2,
    title: 'Глобальный охват',
    desc: 'Гости со всего мира находят своё идеальное место на Пхукете.',
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto px-4 pt-24 sm:pt-28 pb-16 sm:pb-20 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            {getSiteDisplayName()} · Phuket
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-6">
            Аренда без посредников —<br />
            <span className="text-[#006666]">только настоящие владельцы.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
            Мы объединяем арендодателей и путешественников на Пхукете в одну прозрачную
            экосистему — виллы, яхты, транспорт и туры в пару тапов.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-5xl">
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-10 text-center">
          Что для нас важно
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 transition-all duration-300 hover:border-teal-300 hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-[#006666]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 py-16 sm:py-20 max-w-3xl">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-6">
            Наша история
          </h2>
          <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
            <p>
              {getSiteDisplayName()} появился, когда мы сами столкнулись с хаосом аренды на Пхукете:
              десятки чатов, разрозненных сайтов и посредников, накручивающих цену.
            </p>
            <p>
              Мы сделали платформу, где всё прозрачно: реальные фото, честные цены,
              защита средств до заселения. Без двойных стандартов и скрытых комиссий.
            </p>
            <p>
              Сегодня у нас тысячи объектов и гости из десятков стран — но цель прежняя:
              сделать аренду такой же простой, как заказать такси.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-4xl text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-4">
          Начните своё путешествие
        </h2>
        <p className="text-base sm:text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
          Откройте тысячи проверенных объектов на Пхукете — от вилл с видом на океан до яхт и авто.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/listings"
            className="inline-flex items-center justify-center rounded-2xl bg-[#006666] px-7 py-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)] transition-all hover:bg-[#005555] active:scale-[0.98]"
          >
            Найти объект →
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-700"
          >
            Центр помощи
          </Link>
        </div>
      </section>
    </main>
  )
}
