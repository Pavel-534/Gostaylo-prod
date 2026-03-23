/**
 * POST /api/v2/translate — перевод текста на язык UI (сессия обязательна).
 * GOOGLE_TRANSLATE_API_KEY — приоритет; иначе MyMemory (ограниченный бесплатный лимит).
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'

export const dynamic = 'force-dynamic'

const GOOGLE_KEY = process.env.GOOGLE_TRANSLATE_API_KEY

export async function POST(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const target = typeof body.target === 'string' ? body.target.trim().slice(0, 5) : ''

  if (!text || text.length > 8000) {
    return NextResponse.json({ success: false, error: 'Invalid text' }, { status: 400 })
  }
  if (!target || !/^[a-z]{2}(-[a-z]{2})?$/i.test(target)) {
    return NextResponse.json({ success: false, error: 'Invalid target language' }, { status: 400 })
  }

  const targetLang = target.split('-')[0].toLowerCase()

  try {
    if (GOOGLE_KEY) {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(GOOGLE_KEY)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          format: 'text',
        }),
      })
      const data = await res.json()
      const translated = data?.data?.translations?.[0]?.translatedText
      if (!res.ok || !translated) {
        return NextResponse.json(
          { success: false, error: data?.error?.message || 'Google Translate failed' },
          { status: 502 }
        )
      }
      return NextResponse.json({ success: true, data: { translatedText: translated, provider: 'google' } })
    }

    const pair = `auto|${targetLang}`
    const memUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`
    const res = await fetch(memUrl, { cache: 'no-store' })
    const data = await res.json()
    const translated = data?.responseData?.translatedText
    if (!res.ok || !translated || data?.responseStatus && Number(data.responseStatus) !== 200) {
      return NextResponse.json(
        { success: false, error: 'Translation service unavailable (set GOOGLE_TRANSLATE_API_KEY for production)' },
        { status: 502 }
      )
    }
    return NextResponse.json({ success: true, data: { translatedText: translated, provider: 'mymemory' } })
  } catch (e) {
    console.error('[translate]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
