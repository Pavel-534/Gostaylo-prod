'use client'

import Link from 'next/link'
import { LegalDefinitionsSection } from '@/components/legal/LegalDefinitionsSection'
import { LegalDocShell, LegalTranslationDisclaimer } from '@/components/legal/legal-doc-shell'
import { useLegalDocLocale } from '@/components/legal/use-legal-doc-locale'
import { getLegalPublisherDetails } from '@/lib/config/legal-details'
import { getSiteDisplayName } from '@/lib/site-url'

const linkClass = 'font-medium text-brand-hover hover:underline'

export default function PartnerTermsLegalContent() {
  const brand = getSiteDisplayName()
  const publisher = getLegalPublisherDetails()
  const { isRu, showRussian } = useLegalDocLocale()

  if (isRu) {
    return (
      <LegalDocShell
        eyebrow="Условия для партнёров"
        title="Условия сотрудничества для партнёров (хостов) на платформе"
        lead={`Настоящий документ регулирует отношения между ${brand} (далее — «Платформа», «Оператор») и лицом, размещающим предложения об аренде или иных услугах (далее — «Партнёр», «Хост»). Подача заявки на партнёрство, размещение объявлений и использование кабинета партнёра означают согласие с настоящими условиями.`}
        introBlock={
          <>
            <strong>{brand}</strong> выступает агентом между гостем и партнёром. Средства проходят через платёжного
            партнёра; партнёру доля перечисляется после подтверждения заселения.
          </>
        }
        publisher={publisher}
      >
        <RuBody />
      </LegalDocShell>
    )
  }

  return (
    <LegalDocShell
      eyebrow="Partner terms"
      title="Partner (host) cooperation terms on the platform"
      lead={`This document governs the relationship between ${brand} (the “Platform”, “Operator”) and a person listing rental or other service offers (the “Partner”, “Host”). Applying for partnership, publishing listings, and using the partner cabinet mean acceptance of these terms.`}
      introBlock={
        <>
          <strong>{brand}</strong> acts as agent between guest and partner. Funds pass through the payment partner; the
          partner share is transferred after check-in is confirmed.
        </>
      }
      publisher={publisher}
      disclaimer={<LegalTranslationDisclaimer onShowRussian={showRussian} />}
    >
      <EnBody />
    </LegalDocShell>
  )
}

