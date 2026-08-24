'use client'

/**
 * Help center — FAQ + contact. Stage 201.31: MarketingDocChrome + RU/EN i18n.
 */

import Link from 'next/link'
import { MessageCircle, Shield, CreditCard, MapPin, BadgeCheck, Mail } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { getSiteDisplayName } from '@/lib/site-url'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'
import { LegalPublisherNote } from '@/components/legal/LegalPublisherNote'
import { MarketingDocChrome } from '@/components/marketing/MarketingDocChrome'
import { ProductFeedbackCta } from '@/components/product-feedback-cta'

const ICONS = {
  guests: BadgeCheck,
  payment: Shield,
  billing: CreditCard,
  partners: MapPin,
}

const STR = {
  ru: {
    eyebrow: 'Помощь',
    h1: (brand) => `Центр помощи ${brand}`,
    sub: 'FAQ ниже или письмо на поддержку — отвечаем в рабочие часы, обычно в течение нескольких часов.',
    sections: [
      {
        iconKey: 'guests',
        title: 'Для гостей',
        items: [
          {
            q: 'Как забронировать объект?',
            a: 'Выберите даты и локацию → откройте карточку → нажмите «Забронировать». Оплата проходит через платёжного партнёра; партнёру доля уходит после подтверждения заселения.',
          },
          {
            q: 'Когда списываются деньги?',
            a: 'Оплата резервируется сразу. Партнёру средства перечисляются только после подтверждения заселения — по правилам оферты и карточки.',
          },
          {
            q: 'Могу ли я отменить бронь?',
            a: 'Да. Условия отмены и возврата зависят от правил конкретного объекта, указанных в его карточке (согласно политике возвратов).',
          },
        ],
      },
      {
        iconKey: 'payment',
        title: 'Как устроена безопасная оплата',
        items: [
          {
            q: 'Кто удерживает деньги?',
            a: 'Средства удерживаются платёжным партнёром. Платформа не является банком и не принимает оплату «на свой эскроу-счёт».',
          },
          {
            q: 'Что если объект не соответствует?',
            a: 'Напишите в поддержку как можно скорее. Если партнёр не оказал услугу — возврат по политике возвратов и оферте; в спорных случаях нужна проверка переписки и фактов.',
          },
        ],
        cta: { href: '/help/escrow-protection', label: 'Подробнее о защите платежа →' },
      },
      {
        iconKey: 'billing',
        title: 'Оплата',
        items: [
          {
            q: 'Какие валюты поддерживаются?',
            a: 'THB, USD, EUR, RUB, CNY — курс фиксируется в момент оплаты по данным платёжного контура.',
          },
          {
            q: 'Есть ли комиссия?',
            a: 'Сервисный сбор платформы включён в итоговую цену и показывается до оплаты.',
          },
        ],
      },
      {
        iconKey: 'partners',
        title: 'Для партнёров',
        items: [
          {
            q: 'Как разместить объект?',
            a: 'Перейдите в раздел «Стать партнёром» → заполните анкету → модерация обычно занимает до одного рабочего дня.',
          },
          {
            q: 'Сколько стоит?',
            a: 'Размещение бесплатно. Мы берём сервисный сбор только с подтверждённых бронирований — он виден до оплаты.',
          },
        ],
        cta: { href: '/renter/profile?becomePartner=1', label: 'Стать партнёром →' },
      },
    ],
    termsH2: 'Условия использования',
    termsLead: (brand) =>
      `Используя ${brand}, вы соглашаетесь с офертой и политикой конфиденциальности. Юридически обязательный текст — публичная оферта.`,
    termsBullets: [
      'Мы являемся технологической платформой — посредником между гостями и партнёрами.',
      'Оплата идёт через платёжного партнёра; партнёру доля уходит после подтверждения заселения.',
      'Отмена и возврат — по правилам карточки объекта и политике возвратов.',
      'Запрещено размещать объекты, нарушающие законодательство страны их размещения.',
    ],
    offerLink: 'Публичная оферта →',
    refundLink: 'Политика возвратов →',
    contactH2: 'Связаться с нами',
    contactSub:
      'Не нашли ответ? Напишите на почту или сообщите о проблеме / идее — живые люди из команды, в рабочие часы обычно в течение нескольких часов.',
    backToSearch: 'Вернуться к поиску',
  },
  en: {
    eyebrow: 'Help',
    h1: (brand) => `${brand} Help Center`,
    sub: 'FAQ below, or email support — we reply during business hours, usually within a few hours.',
    sections: [
      {
        iconKey: 'guests',
        title: 'For guests',
        items: [
          {
            q: 'How do I book a listing?',
            a: 'Pick dates and location → open the listing → tap Book. Payment goes through the payment partner; the partner share is released after check-in is confirmed.',
          },
          {
            q: 'When is money charged?',
            a: 'Payment is reserved immediately. Funds are transferred to the partner only after check-in confirmation — per the public offer and listing rules.',
          },
          {
            q: 'Can I cancel a booking?',
            a: 'Yes. Cancellation and refunds follow the rules on that listing’s card (and the refund policy).',
          },
        ],
      },
      {
        iconKey: 'payment',
        title: 'How protected payment works',
        items: [
          {
            q: 'Who holds the money?',
            a: 'Funds are held by the payment partner. The platform is not a bank and does not take payment onto its own “escrow account”.',
          },
          {
            q: 'What if the listing does not match?',
            a: 'Contact support as soon as possible. If the partner did not deliver the service — refunds follow the refund policy and offer; disputed cases need a review of chat and facts.',
          },
        ],
        cta: { href: '/help/escrow-protection', label: 'More about payment protection →' },
      },
      {
        iconKey: 'billing',
        title: 'Payments',
        items: [
          {
            q: 'Which currencies are supported?',
            a: 'THB, USD, EUR, RUB, CNY — the rate is fixed at payment time from the payment rails.',
          },
          {
            q: 'Is there a fee?',
            a: 'The platform service fee is included in the total price and shown before you pay.',
          },
        ],
      },
      {
        iconKey: 'partners',
        title: 'For partners',
        items: [
          {
            q: 'How do I list a property?',
            a: 'Go to Become a partner → fill in the form → moderation usually takes up to one business day.',
          },
          {
            q: 'What does it cost?',
            a: 'Listing is free. We take a service fee only on confirmed bookings — shown before payment.',
          },
        ],
        cta: { href: '/renter/profile?becomePartner=1', label: 'Become a partner →' },
      },
    ],
    termsH2: 'Terms of use',
    termsLead: (brand) =>
      `By using ${brand}, you agree to the public offer and privacy policy. The legally binding text is the public offer.`,
    termsBullets: [
      'We are a technology platform — an intermediary between guests and partners.',
      'Payment goes through the payment partner; the partner share is released after check-in confirmation.',
      'Cancellation and refunds follow the listing card and the refund policy.',
      'Listings that violate the laws of the country where they are placed are prohibited.',
    ],
    offerLink: 'Public offer →',
    refundLink: 'Refund policy →',
    contactH2: 'Contact us',
    contactSub:
      'Didn’t find an answer? Email us or report a problem / idea — real people from the team, usually within a few hours during business hours.',
    backToSearch: 'Back to search',
  },
}

