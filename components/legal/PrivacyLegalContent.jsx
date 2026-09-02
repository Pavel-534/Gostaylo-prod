'use client'

import { LegalDocShell, LegalTranslationDisclaimer } from '@/components/legal/legal-doc-shell'
import { useLegalDocLocale } from '@/components/legal/use-legal-doc-locale'
import { getLegalPublisherDetails } from '@/lib/config/legal-details'
import { getSiteDisplayName } from '@/lib/site-url'

export default function PrivacyLegalContent() {
  const brand = getSiteDisplayName()
  const publisher = getLegalPublisherDetails()
  const supportEmail = publisher.email
  const { isRu, showRussian } = useLegalDocLocale()

  if (isRu) {
    return (
      <LegalDocShell
        eyebrow="Privacy Policy"
        title="Политика в отношении обработки персональных данных"
        lead={`Документ описывает порядок сбора, хранения и использования информации пользователей платформы ${brand} в соответствии с Федеральным законом РФ № 152-ФЗ «О персональных данных». Для пользователей из ЕС дополнительно применяются требования GDPR.`}
        publisher={publisher}
      >
        <RuBody supportEmail={supportEmail} />
      </LegalDocShell>
    )
  }

  return (
    <LegalDocShell
      eyebrow="Privacy Policy"
      title="Personal data processing policy"
      lead={`This document describes how ${brand} collects, stores, and uses user information under Russian Federal Law No. 152-FZ “On Personal Data”. For users in the EU, GDPR requirements also apply.`}
      publisher={publisher}
      disclaimer={<LegalTranslationDisclaimer onShowRussian={showRussian} />}
    >
      <EnBody supportEmail={supportEmail} />
    </LegalDocShell>
  )
}

