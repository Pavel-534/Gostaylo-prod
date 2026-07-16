import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { Shield, MessageCircle, CreditCard, MapPin, BadgeCheck, Mail } from 'lucide-react'

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
      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto px-4 pt-24 sm:pt-28 pb-14 sm:pb-16 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            <MessageCircle className="h-3 w-3" />
            Help Center
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-5">
            Мы на связи —<br />
            <span className="text-brand">24 / 7, на 4 языках.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
            Найдите ответ ниже или напишите в поддержку — отвечаем в среднем за 12 минут.
          </p>
        </div>
      </section>

      {/* FAQ sections */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-4xl space-y-14">
        {SECTIONS.map(({ icon: Icon, title, items, cta }) => (
          <div key={title}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            </div>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {items.map(({ q, a }) => (
                <details
                  key={q}
                  className="group px-5 sm:px-6 py-4 sm:py-5 transition-colors [&_summary::-webkit-details-marker]:hidden hover:bg-slate-50/50"
                >
                  <summary className="flex cursor-pointer items-start justify-between gap-4 list-none">
                    <span className="text-base sm:text-lg font-semibold text-slate-900">{q}</span>
                    <span className="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-45 text-xl leading-none">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
            {cta && (
              <div className="mt-4">
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
      <section id="terms" className="bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 py-14 sm:py-16 max-w-3xl">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-4">
            Условия использования
          </h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            Используя {getSiteDisplayName()}, вы соглашаетесь с нашими условиями сервиса и политикой
            конфиденциальности. Полная версия документа доступна по запросу в поддержку.
          </p>
          <ul className="space-y-3 text-sm text-slate-600 list-disc pl-5 mb-6">
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
      <section id="contact" className="container mx-auto px-4 py-16 sm:py-20 max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-brand text-white shadow-brand-icon">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
          Связаться с нами
        </h2>
        <p className="text-slate-600 mb-8 max-w-xl mx-auto">
          Не нашли ответ? Напишите — реальные люди, не боты.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center justify-center rounded-2xl bg-brand px-7 py-4 text-sm font-semibold text-white shadow-brand-icon transition-all hover:bg-brand-hover active:scale-[0.98]"
          >
            {supportEmail}
          </a>
          <Link
            href="/listings"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-700"
          >
            Вернуться к поиску
          </Link>
        </div>
      </section>
    </main>
  )
}