export default function HelpContent() {
  const { language } = useI18n()
  const brand = getSiteDisplayName()
  const s = language === 'ru' ? STR.ru : STR.en
  const supportEmail = getPublicSupportEmail()

  return (
    <MarketingDocChrome
      unwrapped
      eyebrow={
        <>
          <MessageCircle className="h-3 w-3" aria-hidden />
          {s.eyebrow} · {brand}
        </>
      }
      title={s.h1(brand)}
      lead={s.sub}
    >
      <section id="top" className="container mx-auto max-w-4xl space-y-8 px-4 py-10 sm:space-y-10 sm:py-12">
        {s.sections.map(({ iconKey, title, items, cta }) => {
          const Icon = ICONS[iconKey] || BadgeCheck
          return (
            <div key={title}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
              </div>
              <div
                className={cn(
                  MOBILE_FLAT_CARD_CLASS,
                  'divide-y divide-slate-100 max-sm:border-b max-sm:border-t max-sm:border-slate-100',
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
              {cta ? (
                <div className="mt-3">
                  <Link
                    href={cta.href}
                    className="inline-flex items-center text-sm font-semibold text-brand-hover hover:underline"
                  >
                    {cta.label}
                  </Link>
                </div>
              ) : null}
            </div>
          )
        })}
      </section>

      <section id="terms" className="border-y border-slate-100 bg-slate-50">
        <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-12">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {s.termsH2}
          </h2>
          <p className="mb-5 leading-relaxed text-slate-600">{s.termsLead(brand)}</p>
          <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {s.termsBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/legal/public-offer/" className="font-semibold text-brand-hover hover:underline">
              {s.offerLink}
            </Link>
            <Link href="/legal/refund/" className="font-semibold text-brand-hover hover:underline">
              {s.refundLink}
            </Link>
          </p>
        </div>
      </section>

      <section id="contact" className="container mx-auto max-w-3xl px-4 py-10 text-center sm:py-14">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-hover text-white shadow-brand-icon">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {s.contactH2}
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-slate-600">{s.contactSub}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild variant="brand" size="lg" className="px-7 text-sm font-semibold">
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </Button>
          <ProductFeedbackCta language={language === 'en' ? 'en' : 'ru'} variant="button" />
          <Button asChild variant="outline" size="lg" className="px-7 text-sm font-semibold">
            <Link href="/listings">{s.backToSearch}</Link>
          </Button>
        </div>
        <LegalPublisherNote className="mx-auto mt-8 max-w-xl" />
      </section>
    </MarketingDocChrome>
  )
}
