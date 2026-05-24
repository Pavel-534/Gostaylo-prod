'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { validateMarketingUiStringsPayload } from '@/lib/marketing/validate-marketing-ui-strings'
import { promoExpiryEndMs, isPlatformPromoCritical } from '@/lib/admin/marketing-promo-helpers'
import {
  fetchMarketingUiStrings,
  saveMarketingUiStrings,
  fetchTopPartnersPromoAnalytics,
  fetchAdminPromoCodes,
  fetchAdminMarketingCampaigns,
  createAdminMarketingCampaign,
  createAdminPromoCode,
  patchAdminPromoCode,
  deleteAdminPromoCode,
} from '@/lib/admin/marketing-api-client'

const EMPTY_NEW_PROMO = {
  code: '',
  type: 'PERCENT',
  value: '',
  expiryDate: '',
  usageLimit: '',
  isFlashSale: false,
  flashEndsInHours: '24',
}

/**
 * Stage 111.0 — логика админ-страницы маркетинга (промокоды, кампании, UI strings).
 */
export function useAdminMarketingPage() {
  const { toast } = useToast()
  const [promoCodes, setPromoCodes] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [promoListFilter, setPromoListFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [extendingId, setExtendingId] = useState(null)
  const [topPartners, setTopPartners] = useState([])
  const [allowedListingIdsRaw, setAllowedListingIdsRaw] = useState('')
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    subtitle: '',
    startsAtIso: '',
    endsAtIso: '',
    promoCodeIds: [],
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [marketingUiText, setMarketingUiText] = useState('{}')
  const [marketingUiLoading, setMarketingUiLoading] = useState(true)
  const [marketingUiSaving, setMarketingUiSaving] = useState(false)
  const [newPromo, setNewPromo] = useState({ ...EMPTY_NEW_PROMO })

  const loadMarketingUiStrings = useCallback(async () => {
    setMarketingUiLoading(true)
    try {
      const { ok, data, status } = await fetchMarketingUiStrings()
      if (ok && data.data && typeof data.data === 'object') {
        setMarketingUiText(JSON.stringify(data.data, null, 2))
      } else {
        setMarketingUiText('{}')
        if (!ok) {
          toast({
            title: 'Не удалось загрузить UI Copywriting',
            description: data.error || status,
            variant: 'destructive',
          })
        }
      }
    } catch {
      setMarketingUiText('{}')
      toast({ title: 'Ошибка сети (UI Copywriting)', variant: 'destructive' })
    } finally {
      setMarketingUiLoading(false)
    }
  }, [toast])

  const loadPromoCodes = useCallback(async () => {
    try {
      const { ok, data, error, status } = await fetchAdminPromoCodes()
      if (ok) {
        setPromoCodes(data)
      } else {
        toast({
          title: 'Не удалось загрузить промокоды',
          description: error || status,
          variant: 'destructive',
        })
        setPromoCodes([])
      }
    } catch (error) {
      console.error('Failed to load promo codes:', error)
      toast({ title: 'Ошибка сети', description: 'Повторите позже', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadCampaigns = useCallback(async () => {
    setCampaignLoading(true)
    try {
      const { ok, data, error, status } = await fetchAdminMarketingCampaigns()
      if (ok) {
        setCampaigns(data)
      } else {
        toast({
          title: 'Не удалось загрузить кампании',
          description: error || status,
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Ошибка сети при загрузке кампаний', variant: 'destructive' })
    } finally {
      setCampaignLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadPromoCodes()
    void loadCampaigns()
    void loadMarketingUiStrings()
  }, [loadPromoCodes, loadCampaigns, loadMarketingUiStrings])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { ok, data } = await fetchTopPartnersPromoAnalytics()
        if (!cancelled && ok) setTopPartners(data)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveMarketingUiStrings = useCallback(async () => {
    let parsedJson
    try {
      parsedJson = JSON.parse(marketingUiText)
    } catch (e) {
      toast({
        title: 'Некорректный JSON',
        description: e?.message || 'Проверите синтаксис',
        variant: 'destructive',
      })
      return
    }
    const validated = validateMarketingUiStringsPayload(parsedJson)
    if (!validated.ok) {
      toast({
        title: 'Плейсхолдеры или структура',
        description: (validated.errors || []).slice(0, 4).join(' · ') || 'Ошибка валидации',
        variant: 'destructive',
      })
      return
    }
    setMarketingUiSaving(true)
    try {
      const { ok, data, status } = await saveMarketingUiStrings(validated.value)
      if (!ok) {
        const msg =
          Array.isArray(data.details) && data.details.length
            ? data.details.join(' · ')
            : data.error || status
        toast({ title: 'Сервер отклонил сохранение', description: msg, variant: 'destructive' })
        return
      }
      toast({
        title: 'UI Copywriting сохранён',
        description: 'Каталог подхватит строки в течение ~2 мин (CDN).',
      })
      setMarketingUiText(JSON.stringify(data.data || validated.value, null, 2))
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' })
    } finally {
      setMarketingUiSaving(false)
    }
  }, [marketingUiText, toast])

  const toggleCampaignPromo = useCallback((promoId) => {
    setCampaignForm((prev) => {
      const has = prev.promoCodeIds.includes(promoId)
      return {
        ...prev,
        promoCodeIds: has
          ? prev.promoCodeIds.filter((id) => id !== promoId)
          : [...prev.promoCodeIds, promoId],
      }
    })
  }, [])

  const handleCreateCampaign = useCallback(async () => {
    if (!campaignForm.title.trim()) {
      toast({ title: 'Введите заголовок кампании', variant: 'destructive' })
      return
    }
    if (campaignForm.promoCodeIds.length < 1) {
      toast({ title: 'Выберите минимум 1 PLATFORM-код', variant: 'destructive' })
      return
    }
    try {
      const payload = {
        title: campaignForm.title.trim(),
        subtitle: campaignForm.subtitle.trim(),
        promoCodeIds: campaignForm.promoCodeIds,
        startsAtIso: campaignForm.startsAtIso
          ? new Date(campaignForm.startsAtIso).toISOString()
          : null,
        endsAtIso: campaignForm.endsAtIso ? new Date(campaignForm.endsAtIso).toISOString() : null,
      }
      const { ok, error, status } = await createAdminMarketingCampaign(payload)
      if (!ok) {
        toast({
          title: 'Не удалось создать кампанию',
          description: error || status,
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Global Campaign создана' })
      setCampaignForm({
        title: '',
        subtitle: '',
        startsAtIso: '',
        endsAtIso: '',
        promoCodeIds: [],
      })
      await loadCampaigns()
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' })
    }
  }, [campaignForm, loadCampaigns, toast])

  const handleCreate = useCallback(async () => {
    if (!newPromo.code || !newPromo.value || !newPromo.usageLimit) {
      toast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'destructive' })
      return
    }
    if (!newPromo.isFlashSale && !newPromo.expiryDate) {
      toast({ title: 'Ошибка', description: 'Укажите дату завершения акции', variant: 'destructive' })
      return
    }
    if (newPromo.isFlashSale && !['3', '6', '12', '24'].includes(String(newPromo.flashEndsInHours))) {
      toast({
        title: 'Ошибка',
        description: 'Для Flash Sale выберите пресет времени: 3/6/12/24 часа',
        variant: 'destructive',
      })
      return
    }
    try {
      const allowedListingIds = allowedListingIdsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const payload = {
        ...newPromo,
        ...(newPromo.isFlashSale
          ? {
              validUntilIso: new Date(
                Date.now() + Number(newPromo.flashEndsInHours || 24) * 3600 * 1000,
              ).toISOString(),
            }
          : {}),
        ...(allowedListingIds.length ? { allowedListingIds } : {}),
      }
      const { ok, error, status } = await createAdminPromoCode(payload)
      if (ok) {
        toast({
          title: '✅ Промокод создан',
          description: `${newPromo.code} готов к использованию`,
        })
        setShowCreateModal(false)
        setAllowedListingIdsRaw('')
        setNewPromo({ ...EMPTY_NEW_PROMO })
        void loadPromoCodes()
      } else {
        toast({
          title: 'Не удалось создать',
          description: error || status,
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось создать промокод', variant: 'destructive' })
    }
  }, [newPromo, allowedListingIdsRaw, loadPromoCodes, toast])

  const handleExtendUses = useCallback(
    async (id, code) => {
      setExtendingId(id)
      try {
        const { ok, error, status } = await patchAdminPromoCode(id, {
          action: 'extend_uses',
          add: 100,
        })
        if (ok) {
          toast({ title: 'Лимит расширен', description: `${code}: +100 использований` })
          void loadPromoCodes()
        } else {
          toast({
            title: 'Не удалось расширить',
            description: error || status,
            variant: 'destructive',
          })
        }
      } catch {
        toast({ title: 'Ошибка сети', variant: 'destructive' })
      } finally {
        setExtendingId(null)
      }
    },
    [loadPromoCodes, toast],
  )

  const handleDelete = useCallback(
    async (id, code) => {
      if (!confirm(`Удалить промокод ${code}?`)) return
      try {
        const { ok, error, status } = await deleteAdminPromoCode(id)
        if (ok) {
          toast({ title: 'Промокод удалён' })
          void loadPromoCodes()
        } else {
          toast({
            title: 'Ошибка удаления',
            description: error || status,
            variant: 'destructive',
          })
        }
      } catch {
        toast({ title: 'Ошибка удаления', variant: 'destructive' })
      }
    },
    [loadPromoCodes, toast],
  )

  const activePromos = useMemo(
    () =>
      promoCodes.filter((p) => {
        if (!p.isActive) return false
        const end = promoExpiryEndMs(p)
        if (!Number.isFinite(end)) return true
        return end > Date.now()
      }),
    [promoCodes],
  )

  const totalUsage = useMemo(
    () => promoCodes.reduce((sum, p) => sum + p.usedCount, 0),
    [promoCodes],
  )

  const criticalPlatformPromos = useMemo(
    () => promoCodes.filter(isPlatformPromoCritical),
    [promoCodes],
  )

  const displayedPromos = useMemo(() => {
    if (promoListFilter !== 'flash') return promoCodes
    return promoCodes.filter((p) => {
      if (!p.isFlashSale) return false
      if (!p.isActive) return false
      const lim = p.usageLimit != null && p.usedCount >= p.usageLimit
      if (lim) return false
      const end = promoExpiryEndMs(p)
      return Number.isFinite(end) && end > Date.now()
    })
  }, [promoCodes, promoListFilter])

  const platformPromos = useMemo(
    () =>
      promoCodes.filter(
        (p) => String(p.createdByType || '').toUpperCase() === 'PLATFORM' && p.isActive,
      ),
    [promoCodes],
  )

  return {
    loading,
    promoCodes,
    promoListFilter,
    setPromoListFilter,
    showCreateModal,
    setShowCreateModal,
    activePromos,
    totalUsage,
    criticalPlatformPromos,
    displayedPromos,
    topPartners,
    platformPromos,
    campaignForm,
    setCampaignForm,
    campaignLoading,
    campaigns,
    marketingUiText,
    setMarketingUiText,
    marketingUiLoading,
    marketingUiSaving,
    newPromo,
    setNewPromo,
    allowedListingIdsRaw,
    setAllowedListingIdsRaw,
    extendingId,
    loadMarketingUiStrings,
    handleSaveMarketingUiStrings,
    toggleCampaignPromo,
    handleCreateCampaign,
    handleCreate,
    handleExtendUses,
    handleDelete,
  }
}
