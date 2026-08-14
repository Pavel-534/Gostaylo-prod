import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { Shield, MessageCircle, CreditCard, MapPin, BadgeCheck, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'
import { LegalPublisherNote } from '@/components/legal/LegalPublisherNote'

export const metadata = {
  title: `Центр помощи | ${getSiteDisplayName()}`,
  description: 'FAQ, безопасная оплата, отмена бронирования и контакты поддержки.',
}

const SECTIONS = [
  {
    icon: BadgeCheck,
    title: 'Для гостей',
    items: [
      { q: 'Как забронировать объект?', a: 'Выберите даты и локацию → откройте карточку → нажмите «Забронировать». Оплата проходит через платёжного партнёра; партнёру доля уходит после подтверждения заселения.' },
      { q: 'Когда списываются деньги?', a: 'Оплата резервируется сразу. Партнёру средства перечисляются только после подтверждения заселения — по правилам оферты и карточки.' },
      { q: 'Могу ли я отменить бронь?', a: 'Да. Условия отмены и возврата зависят от правил конкретного объекта, указанных в его карточке (согласно политике возвратов).' },
    ],
  },
  {
    icon: Shield,
    title: 'Как устроена безопасная оплата',
    items: [
      { q: 'Кто удерживает деньги?', a: 'Средства удерживаются платёжным партнёром. Платформа не является банком и не принимает оплату «на свой эскроу-счёт».' },
      { q: 'Что если объект не соответствует?', a: 'Напишите в поддержку как можно скорее. Если партнёр не оказал услугу — возврат по политике возвратов и оферте; в спорных случаях нужна проверка переписки и фактов.' },
    ],
    cta: { href: '/help/escrow-protection', label: 'Подробнее о защите платежа →' },
  },
  {
    icon: CreditCard,
    title: 'Оплата',
    items: [
      { q: 'Какие валюты поддерживаются?', a: 'THB, USD, EUR, RUB, CNY — курс фиксируется в момент оплаты по данным платёжного контура.' },
      { q: 'Есть ли комиссия?', a: 'Сервисный сбор платформы включён в итоговую цену и показывается до оплаты.' },
    ],
  },
  {
    icon: MapPin,
    title: 'Для партнёров',
    items: [
      { q: 'Как разместить объект?', a: 'Перейдите в раздел «Стать партнёром» → заполните анкету → модерация обычно занимает до одного рабочего дня.' },
      { q: 'Сколько стоит?', a: 'Размещение бесплатно. Мы берём сервисный сбор только с подтверждённых бронирований — он виден до оплаты.' },
    ],
    cta: { href: '/partner', label: 'Стать партнёром →' },
  },
]

export default function HelpPage() {
  const supportEmail = getPublicSupportEmail()

  return (
    <main className="min-h-screen bg-white">
      {/* Hero — top inset already from MainContent app-shell-main (fixed header) */}
      <section id="top" className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-brand/10 via-white to-white">
        <div className="container mx-auto max-w-4xl px-4 pt-6 pb-8 sm:pt-8 sm:pb-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-hover">
            <MessageCircle className="h-3 w-3" />
            {getSiteDisplayName()}
          </p>
          <h1 className="mb-3 text-3xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:mb-4 sm:text-4xl lg:text-5xl">
            Центр помощи {getSiteDisplayName()}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            FAQ ниже или письмо на поддержку — отвечаем в рабочие часы, обычно в течение нескольких часов.
          </p>
        </div>
      </section>

      {/* FAQ sections */}
      <section className="container mx-auto max-w-4xl space-y-8 px-4 py-8 sm:space-y-10 sm:py-12">
        {SECTIONS.map(({ icon: Icon, title, items, cta }) => (
          <div key={title}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {title}
              </h2>
            </div>
            <div
              className={cn(
                MOBILE_FLAT_CARD_CLASS,
                'divide-y divide-slate-100 max-sm:border-t max-sm:border-b max-sm:border-slate-100',
              )}
            >
              {items.map(({ q, a }) => (
                <details
                  key={q}
                  className="group px-5 py-4 transition-colors hover:bg-slate-50/50 sm:px-6 sm:py-5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex list-none cursor-pointer items-start justify-between gap-4">
                    <span className="text-base font-semibold text-slate-900 sm:text-lg">{q}</span>
                    <span className="mt-1 shrink-0 text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{a}</p>
                </details>
              ))}
            </div>
            {cta && (
              <div className="mt-3">
                <Link
                  href={cta.href}
                  className="inline-flex items-center text-sm font-semibold text-brand hover:underline"
                >
                  {cta.label}
                </Link>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Terms anchor */}
      <section id="terms" className="border-y border-slate-100 bg-slate-50">
        <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-12">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Условия использования
          </h2>
          <p className="mb-5 leading-relaxed text-slate-600">
            Используя {getSiteDisplayName()}, вы соглашаетесь с офертой и политикой конфиденциальности.
            Юридически обязательный текст — публичная оферта.
          </p>
          <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Мы являемся технологической платформой — посредником между гостями и партнёрами.</li>
            <li>Оплата идёт через платёжного партнёра; партнёру доля уходит после подтверждения заселения.</li>
            <li>Отмена и возврат — по правилам карточки объекта и политике возвратов.</li>
            <li>Запрещено размещать объекты, нарушающие законодательство страны их размещения.</li>
          </ul>
          <p className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/legal/public-offer/" className="font-semibold text-brand hover:underline">
              Публичная оферта →
            </Link>
            <Link href="/legal/refund/" className="font-semibold text-brand hover:underline">
              Политика возвратов →
            </Link>
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="container mx-auto max-w-3xl px-4 py-10 text-center sm:py-14">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-hover text-white shadow-brand-icon">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Связаться с нами
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-slate-600">
          Не нашли ответ? Напишите на почту — живые люди из команды, в рабочие часы обычно в течение нескольких часов.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="px-7 text-sm font-semibold">
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-7 text-sm font-semibold">
            <Link href="/listings">Вернуться к поиску</Link>
          </Button>
        </div>
        <LegalPublisherNote className="mx-auto mt-8 max-w-xl" />
      </section>
    </main>
  )
}
