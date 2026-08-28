'use client'

import Link from 'next/link'
import { LegalDefinitionsSection } from '@/components/legal/LegalDefinitionsSection'
import { LegalDocShell, LegalTranslationDisclaimer } from '@/components/legal/legal-doc-shell'
import { useLegalDocLocale } from '@/components/legal/use-legal-doc-locale'
import { getLegalPublisherDetails } from '@/lib/config/legal-details'
import { getSiteDisplayName } from '@/lib/site-url'

const linkClass = 'font-medium text-brand-hover hover:underline'

export default function PublicOfferLegalContent({ avgEarnedFromStats = null }) {
  const brand = getSiteDisplayName()
  const publisher = getLegalPublisherDetails()
  const { isRu, showRussian } = useLegalDocLocale()

  if (isRu) {
    return (
      <LegalDocShell
        eyebrow="Публичная оферта"
        title="Публичная оферта об оказании информационно-технологических и посреднических услуг"
        lead={`Настоящий документ является официальным предложением (публичной офертой) ${brand} (далее — «Платформа», «Оператор») заключить договор на условиях ниже. Оплачивая бронирование или подтверждая действия в интерфейсе с отметкой о согласии, Пользователь принимает условия настоящей оферты.`}
        publisher={publisher}
      >
        <RuBody brand={brand} supportEmail={publisher.email} avgEarnedFromStats={avgEarnedFromStats} />
      </LegalDocShell>
    )
  }

  return (
    <LegalDocShell
      eyebrow="Public offer"
      title="Public offer for information technology and intermediary services"
      lead={`This document is the official public offer of ${brand} (the “Platform”, “Operator”) to enter into an agreement on the terms below. By paying for a booking or confirming consent in the interface, the User accepts this offer.`}
      publisher={publisher}
      disclaimer={<LegalTranslationDisclaimer onShowRussian={showRussian} />}
    >
      <EnBody brand={brand} supportEmail={publisher.email} avgEarnedFromStats={avgEarnedFromStats} />
    </LegalDocShell>
  )
}

