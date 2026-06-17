/**
 * Create a real listings row before photo upload (Stage 96.0).
 * Upload authZ requires an existing listing id in storage path prefix.
 */

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
      basePriceThb: Math.max(100, parseFloat(String(formData?.basePriceThb)) || 100),
      baseCurrency: formData?.baseCurrency || 'THB',
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
