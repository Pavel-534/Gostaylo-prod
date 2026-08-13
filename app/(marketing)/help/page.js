import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { Shield, MessageCircle, CreditCard, MapPin, BadgeCheck, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

export const metadata = {
  title: `Центр помощи | ${getSiteDisplayName()}`,
  description: 'FAQ, инструкции для гостей и партнёров, escrow-защита и контакты поддержки.',
}

const SECTIONS = [
  {
    icon: BadgeCheck,
    title: 'Для гостей',
    items: [
      { q: 'Как забронировать объект?', a: 'Выберите даты и локацию → откройте карточку → нажмите «Забронировать». Средства удерживаются на escrow до заселения.' },
      { q: 'Когда списываются деньги?', a: 'Оплата резервируется сразу, но перечисляется хозяину только после успешного заселения.' },
      { q: 'Могу ли я отменить бронь?', a: 'Да. Условия отмены указаны в карточке объекта — обычно бесплатно за 7 дней до заезда.' },
    ],
  },
  {
    icon: Shield,
    title: 'Escrow-защита',
    items: [
      { q: 'Что такое escrow?', a: 'Это безопасный счёт: ваши средства хранятся у нас и переводятся хозяину только после подтверждения заселения.' },
      { q: 'Что если объект не соответствует?', a: 'Сообщите нам в течение 24 часов — запустим расследование и вернём деньги при подтверждённых нарушениях.' },
    ],
    cta: { href: '/help/escrow-protection', label: 'Подробнее об escrow →' },
  },
  {
    icon: CreditCard,
    title: 'Оплата',
    items: [
      { q: 'Какие валюты поддерживаются?', a: 'THB, USD, EUR, RUB, CNY — курс автоматически пересчитывается в момент оплаты.' },
      { q: 'Есть ли комиссия?', a: 'Сервисный сбор платформы включён в итоговую цену. Скрытых комиссий нет.' },
    ],
  },
  {
    icon: MapPin,
    title: 'Для партнёров',
    items: [
      { q: 'Как разместить объект?', a: 'Перейдите в раздел «Стать партнёром» → заполните анкету → модерация обычно занимает 24 часа.' },
      { q: 'Сколько стоит?', a: 'Размещение бесплатно. Мы берём только сервисный сбор с подтверждённых бронирований.' },
    ],
    cta: { href: '/partner', label: 'Стать партнёром →' },
  },
]

export default function HelpPage() {
  const supportEmail = getPublicSupportEmail()

  return (
    <main className="min-h-screen bg-white">
      {/* Hero — top inset already from MainContent app-shell-main (fixed header) */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto max-w-4xl px-4 pt-6 pb-8 sm:pt-8 sm:pb-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            <MessageCircle className="h-3 w-3" />
            Help Center
          </p>
          <h1 className="mb-3 font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:mb-4 sm:text-4xl lg:text-5xl">
            Центр помощи {getSiteDisplayName()}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            FAQ ниже или письмо на поддержку — обычно отвечаем в течение нескольких часов
            (на этапе обкатки без обещания круглосуточного call-center).
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
              <h2 className="font-serif text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
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
          <h2 className="mb-3 font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Условия использования
          </h2>
          <p className="mb-5 leading-relaxed text-slate-600">
            Используя {getSiteDisplayName()}, вы соглашаетесь с нашими условиями сервиса и политикой
            конфиденциальности. Полная версия документа доступна по запросу в поддержку.
          </p>
          <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Мы являемся технологической платформой — посредником между гостями и владельцами.</li>
            <li>Все платежи защищены escrow и возвращаются при подтверждённых нарушениях.</li>
            <li>Персональные данные обрабатываются в соответствии с GDPR и PDPA Таиланда.</li>
            <li>Запрещено размещать объекты, нарушающие законодательство Королевства Таиланд.</li>
          </ul>
          <Link
            href="/help#contact"
            className="inline-flex items-center text-sm font-semibold text-brand hover:underline"
          >
            Запросить полную версию →
          </Link>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="container mx-auto max-w-3xl px-4 py-10 text-center sm:py-14">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-brand text-white shadow-brand-icon">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="mb-2 font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Связаться с нами
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-slate-600">
          Не нашли ответ? Напишите на почту — живые люди из команды, обычно в течение нескольких часов.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-brand-icon transition-all hover:bg-brand-hover active:scale-[0.98]"
          >
            {supportEmail}
          </a>
          <Link
            href="/listings"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-700"
          >
            Вернуться к поиску
          </Link>
        </div>
      </section>
    </main>
  )
}
