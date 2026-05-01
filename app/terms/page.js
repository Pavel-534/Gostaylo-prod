import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'
import { ScrollText, Mail } from 'lucide-react'

export const metadata = {
  title: `Условия использования | ${getSiteDisplayName()}`,
  description:
    'Условия использования платформы GoStaylo: правила сервиса, политика отмен, защита escrow, обработка персональных данных.',
}

const SECTIONS = [
  {
    n: '01',
    title: 'Платформа и роли',
    body: [
      `${getSiteDisplayName()} — технологическая платформа, объединяющая владельцев объектов аренды и гостей. Мы выступаем посредником и не являемся стороной договора аренды между ними.`,
      'Платформа доступна арендаторам (Гостям) и арендодателям (Партнёрам). Каждой роли соответствует свой набор прав и обязанностей, описанных в полной версии Соглашения.',
    ],
  },
  {
    n: '02',
    title: 'Бронирование и оплата',
    body: [
      'Все цены отображаются с учётом сервисного сбора платформы. Скрытых комиссий нет.',
      'Оплата резервируется на escrow-счёте платформы и переводится Партнёру только после успешного заселения Гостя.',
      'Курс конвертации валют (THB / USD / EUR / RUB / CNY) фиксируется в момент оплаты по данным внешнего поставщика котировок.',
    ],
  },
  {
    n: '03',
    title: 'Escrow-защита',
    body: [
      'Средства Гостя удерживаются на счёте платформы до подтверждения заселения. Это страхует обе стороны от мошенничества.',
      'При подтверждённых нарушениях со стороны Партнёра (несоответствие объекта, отсутствие доступа) Гостю возвращается полная стоимость аренды в течение 14 рабочих дней.',
    ],
  },
  {
    n: '04',
    title: 'Отмена бронирования',
    body: [
      'Условия отмены указываются в карточке каждого объекта. Стандартная политика — бесплатная отмена за 7 дней до заезда.',
      'При отмене Партнёром по причинам, не зависящим от Гостя, оплата возвращается в полном объёме.',
    ],
  },
  {
    n: '05',
    title: 'Персональные данные',
    body: [
      'Мы обрабатываем персональные данные в соответствии с GDPR и PDPA Королевства Таиланд.',
      'Cookies используются для аутентификации, поддержки сессий, аналитики и персонализации поиска. Управлять можно в настройках браузера.',
    ],
  },
  {
    n: '06',
    title: 'Запрещённый контент',
    body: [
      'Запрещено размещать объекты, нарушающие законодательство Королевства Таиланд, а также использовать платформу для отмывания средств, мошенничества или дискриминации.',
      'Мы оставляем за собой право блокировать аккаунты и объекты при выявлении нарушений.',
    ],
  },
  {
    n: '07',
    title: 'Изменения условий',
    body: [
      'Платформа может обновлять данные условия. Существенные изменения уведомляются заранее по email и в личном кабинете.',
      'Продолжая пользоваться сервисом после вступления изменений в силу, вы соглашаетесь с новой редакцией.',
    ],
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto px-4 pt-24 sm:pt-28 pb-14 sm:pb-16 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            <ScrollText className="h-3 w-3" />
            Legal · {getSiteDisplayName()}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-5">
            Условия использования
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
            Краткая редакция в стиле «Premium Air». Полная версия Пользовательского Соглашения
            доступна по запросу в поддержку.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
            Действует с 1 февраля 2026
          </p>
        </div>
      </section>

      {/* Sections */}
      <section className="container mx-auto px-4 py-14 sm:py-20 max-w-4xl">
        <div className="space-y-10 sm:space-y-12">
          {SECTIONS.map(({ n, title, body }) => (
            <article
              key={n}
              data-testid={`terms-section-${n}`}
              className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-3 sm:gap-8"
            >
              <div>
                <span className="font-serif text-3xl sm:text-4xl font-semibold text-teal-600/80 tracking-tight">
                  {n}
                </span>
              </div>
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-3">
                  {title}
                </h2>
                <div className="space-y-3 text-slate-600 leading-relaxed text-base sm:text-[17px]">
                  {body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 py-14 sm:py-16 max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-[#006666] text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)]">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
            Нужна полная версия?
          </h2>
          <p className="text-slate-600 mb-7 max-w-xl mx-auto">
            Запросите развёрнутый PDF или задайте вопрос по любому пункту — мы отвечаем на 4 языках.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:legal@gostaylo.com"
              className="inline-flex items-center justify-center rounded-2xl bg-[#006666] px-7 py-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)] transition-all hover:bg-[#005555] active:scale-[0.98]"
            >
              legal@gostaylo.com
            </a>
            <Link
              href="/help"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-700"
            >
              Центр помощи
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
