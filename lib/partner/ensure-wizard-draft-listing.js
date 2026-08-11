/**
 * Create a real listings row before photo upload (Stage 96.0).
 * Stage 200.20 — also triggered right after category select (draft-after-category).
 * Stage 200.86 — no fake 100 THB seed; currency from country when known; price may be 0.
 * Upload authZ requires an existing listing id in storage path prefix.
 */

import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency.js'

/**
 * Whether the wizard should POST a new draft row.
 * @param {{ existingListingId?: string | null, categoryId?: string | null }} params
 */
export function shouldCreateWizardDraftOnCategory({ existingListingId, categoryId } = {}) {
  const cat = String(categoryId || '').trim()
  const existing = String(existingListingId || '').trim()
  return Boolean(cat) && !existing
}

/**
 * @param {{ partnerId: string, formData: object, draftTitleFallback?: string }} params
 * @returns {Promise<string>} listing id
 */
export async function ensureWizardDraftListing({ partnerId, formData, draftTitleFallback = 'Draft listing' }) {
  const categoryId = formData?.categoryId
  if (!categoryId) {
    throw new Error('CATEGORY_REQUIRED')
  }
  const title = String(formData?.title || '').trim() || draftTitleFallback
  const res = await fetch('/api/v2/partner/listings', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerId,
      categoryId,
      title,
      description: formData?.description || '',
      country: formData?.country,
      region: formData?.region,
      city: formData?.city,
      district: formData?.district || '',
      latitude: formData?.latitude ?? null,
      longitude: formData?.longitude ?? null,
      basePriceThb: (() => {
        const n = parseFloat(String(formData?.basePriceThb ?? '').replace(',', '.'))
        return Number.isFinite(n) && n >= 0 ? n : 0
      })(),
      baseCurrency:
        formData?.baseCurrency ||
        (formData?.country ? getDefaultListingBaseCurrency(formData.country) : undefined) ||
        'USD',
      images: [],
      metadata: {
        ...(formData?.metadata && typeof formData.metadata === 'object' ? formData.metadata : {}),
        is_draft: true,
        wizard_upload: true,
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success || !data?.data?.id) {
    throw new Error(data?.error || `Draft create failed (${res.status})`)
  }
  return String(data.data.id)
}
