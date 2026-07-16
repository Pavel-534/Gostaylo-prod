/**
 * Stage 140.1 — wizard draft autosave (create mode only).
 *
 * SSOT for the listing-creation draft persisted in localStorage so a host can
 * close the tab mid-way and resume later. Edit mode never uses this store — its
 * source of truth is the server (`loadExistingListing`).
 */
import { getDefaultWizardFormData } from '@/app/(partner)/partner/listings/new/wizard-constants'

export const WIZARD_DRAFT_KEY = 'gostaylo_wizard_draft'
const WIZARD_DRAFT_VERSION = 1
const WIZARD_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Did the host enter meaningful content? Auto-filled fields (commission, base
 * currency, geo defaults) are intentionally ignored to avoid false "dirty".
 * @param {object} formData
 * @returns {boolean}
 */
export function isWizardFormDirty(formData) {
  if (!formData || typeof formData !== 'object') return false
  const meta = formData.metadata && typeof formData.metadata === 'object' ? formData.metadata : {}
  return Boolean(
    String(formData.title || '').trim() !== '' ||
      String(formData.description || '').trim() !== '' ||
      String(formData.basePriceThb || '').trim() !== '' ||
      (Array.isArray(formData.images) && formData.images.length > 0) ||
      !!formData.categoryId ||
      String(formData.listingServiceType || '') !== '' ||
      String(formData.district || '').trim() !== '' ||
      formData.latitude != null ||
      formData.longitude != null ||
      (Array.isArray(meta.amenities) && meta.amenities.length > 0) ||
      (Array.isArray(formData.seasonalPricing) && formData.seasonalPricing.length > 0),
  )
}

/**
 * Stage 140.2 — stable signature of host-meaningful fields for edit-mode dirty
 * detection (compared against the server baseline). Auto-managed fields
 * (commissionRate, baseCurrency, timestamps) are excluded so background hydration
 * never produces a false "unsaved changes" warning.
 * @param {object} formData
 * @returns {string}
 */
export function wizardCompareKey(formData) {
  if (!formData || typeof formData !== 'object') return ''
  const meta = formData.metadata && typeof formData.metadata === 'object' ? formData.metadata : {}
  const snapshot = {
    title: String(formData.title || '').trim(),
    description: String(formData.description || '').trim(),
    basePriceThb: String(formData.basePriceThb ?? '').trim(),
    categoryId: formData.categoryId || '',
    listingServiceType: String(formData.listingServiceType || ''),
    district: String(formData.district || '').trim(),
    latitude: formData.latitude ?? null,
    longitude: formData.longitude ?? null,
    images: Array.isArray(formData.images) ? formData.images : [],
    amenities: Array.isArray(meta.amenities) ? meta.amenities : [],
    specs: meta.specs && typeof meta.specs === 'object' ? meta.specs : {},
    seasonalPricing: Array.isArray(formData.seasonalPricing) ? formData.seasonalPricing : [],
    cancellationPolicy: formData.cancellationPolicy || '',
    minBookingDays: formData.minBookingDays ?? null,
    maxBookingDays: formData.maxBookingDays ?? null,
  }
  try {
    return JSON.stringify(snapshot)
  } catch {
    return ''
  }
}

/** Persist the current draft (no-op when not dirty or SSR). */
export function saveWizardDraft(formData, currentStep = 1) {
  if (typeof window === 'undefined') return
  try {
    if (!isWizardFormDirty(formData)) return
    const envelope = {
      v: WIZARD_DRAFT_VERSION,
      savedAt: Date.now(),
      currentStep: Number(currentStep) || 1,
      formData,
    }
    localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(envelope))
  } catch {
    /* quota / serialization — ignore */
  }
}

/**
 * Read a valid, non-expired, dirty draft merged onto the default shape.
 * @returns {{ formData: object, currentStep: number } | null}
 */
export function readWizardDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WIZARD_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== WIZARD_DRAFT_VERSION) return null
    if (parsed.savedAt && Date.now() - parsed.savedAt > WIZARD_DRAFT_TTL_MS) {
      clearWizardDraft()
      return null
    }
    if (!isWizardFormDirty(parsed.formData)) return null
    const base = getDefaultWizardFormData()
    const formData = {
      ...base,
      ...parsed.formData,
      metadata: {
        ...base.metadata,
        ...(parsed.formData?.metadata && typeof parsed.formData.metadata === 'object'
          ? parsed.formData.metadata
          : {}),
      },
    }
    const currentStep = Math.min(Math.max(1, Number(parsed.currentStep) || 1), 5)
    return { formData, currentStep }
  } catch {
    return null
  }
}

/** Drop the draft after publish / server-side draft save. */
export function clearWizardDraft() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(WIZARD_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}