function RuBody({ supportEmail }) {
  return (
    <>
      <h2>1. Общие положения и контакт по вопросам данных</h2>
      <p>
        Контролёр/оператор в той юридической роли, которая применима в конкретной обработке, — Интернет-сервис, реквизиты которого приведены в блоке выше (
        «Оператор платформы»). По вопросам персональных данных вы можете связаться по адресу электронной почты{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
      <p>
        Если вы находитесь в ЕЭЗ или Великобритании, дополнительно применима логика GDPR: законность и прозрачность обработки, минимизация данных, ограничение цели,
        точность и ограничение хранения, целостность и конфиденциальность, подотчётность.
      </p>

      <h2>2. Категории данных</h2>
      <p>В зависимости от вашей роли (Гость, Партнёр, незарегистрированный посетитель) могут обрабатываться, в том числе:</p>
      <ul>
        <li>идентификационные и контактные данные (ФИО, телефон, e-mail);</li>
        <li>учётные данные (идентификатор учётной записи, тех. логи входа при наличии);</li>
        <li>
          платёжные метаданные (статусы платежей, суммы и валютные корзины через платёжного провайдера; как правило без хранения полного номера банковской карты —
          см. условия выбранного процессингового сервиса);
        </li>
        <li>данные бронирования (даты, состав гостевой партии там, где применимо);</li>
        <li>сообщения в чатах поддержки и уведомлений;</li>
        <li>технические данные устройства (IP, cookie и аналитические события в объёме, необходимом для безопасности и отладки).</li>
      </ul>

      <h2>3. Цели обработки и правовые основания</h2>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 pr-4 font-semibold text-slate-900">Цель</th>
              <th className="py-3 font-semibold text-slate-900">Пример правового основания (GDPR / 152-ФЗ)</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Предоставление функций Платформы и исполнение договора с пользователем</td>
              <td className="py-3 align-top">Ст. 6(1)(b) GDPR; ст. 6 152-ФЗ при обработке по согласию субъекта либо иных оснований закона применимой редакции</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Платежи и рассмотрение оспариваний (chargebacks)</td>
              <td className="py-3 align-top">Ст. 6(1)(b)/(f); требование закона о противодействии отмыванию при необходимости</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Безопасность сервиса и предотвращение мошенничества</td>
              <td className="py-3 align-top">Ст. 6(1)(f); защита жизненно важных интересов — при наличии сценариев экстренного реагирования</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Отправка служебных и информационных уведомлений</td>
              <td className="py-3 align-top">Ст. 6(1)(b); при маркетинге дополнительно согласие ст. 6(1)(a)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>4. Срок хранения</h2>
      <p>
        Данные хранятся не дольше, чем необходимо для целей их обработки, если более длинный период не предусмотрен законом (напр., налоговая/претензионная давность для
        метаданных платежей, акты платёжного провайдера). По истечении сроков данные блокируются, обезличиваются или уничтожаются применимым способом.
      </p>

      <h2>5. Передачи третьим лицам</h2>
      <p>
        Данные могут быть переданы: хостинг- и SaaS-провайдерам, платёжным посредникам (в том числе банковским и небанковским), провайдеру авторизации при его
        использовании; при трансграничной передаче применимы Стандартные договорные положения (SCC), решения о надлежащем уровне защиты и иные локальные требования.
      </p>

      <h2>6. Cookie и локальное хранилище</h2>
      <p>
        Применяются cookie и смежные технологии для аутентификации работы приложения и аналитики. Вы можете ограничить cookie в браузере; часть функций при этом может
        стать недоступной.
      </p>

      <h2>7. Права субъектов данных</h2>
      <p>
        В рамках применимого права вы можете запросить доступ, исправление, удаление ограниченного объёма данных, ограничение или возражение против обработки, переносимость там, где применимо, а также подать жалобу в надзорный орган (ДПК при GDPR; Роскомнадзор для субъектов РФ там, где открыта компетенция).
      </p>

      <h2>8. Обновление политики</h2>
      <p>Дата редакции указана выше в реквизитном блоке. Материальные изменения могут быть доведены до вас средствами, доступными через учётную запись и используемый e-mail.</p>
    </>
  )
}

function EnBody({ supportEmail }) {
  return (
    <>
      <h2>1. General provisions and data contact</h2>
      <p>
        The controller/operator in the legal role applicable to a given processing is the internet service whose details
        appear above (“Platform operator”). For personal-data questions contact{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
      <p>
        If you are in the EEA or UK, GDPR principles also apply: lawfulness and transparency, data minimisation, purpose
        limitation, accuracy and storage limitation, integrity and confidentiality, and accountability.
      </p>

      <h2>2. Categories of data</h2>
      <p>Depending on your role (Guest, Partner, unregistered visitor), we may process, among other things:</p>
      <ul>
        <li>identity and contact data (name, phone, email);</li>
        <li>account data (account id, technical login logs where available);</li>
        <li>
          payment metadata (payment statuses, amounts and currency baskets via the payment provider; typically without
          storing full card numbers — see the chosen processor’s terms);
        </li>
        <li>booking data (dates, guest party where applicable);</li>
        <li>support chat and notification messages;</li>
        <li>device technical data (IP, cookies and analytics events as needed for security and debugging).</li>
      </ul>

      <h2>3. Purposes and legal bases</h2>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 pr-4 font-semibold text-slate-900">Purpose</th>
              <th className="py-3 font-semibold text-slate-900">Example legal basis (GDPR / 152-FZ)</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Providing Platform features and performing the user contract</td>
              <td className="py-3 align-top">Art. 6(1)(b) GDPR; Art. 6 152-FZ where processing is based on consent or other statutory grounds</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Payments and chargeback handling</td>
              <td className="py-3 align-top">Art. 6(1)(b)/(f); AML legal requirements where applicable</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Service security and fraud prevention</td>
              <td className="py-3 align-top">Art. 6(1)(f); vital interests where emergency scenarios apply</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4 align-top">Service and informational notices</td>
              <td className="py-3 align-top">Art. 6(1)(b); for marketing, additionally consent Art. 6(1)(a)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>4. Retention</h2>
      <p>
        Data is kept no longer than needed for processing purposes unless a longer period is required by law (e.g. tax or
        claims limitation for payment metadata, payment-provider records). After expiry, data is blocked, anonymised, or
        deleted by applicable means.
      </p>

      <h2>5. Transfers to third parties</h2>
      <p>
        Data may be shared with hosting and SaaS providers, payment intermediaries (bank and non-bank), and an auth
        provider where used; for cross-border transfers, SCCs, adequacy decisions, and local requirements may apply.
      </p>

      <h2>6. Cookies and local storage</h2>
      <p>
        Cookies and related technologies support app authentication and analytics. You may limit cookies in the browser;
        some features may then be unavailable.
      </p>

      <h2>7. Data-subject rights</h2>
      <p>
        Under applicable law you may request access, rectification, erasure of a limited set of data, restriction or
        objection, portability where applicable, and lodge a complaint with a supervisory authority (DPA under GDPR;
        Roskomnadzor for Russian data subjects where competent).
      </p>

      <h2>8. Policy updates</h2>
      <p>
        The revision date is in the operator block above. Material changes may be communicated via your account and email.
      </p>
    </>
  )
}