function RuBody() {
  return (
    <>
      <LegalDefinitionsSection variant="partner-terms" locale="ru" />

      <h2>2. Статус Партнёра</h2>
      <p>
        Партнёр является <strong>самостоятельным поставщиком услуги</strong> (проживание, аренда транспорта и т.п.).
        Платформа оказывает информационно-технологические и посреднические услуги: размещение предложений, приём
        заявок от гостей, передачу данных о бронировании, сопровождение расчётов через платёжных партнёров.
      </p>
      <p>
        Договор с гостем заключается <strong>между Партнёром и гостем</strong>. Оператор не подменяет Партнёра как
        исполнителя услуги. Общие правила для гостей изложены в{' '}
        <Link href="/legal/public-offer/" className={linkClass}>
          публичной оферте
        </Link>
        ; при расхождении в части обязанностей хоста приоритет имеют настоящие условия.
      </p>

      <h2>3. Регистрация, заявка и верификация (KYC)</h2>
      <ul>
        <li>Партнёр предоставляет достоверные контактные данные и сведения об опыте размещения объектов.</li>
        <li>
          Для рассмотрения заявки может потребоваться документ, удостоверяющий личность (паспорт или ID), в объёме,
          необходимом для противодействия мошенничеству и соблюдения требований платёжных партнёров.
        </li>
        <li>
          Платформа вправе отклонить заявку, запросить дополнительные сведения или приостановить доступ при
          несоответствии данных, нарушении правил или подозрении на злоупотребления.
        </li>
      </ul>

      <h2>4. Объявления и содержание</h2>
      <p>Партнёр обязуется:</p>
      <ul>
        <li>размещать только те объекты и услуги, на которые он имеет законное право;</li>
        <li>
          указывать актуальные цены, фото, правила отмены, минимальный срок бронирования и иные параметры, влияющие на
          решение гостя;
        </li>
        <li>своевременно обновлять календарь доступности и не принимать брони при фактической недоступности;</li>
        <li>не размещать материалы, нарушающие закон, права третьих лиц или правила Платформы.</li>
      </ul>
      <p>
        Платформа вправе модерировать объявления, скрывать или удалять контент, требовать исправлений без
        предварительного согласования, если это необходимо для безопасности сервиса и соблюдения закона.
      </p>

      <h2>5. Бронирования и взаимодействие с гостями</h2>
      <p>
        Партнёр своевременно рассматривает запросы на бронирование, подтверждает или отклоняет их в интерфейсе,
        обеспечивает заселение (check-in) в согласованные сроки и ведёт переписку в чате бронирования добросовестно.
      </p>
      <p>
        Условия отмены и возврата для гостя определяются правилами конкретного объявления и{' '}
        <Link href="/legal/refund/" className={linkClass}>
          политикой возвратов
        </Link>
        . Партнёр соглашается соблюдать эти правила при обработке отмен и спорных ситуаций.
      </p>

      <h2>6. Расчёты и выплаты</h2>
      <p>
        <strong>Прозрачные условия:</strong> вознаграждение Платформы и иные удержания, применимые к бронированию,
        отображаются Партнёру в интерфейсе (в том числе при предпросмотре выплаты) <strong>до</strong> завершения сделки.
        Скрытых удержаний со стороны Платформы, не отражённых в учётной системе бронирования, не предусмотрено.
      </p>
      <p>
        Сумма, подлежащая перечислению Партнёру, рассчитывается по данным подтверждённого бронирования с учётом
        применимых сборов, налоговых настроек (если включены в продукте) и курса конвертации в валюту выплаты на дату
        операции. Выплаты производятся по расписанию и реквизитам, указанным в кабинете партнёра, через подключённые
        платёжные каналы.
      </p>
      <p>
        Партнёр несёт ответственность за корректность банковских или иных реквизитов. Задержки, вызванные ошибками
        реквизитов, действиями банков или форс-мажором, не являются ненадлежащим исполнением обязанностей Платформы сверх
        разумных мер содействия.
      </p>

      <h2>7. Ответственность Партнёра за объект и услугу</h2>
      <p>
        Партнёр несёт полную ответственность за фактическое соответствие объекта описанию, безопасность, соблюдение
        местных норм (включая регистрацию гостей, если требуется законом), устранение неисправностей и претензий гостей по
        качеству услуги.
      </p>
      <p>
        Платформа может содействовать разрешению споров, но не гарантирует отсутствие претензий со стороны гостей и не
        заменяет страхование или иные меры защиты, которые Партнёр обязан обеспечить самостоятельно при необходимости.
      </p>

      <h2>8. Запрещённые действия</h2>
      <ul>
        <li>обход расчётов через Платформу («увод» гостя на оплату вне сервиса);</li>
        <li>фиктивные бронирования, накрутка отзывов, дискриминация гостей;</li>
        <li>использование сервиса для отмывания средств, мошенничества или иных противоправных целей.</li>
      </ul>

      <h2>9. Персональные данные</h2>
      <p>
        Обработка данных Партнёра и гостей регулируется{' '}
        <Link href="/legal/privacy/" className={linkClass}>
          политикой конфиденциальности
        </Link>
        . Партнёр обязуется использовать персональные данные гостей только для исполнения бронирования и в рамках
        применимого закона.
      </p>

      <h2>10. Приоритет документов (для Партнёра)</h2>
      <ol>
        <li>настоящие условия для партнёров;</li>
        <li>правила конкретного объявления и бронирования;</li>
        <li>
          <Link href="/legal/refund/" className={linkClass}>
            политика возвратов
          </Link>
          ;
        </li>
        <li>
          <Link href="/legal/public-offer/" className={linkClass}>
            публичная оферта
          </Link>{' '}
          (в части общих правил платформы);
        </li>
        <li>
          краткие{' '}
          <Link href="/terms/" className={linkClass}>
            условия использования
          </Link>{' '}
          (справочно).
        </li>
      </ol>

      <h2>11. Изменение условий</h2>
      <p>
        Платформа может обновлять настоящий документ; дата редакции указана в блоке «Оператор платформы». Существенные
        изменения доводятся через кабинет партнёра и/или e-mail. Продолжение использования сервиса после вступления
        изменений в силу означает согласие с новой редакцией, если иное не требуется применимым законом.
      </p>
    </>
  )
}