function RuBody({ brand, supportEmail, avgEarnedFromStats }) {
  return (
    <>
      <LegalDefinitionsSection variant="public-offer" locale="ru" />

      <h2>2. Роли сторон</h2>
      <p>
        <strong>Платформа {brand}</strong> выступает в качестве <strong>посредника (агента)</strong> между{' '}
        <strong>Гостем</strong> (лицом, оформляющим бронирование) и <strong>Партнёром</strong> — владельцем или
        уполномоченным представителем объекта размещения либо иной услуги, размещённой на Платформе.
      </p>
      <p>
        Оператор оказывает информационно-технологические услуги: размещение предложений, приём заявок на бронирование,
        передачу данных Партнёру, сопровождение расчётов через подключённых платёжных партнёров. Оператор{' '}
        <strong>не является</strong> арендодателем, собственником объекта или непосредственным исполнителем услуги
        проживания, если иное прямо не указано в карточке конкретного предложения.
      </p>
      <p>
        Договор о предоставлении услуги (проживание, аренда транспорта и т.п.) заключается <strong>между Гостем и
        Партнёром</strong>. Оператор не подменяет стороны этого договора.
      </p>
      <p>
        Оператор <strong>не является</strong> кредитной организацией или платёжной системой; приём платежных
        инструментов осуществляется лицензированными платёжными провайдерами в порядке, предусмотренном их правилами и
        договорами с Оператором.
      </p>

      <h2>3. Предмет оферты</h2>
      <p>Предметом настоящей оферты является совокупность услуг Оператора по:</p>
      <ul>
        <li>представлению на Платформе предложений Партнёров и приёму заявок (бронирований) от Гостей;</li>
        <li>передаче Партнёру сведений о подтверждённом бронировании;</li>
        <li>
          организации и техническому сопровождению расчётов по бронированию с использованием платёжных сервисов,
          учёту сумм и отражению статусов в информационной системе Платформы до наступления условий, описанных ниже и в
          правилах конкретного предложения.
        </li>
      </ul>

      <h2>4. Платёж Гостя и обеспечение бронирования</h2>
      <p>
        Платформа {brand} выступает в качестве посредника (агента) между Гостем и Партнёром — владельцем объекта.
      </p>
      <p>
        <strong>Денежные средства</strong>, уплаченные Гостем при бронировании, <strong>направляются на исполнение
        обязательств по бронированию</strong> в порядке, определяемом правилами Платформы, карточкой предложения и
        применимым правом. Средства проходят через платёжного провайдера; учёт в системе Платформы не означает, что
        Оператор принимает денежные средства на свой расчётный счёт как кредитная организация.
      </p>
      <p>
        До наступления условий, указанных в карточке предложения и{' '}
        <Link href="/legal/refund/" className={linkClass}>
          политике возвратов
        </Link>
        , сумма рассматривается сторонами как <strong>обеспечительный платёж</strong> в интересах Гостя и Партнёра (в
        том числе для защиты от недопоставки услуги). Основным ориентиром для завершения расчётов с Партнёром является
        дата заселения (check-in) или иное объективное подтверждение оказания услуги в интерфейсе Платформы, если в
        карточке не установлен иной порядок.
      </p>
      <p>
        За качество, состав и сроки услуги отвечает <strong>Партнёр</strong>. Оператор не гарантирует свойства услуги,
        возлагаемые на Партнёра, за исключением обязанностей, прямо предусмотренных настоящей офертой и политикой
        возвратов Платформы.
      </p>

      <h2>5. Вознаграждение Платформы</h2>
      <p>
        <strong>Вознаграждение Платформы</strong> за информационно-технологические услуги, организацию процесса и
        сопровождение сделки <strong>включается в итоговую стоимость бронирования</strong> (либо отражается в разбивке
        платежа) и <strong>указывается Гостю и Партнёру до оплаты</strong>. Размер и структура вознаграждения для
        подтверждённого бронирования не изменяются задним числом.
      </p>
      <p>
        Расчёты с использованием банковских карт и иных платёжных инструментов выполняются через лицензированных
        посредников. Оператор не принимает оплату «наличными на руки» через Платформу.
      </p>

      <h2>6. Приоритет документов</h2>
      <p>При расхождении формулировок применяется следующий порядок (от большего приоритета к меньшему):</p>
      <ol>
        <li>условия и правила в <strong>карточке конкретного предложения</strong> (в том числе политика отмены);</li>
        <li>
          <Link href="/legal/refund/" className={linkClass}>
            политика возвратов и отмен
          </Link>
          ;
        </li>
        <li>настоящая публичная оферта;</li>
        <li>
          краткие{' '}
          <Link href="/terms/" className={linkClass}>
            условия использования
          </Link>{' '}
          (справочно).
        </li>
      </ol>

      <h2>7. Многоуровневая партнёрская программа</h2>
      <p>
        Платформа реализует многоуровневую партнёрскую программу (далее — «MLM»), в рамках которой участники могут
        получать вознаграждение за привлечение и активность приглашённых ими пользователей.
      </p>
      <p>
        <strong>Доход не гарантирован.</strong> Размер вознаграждения зависит от количества приглашённых, их активности
        и условий конкретной акции. Средний доход активного участника программы за последний квартал:{' '}
        <em>{avgEarnedFromStats ?? 'N/A, программа работает с 2026'}</em> (обновляется ежеквартально).
      </p>
      <p>
        Подробные условия участия, ограничения и пороги выплат изложены в условиях для партнёров, в расчётных правилах
        программы и в кабинете участника.
      </p>

      <h2>8. Ответственность и претензии</h2>
      <p>
        Ограничения ответственности Оператора, порядок рассмотрения претензий между Гостем и Партнёром, а также случаи
        возврата средств определяются политикой возвратов, правилами бронирования и применимым законодательством.
        Технические сбои платёжных провайдеров могут влиять на сроки зачисления; Оператор содействует разрешению
        инцидента в разумный срок.
      </p>
      <p>
        При возникновении вопросов или разногласий, связанных с услугами Оператора по настоящей оферте, Гость вправе
        направить претензию Оператору по адресу электронной почты{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Оператор рассматривает претензию в срок, установленный
        законодательством Российской Федерации.
      </p>
      <p>
        Оператор вправе запросить у Гостя дополнительные сведения, необходимые для рассмотрения претензии (скриншоты
        переписки с Партнёром, фото объекта, данные бронирования).
      </p>
      <p>
        В случае невозможности разрешения спора путём переговоров Гость — потребитель вправе обратиться в суд по своему
        месту жительства или по месту нахождения Оператора в соответствии с законодательством Российской Федерации.
      </p>

      <h2>9. Применимое право</h2>
      <p>
        На отношения между Гостем и Оператором, регулируемые настоящей офертой, распространяется действие
        законодательства Российской Федерации: Гражданский кодекс РФ, Федеральный закон от 07.02.1992 № 2300-1 «О защите
        прав потребителей» (далее — ЗоЗПП), Федеральный закон от 27.07.2006 № 152-ФЗ «О персональных данных» и иные
        применимые нормативные акты — в части обязанностей Оператора как посредника (агента) и провайдера
        информационно-технологических услуг. Договор о предоставлении услуги проживания (или иной услуги Партнёра)
        заключается между Гостем и Партнёром и не подменяется настоящей офертой.
      </p>
      <p>
        В части, не урегулированной настоящей офертой, стороны руководствуются положениями действующего законодательства
        РФ.
      </p>

      <h2>10. Персональные данные</h2>
      <p>
        Обработка персональных данных регламентируется{' '}
        <Link href="/legal/privacy/" className={linkClass}>
          политикой конфиденциальности
        </Link>
        .
      </p>

      <h2>11. Изменение оферты</h2>
      <p>
        Оферта может обновляться; актуальная дата редакции указана в блоке «Оператор платформы». Существенные изменения
        доводятся до пользователей через аккаунт и/или e-mail. При следующей оплате бронирования Пользователь может
        быть приглашён повторно подтвердить согласие с новой редакцией.
      </p>
    </>
  )
}

function EnBody({ brand, supportEmail, avgEarnedFromStats }) {
  return (
    <>
      <LegalDefinitionsSection variant="public-offer" locale="en" />

      <h2>2. Roles of the parties</h2>
      <p>
        <strong>Platform {brand}</strong> acts as an <strong>intermediary (agent)</strong> between the{' '}
        <strong>Guest</strong> (the person making a booking) and the <strong>Partner</strong> — the owner or authorised
        representative of the stay or other service listed on the Platform.
      </p>
      <p>
        The Operator provides information technology services: listing offers, accepting booking requests, passing data
        to the Partner, and supporting settlements via connected payment partners. The Operator is{' '}
        <strong>not</strong> the landlord, property owner, or direct provider of the stay, unless expressly stated on a
        specific listing.
      </p>
      <p>
        The contract for the service (stay, vehicle rental, etc.) is concluded <strong>between the Guest and the
        Partner</strong>. The Operator does not replace the parties to that contract.
      </p>
      <p>
        The Operator is <strong>not</strong> a credit institution or payment system; payment instruments are accepted by
        licensed payment providers under their rules and agreements with the Operator.
      </p>

      <h2>3. Subject of the offer</h2>
      <p>This offer covers the Operator’s services to:</p>
      <ul>
        <li>present Partner offers on the Platform and accept booking requests from Guests;</li>
        <li>pass confirmed booking details to the Partner;</li>
        <li>
          organise and technically support booking settlements via payment services, account for amounts, and reflect
          statuses in the Platform system until the conditions below and in the listing rules are met.
        </li>
      </ul>

      <h2>4. Guest payment and booking security</h2>
      <p>
        Platform {brand} acts as intermediary (agent) between the Guest and the Partner — the listing provider.
      </p>
      <p>
        <strong>Funds</strong> paid by the Guest at booking are <strong>applied toward performance of the
        booking</strong> under Platform rules, the listing card, and applicable law. Funds pass through a payment
        provider; accounting in the Platform system does not mean the Operator receives funds on its own account as a
        credit institution.
      </p>
      <p>
        Until the conditions in the listing card and{' '}
        <Link href="/legal/refund/" className={linkClass}>
          refund policy
        </Link>{' '}
        are met, the amount is treated as a <strong>security payment</strong> in the interests of Guest and Partner
        (including protection against non-delivery). The primary trigger for settling with the Partner is check-in date
        or other objective confirmation of service in the Platform UI, unless the listing sets another order.
      </p>
      <p>
        The <strong>Partner</strong> is responsible for quality, scope, and timing of the service. The Operator does not
        guarantee Partner-side attributes except duties expressly set in this offer and the Platform refund policy.
      </p>

      <h2>5. Platform remuneration</h2>
      <p>
        <strong>Platform remuneration</strong> for IT services, process organisation, and deal support is{' '}
        <strong>included in the booking total</strong> (or shown in the payment breakdown) and{' '}
        <strong>disclosed to Guest and Partner before payment</strong>. Size and structure for a confirmed booking are
        not changed retroactively.
      </p>
      <p>
        Card and other instrument settlements run via licensed intermediaries. The Operator does not accept cash
        “in hand” via the Platform.
      </p>

      <h2>6. Document priority</h2>
      <p>If wording conflicts, the following order applies (highest first):</p>
      <ol>
        <li>terms on the <strong>specific listing card</strong> (including cancellation policy);</li>
        <li>
          <Link href="/legal/refund/" className={linkClass}>
            refund and cancellation policy
          </Link>
          ;
        </li>
        <li>this public offer;</li>
        <li>
          short{' '}
          <Link href="/terms/" className={linkClass}>
            terms of use
          </Link>{' '}
          (informational).
        </li>
      </ol>

      <h2>7. Multi-level partner program</h2>
      <p>
        The Platform operates a multi-level partner program (“MLM”) under which participants may receive rewards for
        referring users and for those invitees’ activity.
      </p>
      <p>
        <strong>Income is not guaranteed.</strong> Reward size depends on the number of invitees, their activity, and
        the terms of a given campaign. Average earnings of an active program participant for the last quarter:{' '}
        <em>{avgEarnedFromStats ?? 'N/A, the program has been running since 2026'}</em> (updated quarterly).
      </p>
      <p>
        Detailed participation terms, limits, and payout thresholds are set out in the partner terms, the program
        calculation rules, and the participant cabinet.
      </p>

      <h2>8. Liability and claims</h2>
      <p>
        Limits of Operator liability, Guest–Partner claims, and refund cases follow the refund policy, booking rules,
        and applicable law. Payment-provider outages may affect settlement timing; the Operator assists within a
        reasonable period.
      </p>
      <p>
        If questions or disagreements arise about the Operator’s services under this offer, the Guest may send a claim
        to the Operator at{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. The Operator reviews the claim within the time limits set
        by the laws of the Russian Federation.
      </p>
      <p>
        The Operator may request additional information needed to review the claim (screenshots of correspondence with
        the Partner, photos of the object, booking details).
      </p>
      <p>
        If the dispute cannot be resolved by negotiation, a Guest who is a consumer may bring a claim in court at their
        place of residence or at the Operator’s location in accordance with the laws of the Russian Federation.
      </p>

      <h2>9. Applicable law</h2>
      <p>
        Relations between the Guest and the Operator under this offer are governed by the laws of the Russian Federation:
        the Civil Code of the RF, Federal Law No. 2300-1 of 07.02.1992 “On Protection of Consumer Rights” (ZoZPP),
        Federal Law No. 152-FZ of 27.07.2006 “On Personal Data”, and other applicable acts — insofar as they concern the
        Operator’s duties as intermediary (agent) and provider of information technology services. The contract for the
        stay (or other Partner service) is between Guest and Partner and is not replaced by this offer.
      </p>
      <p>
        Matters not covered by this offer are governed by the applicable laws of the Russian Federation.
      </p>

      <h2>10. Personal data</h2>
      <p>
        Personal data processing is governed by the{' '}
        <Link href="/legal/privacy/" className={linkClass}>
          privacy policy
        </Link>
        .
      </p>

      <h2>11. Changes to the offer</h2>
      <p>
        The offer may be updated; the current revision date is in the “Platform operator” block. Material changes are
        communicated via account and/or email. On the next booking payment the User may be asked to re-confirm the new
        revision.
      </p>
    </>
  )
}
