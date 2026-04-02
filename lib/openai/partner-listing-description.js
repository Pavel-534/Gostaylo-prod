/**
 * Генерация описания и SEO для карточки партнёра (GoStayLo).
 * Модель: gpt-4o по умолчанию; ленивый риелтор в Telegram использует gpt-4o-mini для парсинга.
 */

export const PARTNER_LISTING_DESCRIPTION_MODEL =
  process.env.OPENAI_LISTING_DESCRIPTION_MODEL?.trim() || 'gpt-4o'

const SYSTEM = `You are a senior copywriter for GoStayLo (Phuket rentals marketplace).
Return ONLY valid JSON with this exact shape (no markdown fences):
{
  "ru": {
    "body": "string — full listing description in Russian",
    "seoTitle": "string — ≤58 chars, no site name suffix",
    "seoDescription": "string — 140–158 chars"
  },
  "en": {
    "body": "string — full listing description in English",
    "seoTitle": "string — ≤58 chars",
    "seoDescription": "string — 140–158 chars"
  }
}

Rules for each "body" (same structure in both languages):
1) One short introductory paragraph (2–3 sentences).
2) Then a line \"Преимущества:\" / \"Highlights:\" followed by 3–4 bullet lines starting with \"• \" (real bullets, each one sentence).
3) Then a section header \"Район\" / \"Neighborhood\" and one paragraph about the area (district, beaches, infrastructure) — realistic, no invented distances.
Do not invent amenities or facts not implied by the input. Plain text only inside JSON strings (use \\n for newlines).`

/**
 * @param {object} input
 * @param {string} input.title
 * @param {string} [input.district]
 * @param {string} [input.categorySlug]
 * @param {number|string} [input.basePriceThb]
 * @param {Record<string, unknown>} [input.metadata]
 * @param {string} [input.existingDescription]
 * @param {string} apiKey
 * @returns {Promise<{ ru: { body: string, seoTitle: string, seoDescription: string }, en: { body: string, seoTitle: string, seoDescription: string } }>}
 */
export async function generatePartnerListingDescriptionBilingual(input, apiKey) {
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

  const userContent = `Listing facts (JSON):\n${JSON.stringify(facts, null, 2)}\n\nWrite both RU and EN as specified.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PARTNER_LISTING_DESCRIPTION_MODEL,
      temperature: 0.65,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
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

  const ru = parsed?.ru
  const en = parsed?.en
  if (
    !ru?.body ||
    !en?.body ||
    typeof ru.seoTitle !== 'string' ||
    typeof en.seoTitle !== 'string' ||
    typeof ru.seoDescription !== 'string' ||
    typeof en.seoDescription !== 'string'
  ) {
    throw new Error('OpenAI JSON missing ru/en fields')
  }

  return {
    ru: {
      body: String(ru.body).trim(),
      seoTitle: String(ru.seoTitle).trim().slice(0, 70),
      seoDescription: String(ru.seoDescription).trim().slice(0, 200),
    },
    en: {
      body: String(en.body).trim(),
      seoTitle: String(en.seoTitle).trim().slice(0, 70),
      seoDescription: String(en.seoDescription).trim().slice(0, 200),
    },
  }
}
