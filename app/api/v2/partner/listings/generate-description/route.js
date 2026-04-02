/**
 * POST /api/v2/partner/listings/generate-description
 * Партнёр: генерация описания RU+EN и SEO через OpenAI (gpt-4o).
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { verifyPartnerAccess } from '@/lib/services/session-service'
import { generatePartnerListingDescriptionBilingual } from '@/lib/openai/partner-listing-description'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production'

async function getPartnerFromSession() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  let decoded
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET)
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }) }
  }
  const partner = await verifyPartnerAccess(decoded.userId)
  if (!partner) {
    return { error: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }) }
  }
  return { userId: decoded.userId }
}

export async function POST(request) {
  const auth = await getPartnerFromSession()
  if (auth.error) return auth.error

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'AI description is not configured (OPENAI_API_KEY)' },
      { status: 503 },
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 3) {
    return NextResponse.json(
      { success: false, error: 'title is required (min 3 characters)' },
      { status: 400 },
    )
  }

  try {
    const out = await generatePartnerListingDescriptionBilingual(
      {
        title,
        district: typeof body.district === 'string' ? body.district.trim() : '',
        categorySlug: typeof body.categorySlug === 'string' ? body.categorySlug.trim() : '',
        basePriceThb: body.basePriceThb,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        existingDescription:
          typeof body.existingDescription === 'string' ? body.existingDescription : '',
      },
      apiKey,
    )

    return NextResponse.json({
      success: true,
      data: {
        descriptionRu: out.ru.body,
        descriptionEn: out.en.body,
        seo: {
          ru: { title: out.ru.seoTitle, description: out.ru.seoDescription },
          en: { title: out.en.seoTitle, description: out.en.seoDescription },
        },
      },
    })
  } catch (e) {
    console.error('[PARTNER-AI-DESCRIPTION]', e?.message || e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Generation failed' },
      { status: 502 },
    )
  }
}
