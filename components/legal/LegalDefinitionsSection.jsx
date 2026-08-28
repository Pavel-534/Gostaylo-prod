'use client'

import Link from 'next/link'
import { getLegalPublisherDetails } from '@/lib/config/legal-details'
import { getSiteDisplayName } from '@/lib/site-url'

const linkClass = 'font-medium text-brand-hover hover:underline'

/**
 * §1 «Термины и определения» — SSOT для /legal/public-offer/ и /legal/partner-terms/.
 * RU = binding; EN = convenience mirror (disclaimer on parent page).
 *
 * @param {'public-offer' | 'partner-terms'} variant
 * @param {'ru' | 'en'} locale
 */
export function LegalDefinitionsSection({ variant = 'public-offer', locale = 'ru' }) {
  const brand = getSiteDisplayName()
  const publisher = getLegalPublisherDetails()

  if (locale === 'en') {
    return <EnDefinitions brand={brand} publisher={publisher} variant={variant} />
  }

  return <RuDefinitions brand={brand} publisher={publisher} variant={variant} />
}

function RuDefinitions({ brand, publisher, variant }) {
  const offerClause =
    variant === 'partner-terms' ? (
      <>
        <strong>Агентский договор / Оферта</strong> — настоящий документ, регулирующий отношения между
        Платформой и Партнёром.
      </>
    ) : (
      <>
        <strong>Агентский договор / Оферта</strong> — настоящий документ, регулирующий отношения между
        Платформой и сторонами сервиса. Для гостей —{' '}
        <Link href="/legal/public-offer/" className={linkClass}>
          настоящая публичная оферта
        </Link>
        ; для партнёров —{' '}
        <Link href="/legal/partner-terms/" className={linkClass}>
          условия для партнёров (агентский договор)
        </Link>
        .
      </>
    )

  return (
    <>
      <h2>1. Термины и определения</h2>
      <p>В настоящем документе используются следующие термины:</p>
      <dl className="not-prose my-6 space-y-4 text-[15px] leading-relaxed text-slate-600">
        <div>
          <dt className="font-semibold text-slate-900">Платформа (Оператор)</dt>
          <dd className="mt-1 pl-0">
            {publisher.companyName}, предоставляющий доступ к информационной системе {brand}.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Партнёр (Хост)</dt>
          <dd className="mt-1 pl-0">
            физическое лицо, индивидуальный предприниматель или юридическое лицо, размещающее на Платформе
            предложения о сдаче жилья, транспорта или иных услуг в краткосрочную аренду.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Гость (Пользователь)</dt>
          <dd className="mt-1 pl-0">
            физическое лицо, совершающее бронирование услуг Партнёра через Платформу.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Агентский договор / Оферта</dt>
          <dd className="mt-1 pl-0">{offerClause}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Бронирование</dt>
          <dd className="mt-1 pl-0">
            оформленный через Платформу запрос Гостя на предоставление услуги Партнёром.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Агентское вознаграждение</dt>
          <dd className="mt-1 pl-0">
            комиссия Платформы за информационно-посреднические услуги; включается в стоимость бронирования
            либо отражается в разбивке платежа до оплаты.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Платёжный партнёр</dt>
          <dd className="mt-1 pl-0">
            лицензированная кредитная организация или иной уполномоченный платёжный провайдер, через
            которого осуществляется приём платежных инструментов Гостя при бронировании; Оператор не
            является платёжной системой.
          </dd>
        </div>
      </dl>
      <p>
        Иные термины используются в значениях, установленных применимым законодательством Российской
        Федерации, если из текста документа не следует иное.
      </p>
    </>
  )
}

function EnDefinitions({ brand, publisher, variant }) {
  const offerClause =
    variant === 'partner-terms' ? (
      <>
        <strong>Agency agreement / Offer</strong> — this document governing the relationship between the
        Platform and the Partner.
      </>
    ) : (
      <>
        <strong>Agency agreement / Offer</strong> — the document governing relations between the Platform
        and service parties. For guests —{' '}
        <Link href="/legal/public-offer/" className={linkClass}>
          this public offer
        </Link>
        ; for partners —{' '}
        <Link href="/legal/partner-terms/" className={linkClass}>
          partner terms (agency agreement)
        </Link>
        .
      </>
    )

  return (
    <>
      <h2>1. Terms and definitions</h2>
      <p>This document uses the following terms:</p>
      <dl className="not-prose my-6 space-y-4 text-[15px] leading-relaxed text-slate-600">
        <div>
          <dt className="font-semibold text-slate-900">Platform (Operator)</dt>
          <dd className="mt-1 pl-0">
            {publisher.companyName}, providing access to the {brand} information system.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Partner (Host)</dt>
          <dd className="mt-1 pl-0">
            an individual, sole proprietor, or legal entity listing offers for short-term rental of
            accommodation, transport, or other services on the Platform.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Guest (User)</dt>
          <dd className="mt-1 pl-0">
            an individual booking a Partner&apos;s services through the Platform.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Agency agreement / Offer</dt>
          <dd className="mt-1 pl-0">{offerClause}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Booking</dt>
          <dd className="mt-1 pl-0">
            a Guest request submitted through the Platform for a Partner to provide a service.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Agency remuneration</dt>
          <dd className="mt-1 pl-0">
            the Platform commission for information and intermediary services; included in the booking total
            or shown in the payment breakdown before payment.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Payment partner</dt>
          <dd className="mt-1 pl-0">
            a licensed credit institution or other authorised payment provider through which Guest payment
            instruments are accepted at booking; the Operator is not a payment system.
          </dd>
        </div>
      </dl>
      <p>
        Other terms are used in the meanings established by applicable laws of the Russian Federation unless
        the document text provides otherwise.
      </p>
    </>
  )
}
