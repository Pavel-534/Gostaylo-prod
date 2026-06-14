'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { fetchExchangeRates } from '@/lib/client-data'
import { WIZARD_DISTRICTS, getDefaultWizardFormData } from '../wizard-constants'
import {
  readWizardDraft,
  saveWizardDraft,
  isWizardFormDirty,
  wizardCompareKey,
} from '@/lib/partner/wizard-draft-storage'
import { ru, enUS, zhCN, th as thDateLocale } from 'date-fns/locale'

/**
 * Stage 109.3 — wizard UI state + bootstrap categories/commission.
 */
export function useListingWizardState({ initialListingId = null, wizardMode = 'create' }) {
  const searchParams = useSearchParams()
  const editId = initialListingId || searchParams.get('edit') || null
  const isEditMode = Boolean(editId)

  const { language } = useI18n()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const t = useCallback((key) => getUIText(key, language), [language])
  const tr = useCallback(
    (key, vars) => {
      let s = getUIText(key, language)
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{{${k}}}`).join(String(v))
        }
      }
      return s
    },
    [language],
  )
  const numberLocale = useMemo(
    () => ({ ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', th: 'th-TH' }[language] || 'en-US'),
    [language],
  )
  const dayPickerLocale = { ru, en: enUS, zh: zhCN, th: thDateLocale }[language] || ru

  /** Stage 140.1 — restore an autosaved draft once (create mode only). */
  const initialDraftRef = useRef(undefined)
  if (initialDraftRef.current === undefined) {
    initialDraftRef.current = !isEditMode ? readWizardDraft() : null
  }
  const initialDraft = initialDraftRef.current

  const [currentStep, setCurrentStep] = useState(() => initialDraft?.currentStep || 1)
  const [draftRestored, setDraftRestored] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverListing, setServerListing] = useState(null)
  const [listingNotFound, setListingNotFound] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [geocoding, setGeocoding] = useState(false)
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false)
  const [aiDescQuota, setAiDescQuota] = useState({ used: 0, limit: 3, remaining: 3, exhausted: false })
  const [geocodeQuery, setGeocodeQuery] = useState('')
  const [geocodeResults, setGeocodeResults] = useState([])
  const [customDistricts, setCustomDistricts] = useState([])
  const [categories, setCategories] = useState([])
  const [newSeason, setNewSeason] = useState({
    label: '',
    dateRange: { from: null, to: null },
    priceDaily: '',
    priceMonthly: '',
    seasonType: 'NORMAL',
  })
  const [partnerCommissionRate, setPartnerCommissionRate] = useState(null)
  const [pricingPolicy, setPricingPolicy] = useState({
    guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
    hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
    chatInvoiceRateMultiplier: 1.025,
  })
  const [formData, setFormData] = useState(() => initialDraft?.formData || getDefaultWizardFormData())
  /** Stage 140.2 — server baseline signature for edit-mode dirty detection. */
  const [editBaseline, setEditBaseline] = useState(null)
  /** Stage 110.4 — retail FX rateMap (как на витрине) для preview в baseCurrency листинга. */
  const [storefrontExchangeRates, setStorefrontExchangeRates] = useState(null)

  const fileInputRef = useRef(null)
  const draftListingIdRef = useRef(null)
  const ensuringDraftRef = useRef(false)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const catRes = await fetch('/api/v2/categories', { cache: 'no-store' })
        const catData = await catRes.json()
        if (catData.success) {
          const activeOnly = (catData.data || []).filter(
            (c) => c && (c.isActive === true || c.is_active === true),
          )
          setCategories(activeOnly)
        }
        fetchExchangeRates({ retail: true })
          .then(setStorefrontExchangeRates)
          .catch(() => setStorefrontExchangeRates({ THB: 1 }))

        let userId = localStorage.getItem('gostaylo_user_id')
        if (!userId) {
          const meRes = await fetch('/api/v2/auth/me', { credentials: 'include' })
          const meData = await meRes.json()
          if (meData.success && meData.user?.id) {
            userId = String(meData.user.id)
            localStorage.setItem('gostaylo_user_id', userId)
          }
        }
        if (userId) {
          const commissionRes = await fetch(`/api/v2/commission?partnerId=${userId}`, {
            credentials: 'include',
          })
          const commissionData = await commissionRes.json()
          if (commissionData.success && commissionData.data) {
            const rate = commissionData.data.effectiveRate ?? commissionData.data.systemRate
            if (rate != null && Number.isFinite(Number(rate))) {
              const n = Number(rate)
              setPartnerCommissionRate(n)
              setFormData((prev) => ({ ...prev, commissionRate: n }))
            }
            setPricingPolicy((prev) => ({
              ...prev,
              guestServiceFeePercent: Number.isFinite(Number(commissionData.data.guestServiceFeePercent))
                ? Number(commissionData.data.guestServiceFeePercent)
                : prev.guestServiceFeePercent,
              hostCommissionPercent: Number.isFinite(Number(commissionData.data.hostCommissionPercent))
                ? Number(commissionData.data.hostCommissionPercent)
                : Number(rate),
              insuranceFundPercent: Number.isFinite(Number(commissionData.data.insuranceFundPercent))
                ? Number(commissionData.data.insuranceFundPercent)
                : prev.insuranceFundPercent,
              chatInvoiceRateMultiplier: Number.isFinite(
                Number(commissionData.data.chatInvoiceRateMultiplier),
              )
                ? Number(commissionData.data.chatInvoiceRateMultiplier)
                : prev.chatInvoiceRateMultiplier,
            }))
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }
    loadInitialData()
  }, [])

  /**
   * Stage 140.2 — capture the server baseline once the listing has loaded so
   * edit-mode "dirty" reflects divergence from saved data (not background
   * hydration like commission). Auto-managed fields are excluded by compareKey.
   */
  useEffect(() => {
    if (!isEditMode || !serverListing || editBaseline != null) return
    setEditBaseline(wizardCompareKey(formData))
  }, [isEditMode, serverListing, editBaseline, formData])

  /**
   * Stage 140.1 / 140.2 — content-aware dirty flag.
   * Create mode: any meaningful content. Edit mode: differs from server baseline.
   */
  const isDirty = useMemo(() => {
    if (isEditMode) {
      if (editBaseline == null) return false
      return wizardCompareKey(formData) !== editBaseline
    }
    return isWizardFormDirty(formData)
  }, [isEditMode, formData, editBaseline])

  /** Stage 140.1 — debounced autosave to localStorage (create mode only). */
  useEffect(() => {
    if (isEditMode || typeof window === 'undefined') return undefined
    const id = window.setTimeout(() => {
      saveWizardDraft(formData, currentStep)
    }, 600)
    return () => window.clearTimeout(id)
  }, [isEditMode, formData, currentStep])

  /** Stage 140.1 — surface a one-time "draft restored" signal to the UI. */
  useEffect(() => {
    if (draftRestored) return
    if (initialDraftRef.current) setDraftRestored(true)
  }, [draftRestored])

  return {
    editId,
    isEditMode,
    wizardMode,
    language,
    authLoading,
    isAuthenticated,
    t,
    tr,
    numberLocale,
    dayPickerLocale,
    currentStep,
    setCurrentStep,
    isDirty,
    draftRestored,
    loading,
    setLoading,
    serverListing,
    setServerListing,
    listingNotFound,
    setListingNotFound,
    savingDraft,
    setSavingDraft,
    uploading,
    setUploading,
    uploadProgress,
    setUploadProgress,
    geocoding,
    setGeocoding,
    aiDescriptionLoading,
    setAiDescriptionLoading,
    aiDescQuota,
    setAiDescQuota,
    geocodeQuery,
    setGeocodeQuery,
    geocodeResults,
    setGeocodeResults,
    customDistricts,
    setCustomDistricts,
    categories,
    setCategories,
    newSeason,
    setNewSeason,
    partnerCommissionRate,
    setPartnerCommissionRate,
    pricingPolicy,
    setPricingPolicy,
    formData,
    setFormData,
    storefrontExchangeRates,
    fileInputRef,
    draftListingIdRef,
    ensuringDraftRef,
  }
}
