'use client'

import Link from 'next/link'
import { LegalDocShell, LegalTranslationDisclaimer } from '@/components/legal/legal-doc-shell'
import { useLegalDocLocale } from '@/components/legal/use-legal-doc-locale'
import { getLegalPublisherDetails } from '@/lib/config/legal-details'
import { getSiteDisplayName } from '@/lib/site-url'

const linkClass = 'font-medium text-brand-hover hover:underline'

export default function RefundLegalContent() {
  const brand = getSiteDisplayName()
  const publisher = getLegalPublisherDetails()
  const { isRu, showRussian } = useLegalDocLocale()

  if (isRu) {
    return (
      <LegalDocShell
        eyebrow="Refunds"
        title="Политика возвратов средств и отмены бронирования"
        lead={`Платформа ${brand} использует модель обеспеченного платежа («депозит безопасности»): до наступления условий, описанных ниже и в карточке предложения, средства остаются в контуре платёжной защиты и не считаются окончательно переданными Партнёру.`}
        publisher={publisher}
      >
        <RuBody />
      </LegalDocShell>
    )
  }

  return (
    <LegalDocShell
      eyebrow="Refunds"
      title="Refund and cancellation policy"
      lead={`${brand} uses a secured-payment model (“security deposit”): until the conditions below and on the listing card are met, funds stay in the payment-protection flow and are not finally released to the Partner.`}
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
      <h2>1. Термины</h2>
      <ul>
        <li>
          <strong>Обеспеченный платёж</strong> — сумма оплаты бронирования, прошедшая через платёжного провайдера и учитываемая Платформой до её распределения.
        </li>
        <li>
          <strong>Партнёр</strong> — лицо, предоставляющее проживание или иную связанную с бронированием услугу.
        </li>
        <li>
          <strong>Гость</strong> — лицо, совершившее бронирование.
        </li>
      </ul>

      <h2>2. Выпуск средств после успешного заезда (check-in)</h2>
      <p>
        После объективного наступления даты заселения и технического подтверждения успешной организации услуги без открытых блокирующих инцидентов (или согласно
        более строгому сценарию в интерфейсе бронирования) Платформа инициирует распределение обеспеченного платежа в пользу Партнёра и платёжных посредников,
        сохраняя удерживаемые согласно тарификации вознаграждения платформы, если они применимы.
      </p>

      <h2>3. Случай «услуга Партнёром не предоставлена»</h2>
      <p>
        Если по независящим от Гостя причинам <strong>Партнёр не обеспечил предоставление предмета бронирования</strong> (включая недоступность размещения в согласованные
        сроки, отказ заселении без юридически значимой причины, грубое несоответствие заявленным характеристикам, когда такое условие заявлено в правилах Платформы),
        то Гостю <strong>возвращается 100% суммы забронированного обеспеченного платежа</strong>, за исключением добровольно уплаченных Гостём «невозвратных» позиций, если они явно названы перед оплатой и разрешены применимым правом.
      </p>
      <p>Решение может потребовать краткой проверки обстоятельств (службы поддержки, доказательство отсутствия доступа, переписка в чате бронирования и т.д.).</p>

      <h2>4. Отмена бронирования Гостём</h2>
      <p>
        При добровольной отмене с инициативы Гостя применимы условия, указанные <strong>в правилах бронирования соответствующего предложения</strong>: гибкая/умеренная/строгая
        модель возврата, дедлайны до заселения, удерживаемые сервисные сборы платформы, если они доведены до сведения Гостя до платежа. При расхождениях приоритет
        имеют явные правила карточки конкретного предложения, затем — общие условия сервиса.
      </p>

      <h2>5. Отмена или перенос с инициативой Платформы вследствие форс-мажора</h2>
      <p>
        Недоступность инфраструктуры платёжной системы или иные технические ограничения посредников могут влекть задержки зачисления; претензии по срокам фактической
        готовности суммы не притязают напрямую к Платформе сверх сроков платёжного провайдера, однако поддержка приложит усилия к ускорению решения инцидента.
      </p>

      <h2>6. Споры между Гостём и Партнёром</h2>
      <p>При частичном оказании или спорном кейсе возможны индивидуальное рассмотрение и промежуточные решения (частичный возврат) с учётом доказательств сторон.</p>

      <h2>7. Способ возврата</h2>
      <p>
        Возврат осуществляется на источник списания (карту/метод платежа Гостя) либо иным техническим способом, предусмотренным платёжным провайдером. Сроки зачисления
        могут зависеть от банков-эмитентов и класса платежа.
      </p>

      <p className="mt-12 text-sm text-slate-500">
        Подробности по роли платформы и природе агентского посредничества см. документ{' '}
        <Link href="/legal/public-offer/" className={linkClass}>
          публичной оферты
        </Link>
        .
      </p>
    </>
  )
}

function EnBody() {
  return (
    <>
      <h2>1. Terms</h2>
      <ul>
        <li>
          <strong>Secured payment</strong> — the booking payment amount processed by the payment provider and accounted
          for by the Platform until distribution.
        </li>
        <li>
          <strong>Partner</strong> — the person providing the stay or other booking-related service.
        </li>
        <li>
          <strong>Guest</strong> — the person who made the booking.
        </li>
      </ul>

      <h2>2. Release of funds after successful check-in</h2>
      <p>
        After the check-in date objectively occurs and the service is technically confirmed without open blocking
        incidents (or per a stricter booking UI scenario), the Platform initiates distribution of the secured payment to
        the Partner and payment intermediaries, retaining platform remuneration per tariff where applicable.
      </p>

      <h2>3. Partner fails to provide the service</h2>
      <p>
        If, for reasons independent of the Guest, the <strong>Partner does not provide the booked service</strong>{' '}
        (including unavailability at agreed times, refusal of check-in without a legally significant reason, or gross
        mismatch with stated characteristics when such a condition is stated in Platform rules), the Guest receives a{' '}
        <strong>100% refund of the secured booking payment</strong>, except voluntary “non-refundable” line items
        clearly named before payment and allowed by applicable law.
      </p>
      <p>
        A short review may be required (support, proof of no access, booking chat, etc.).
      </p>

      <h2>4. Guest-initiated cancellation</h2>
      <p>
        For voluntary Guest cancellation, the <strong>booking rules of that listing</strong> apply: flexible / moderate /
        strict refund models, pre-check-in deadlines, and platform service fees if disclosed before payment. On conflict,
        explicit listing-card rules prevail, then general service terms.
      </p>

      <h2>5. Platform-side cancel/reschedule due to force majeure</h2>
      <p>
        Payment-infrastructure outages or intermediary limits may delay settlement; claims about when funds become
        available do not attach to the Platform beyond the payment provider’s timelines, but support will work to speed
        resolution.
      </p>

      <h2>6. Guest–Partner disputes</h2>
      <p>
        For partial performance or disputed cases, individual review and interim outcomes (partial refund) may apply based
        on evidence from both sides.
      </p>

      <h2>7. Refund method</h2>
      <p>
        Refunds go to the original charge source (Guest card/method) or another technical method provided by the payment
        provider. Credit timing may depend on issuing banks and payment class.
      </p>

      <p className="mt-12 text-sm text-slate-500">
        For the Platform’s role as agent intermediary, see the{' '}
        <Link href="/legal/public-offer/" className={linkClass}>
          public offer
        </Link>
        .
      </p>
    </>
  )
}
