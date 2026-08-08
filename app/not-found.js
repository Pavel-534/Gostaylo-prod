/**
 * Stage 200.75 — root 404 (notFound() and unmatched routes).
 */

import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function NotFound() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)
  const brand = getSiteDisplayName()
  const title = getUIText('rootNotFound_title', lang)
  const body = getUIText('rootNotFound_body', lang)
  const home = getUIText('backToHome', lang)

  return (
    <main className="min-h-[70vh] flex items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-sm font-semibold tracking-wide text-brand">{brand}</p>
        <h1 className="mb-3 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mb-8 text-sm leading-relaxed text-slate-600">{body}</p>
        <Button asChild variant="brand" className="min-h-11 w-full sm:w-auto">
          <Link href="/">{home}</Link>
        </Button>
      </div>
    </main>
  )
}