function EnBody() {
  return (
    <>
      <LegalDefinitionsSection variant="partner-terms" locale="en" />

      <h2>2. Partner status</h2>
      <p>
        The Partner is an <strong>independent service provider</strong> (stay, vehicle rental, etc.). The Platform
        provides IT and intermediary services: listing offers, accepting guest requests, passing booking data, and
        supporting settlements via payment partners.
      </p>
      <p>
        The contract with the guest is concluded <strong>between Partner and guest</strong>. The Operator does not replace
        the Partner as service performer. General guest rules are in the{' '}
        <Link href="/legal/public-offer/" className={linkClass}>
          public offer
        </Link>
        ; on conflict regarding host duties, these terms prevail.
      </p>

      <h2>3. Registration, application, and verification (KYC)</h2>
      <ul>
        <li>The Partner provides accurate contact details and listing experience information.</li>
        <li>
          Review may require an identity document (passport or ID) as needed for fraud prevention and payment-partner
          requirements.
        </li>
        <li>
          The Platform may reject an application, request more information, or suspend access for data mismatch, rule
          breaches, or suspected abuse.
        </li>
      </ul>

      <h2>4. Listings and content</h2>
      <p>The Partner must:</p>
      <ul>
        <li>list only objects and services they have a lawful right to offer;</li>
        <li>
          keep prices, photos, cancellation rules, minimum stay, and other guest-decision parameters up to date;
        </li>
        <li>update availability calendars and not accept bookings when actually unavailable;</li>
        <li>not post materials that violate law, third-party rights, or Platform rules.</li>
      </ul>
      <p>
        The Platform may moderate, hide, or remove content and require fixes without prior agreement when needed for
        service safety and legal compliance.
      </p>

      <h2>5. Bookings and guest interaction</h2>
      <p>
        The Partner promptly reviews booking requests, confirms or declines in the UI, provides check-in on agreed terms,
        and communicates in good faith in the booking chat.
      </p>
      <p>
        Guest cancellation and refunds follow the listing rules and{' '}
        <Link href="/legal/refund/" className={linkClass}>
          refund policy
        </Link>
        . The Partner agrees to follow those rules for cancellations and disputes.
      </p>

      <h2>6. Settlements and payouts</h2>
      <p>
        <strong>Transparent terms:</strong> Platform remuneration and other booking deductions are shown to the Partner
        in the UI (including payout preview) <strong>before</strong> the deal completes. Hidden Platform deductions not
        reflected in the booking ledger are not provided.
      </p>
      <p>
        The amount payable to the Partner is calculated from the confirmed booking with applicable fees, tax settings (if
        enabled), and payout FX on the operation date. Payouts follow the partner-cabinet schedule and details via
        connected payment channels.
      </p>
      <p>
        The Partner is responsible for correct bank or other details. Delays from detail errors, banks, or force majeure
        are not Platform non-performance beyond reasonable assistance.
      </p>

      <h2>7. Partner liability for object and service</h2>
      <p>
        The Partner is fully responsible for match to description, safety, local rules (including guest registration if
        required), fixing issues, and guest claims about service quality.
      </p>
      <p>
        The Platform may help resolve disputes but does not guarantee absence of guest claims and does not replace
        insurance or other protections the Partner must arrange when needed.
      </p>

      <h2>8. Prohibited actions</h2>
      <ul>
        <li>bypassing Platform settlements (taking the guest off-platform for payment);</li>
        <li>fake bookings, review manipulation, guest discrimination;</li>
        <li>using the service for money laundering, fraud, or other unlawful purposes.</li>
      </ul>

      <h2>9. Personal data</h2>
      <p>
        Processing of Partner and guest data is governed by the{' '}
        <Link href="/legal/privacy/" className={linkClass}>
          privacy policy
        </Link>
        . The Partner may use guest personal data only to perform the booking and within applicable law.
      </p>

      <h2>10. Document priority (for Partners)</h2>
      <ol>
        <li>these partner terms;</li>
        <li>specific listing and booking rules;</li>
        <li>
          <Link href="/legal/refund/" className={linkClass}>
            refund policy
          </Link>
          ;
        </li>
        <li>
          <Link href="/legal/public-offer/" className={linkClass}>
            public offer
          </Link>{' '}
          (general platform rules);
        </li>
        <li>
          short{' '}
          <Link href="/terms/" className={linkClass}>
            terms of use
          </Link>{' '}
          (informational).
        </li>
      </ol>

      <h2>11. Changes to the terms</h2>
      <p>
        The Platform may update this document; the revision date is in the “Platform operator” block. Material changes
        are communicated via the partner cabinet and/or email. Continued use after changes take effect means acceptance of
        the new revision unless applicable law requires otherwise.
      </p>
    </>
  )
}
