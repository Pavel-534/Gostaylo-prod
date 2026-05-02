import Link from 'next/link'
import { getSiteDisplayName } from '@/lib/site-url'

/**
 * Оболочка «Airy Premium» для статичных юр. страниц:
 * Inter через font-sans, slate-50 фон, slate-900 текст, просторные отступы.
 */
export function LegalDocShell({ eyebrow = 'Legal', title, lead, publisher, children }) {
  const brand = getSiteDisplayName()

  return (
    <main className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {eyebrow}
          {' · '}
          {brand}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{title}</h1>
        {lead ? (
          <p className="mt-6 text-lg leading-relaxed text-slate-600">{lead}</p>
        ) : null}

        <PublisherCard publisher={publisher} />

        <div className="prose prose-slate mt-12 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600">
          {children}
        </div>

        <footer className="mt-16 border-t border-slate-200 pt-10 text-sm text-slate-500">
          <p>Вопросы по документам: </p>
          <a href={`mailto:${publisher.email}`} className="mt-2 inline-block font-medium text-teal-800 hover:text-teal-900 underline-offset-4 hover:underline">
            {publisher.email}
          </a>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/legal/public-offer" className="text-teal-800 hover:underline">
              Public offer
            </Link>
            <Link href="/legal/privacy" className="text-teal-800 hover:underline">
              Privacy
            </Link>
            <Link href="/legal/refund" className="text-teal-800 hover:underline">
              Refunds
            </Link>
            <Link href="/terms" className="text-slate-600 hover:text-slate-900">
              Terms of Service
            </Link>
            <Link href="/help" className="text-slate-600 hover:text-slate-900">
              Help Center
            </Link>
          </p>
        </footer>
      </article>
    </main>
  )
}

function PublisherCard({ publisher }) {
  return (
    <div className="mt-12 rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Оператор платформы</h2>
      <dl className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-700">
        <div>
          <dt className="sr-only">Наименование</dt>
          <dd className="font-medium text-slate-900">{publisher.companyName}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">ИНН</dt>
          <dd>{publisher.inn}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">ОГРНИП</dt>
          <dd>{publisher.ogrnip}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">Адрес</dt>
          <dd>{publisher.address}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">E-mail</dt>
          <dd>
            <a href={`mailto:${publisher.email}`} className="text-teal-800 hover:underline">
              {publisher.email}
            </a>
          </dd>
        </div>
        <div className="pt-3 text-xs text-slate-500">Последнее обновление редакции: {publisher.lastUpdated}</div>
      </dl>
    </div>
  )
}
