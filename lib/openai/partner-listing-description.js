/**
 * Генерация описания и SEO для карточки партнёра, 4 локали: ru, en, zh, th.
 */

import { getSiteDisplayName } from '@/lib/site-url'

export const PARTNER_LISTING_DESCRIPTION_MODEL =
  process.env.OPENAI_LISTING_DESCRIPTION_MODEL?.trim() || 'gpt-4o'

const LOCALES = ['ru', 'en', 'zh', 'th']

function buildPartnerListingDescriptionSystem() {
  const brand = getSiteDisplayName()
  return `You are a senior copywriter for ${brand} (Phuket rentals marketplace).
Return ONLY valid JSON (no markdown fences) with exactly these top-level keys: "ru", "en", "zh", "th".
Each locale object MUST have: "body", "seoTitle", "seoDescription".

Shape:
{
  "ru": { "body": "...", "seoTitle": "≤58 chars, no brand suffix", "seoDescription": "140–158 chars" },
  "en": { "body": "...", "seoTitle": "...", "seoDescription": "..." },
  "zh": { "body": "Simplified Chinese", "seoTitle": "...", "seoDescription": "..." },
  "th": { "body": "Thai language", "seoTitle": "...", "seoDescription": "..." }
}

For each "body" (same structure in every language):
1) One short introductory paragraph (2–3 sentences).
2) Then a localized "Highlights" header line, followed by 3–4 lines starting with "• " (one sentence each).
   Use natural headers: RU "Преимущества:", EN "Highlights:", ZH "亮点：", TH "จุดเด่น:" (or equivalent).
3) Then a localized "Neighborhood / area" section header and one paragraph about the district — realistic, no invented distances.

Do not invent amenities or facts not implied by the input. Plain text in JSON strings; use \\n for newlines.`
}

function pickLocaleBlock(parsed, code) {
  const b = parsed?.[code]
  if (!b?.body || typeof b.seoTitle !== 'string' || typeof b.seoDescription !== 'string') return null
  return {
    body: String(b.body).trim(),
    seoTitle: String(b.seoTitle).trim().slice(0, 70),
    seoDescription: String(b.seoDescription).trim().slice(0, 200),
  }
}

/**
 * @param {object} input
 * @param {string} input.title
 * @param {string} [input.district]
 * @param {string} [input.categorySlug]
 * @param {number|string} [input.basePriceThb]
 * @param {Record<string, unknown>} [input.metadata]
 * @param {string} [input.existingDescription]
 * @param {string} apiKey
 * @returns {Promise<{ locales: Record<string, { body: string, seoTitle: string, seoDescription: string }>, usage: object, model: string }>}
 */
export async function generatePartnerListingDescriptionQuad(input, apiKey) {
  const model = PARTNER_LISTING_DESCRIPTION_MODEL
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const facts = {
    title: input.title,
    district: input.district || null,
    category: input.categorySlug || null,
    price_thb: input.basePriceThb ?? null,
    bedrooms: meta.bedrooms ?? null,
    bathrooms: meta.bathrooms ?? null,
    max_guests: meta.max_guests ?? null,
    area: meta.area ?? null,
    property_type: meta.property_type ?? null,
    amenities: Array.isArray(meta.amenities) ? meta.amenities.slice(0, 20) : [],
    notes: input.existingDescription?.trim() || null,
  }

  const userContent = `Listing facts (JSON):\n${JSON.stringify(facts, null, 2)}\n\nWrite all four locales (ru, en, zh, th) as specified.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildPartnerListingDescriptionSystem() },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || `OpenAI HTTP ${res.status}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty OpenAI response')
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON from OpenAI')
  }

  const locales = {}
  for (const code of LOCALES) {
    const block = pickLocaleBlock(parsed, code)
    if (!block) {
      throw new Error(`OpenAI JSON missing or invalid locale: ${code}`)
    }
    locales[code] = block
  }

  const usage = data?.usage && typeof data.usage === 'object' ? data.usage : {}
  return { locales, usage, model }
}
