'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConciergeListingPreviewCard } from '@/components/admin/concierge/ConciergeListingPreviewCard'
import {
  createConciergeClaimInviteClient,
  fetchConciergePrompt,
  ingestConciergeClient,
  provisionConciergePartnerClient,
  searchConciergePartnersClient,
  validateConciergePayloadClient,
} from '@/lib/admin/concierge-admin-api-client'
import { stripMarkdownJsonFences } from '@/lib/services/concierge/strip-json-fences.js'
import { MAPPING_PROFILE_IDS } from '@/lib/services/concierge/mapping-profiles/types.js'

const MAPPING_PROFILE_OPTIONS = [
  {
    id: MAPPING_PROFILE_IDS.GENERIC,
    label: 'generic_concierge_v1 — универсальный',
  },
  {
    id: MAPPING_PROFILE_IDS.SHOW_PROPERTY,
    label: 'show_property_v1 — сезоны (high season обязателен)',
  },
]

const DRIVE_PLAYBOOK_PATH = 'docs/runbooks/CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md'

function parsePastePackage(rawText, mappingProfileOverride) {
  const trimmed = stripMarkdownJsonFences(rawText)
  if (!trimmed) return { ok: false, error: 'Вставьте JSON пакета' }
  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'Невалидный JSON' }
  }
  if (Array.isArray(parsed)) {
    return {
      ok: true,
      mappingProfile: mappingProfileOverride || 'generic_concierge_v1',
      sourceType: 'json',
      sourceLabel: null,
      listings: parsed,
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Ожидается объект или массив listings' }
  }
  const listings = Array.isArray(parsed.listings) ? parsed.listings : null
  if (!listings) {
    return { ok: false, error: 'В JSON нет массива listings' }
  }
  return {
    ok: true,
    mappingProfile:
      mappingProfileOverride || parsed.mappingProfile || 'generic_concierge_v1',
    sourceType: parsed.sourceType || 'json',
    sourceLabel: parsed.sourceLabel || null,
    listings,
    rateToThb: parsed.rateToThb || undefined,
  }
}

export function ConciergeImportTab() {
  const [jsonText, setJsonText] = useState('')
  const [mappingProfileId, setMappingProfileId] = useState(MAPPING_PROFILE_IDS.SHOW_PROPERTY)
  const [validating, setValidating] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [validation, setValidation] = useState(null)
  const [previewListings, setPreviewListings] = useState([])
  const [packageMeta, setPackageMeta] = useState({
    mappingProfile: 'generic_concierge_v1',
    sourceType: 'json',
    sourceLabel: null,
  })

  const [partnerMode, setPartnerMode] = useState('new')
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [partnerQuery, setPartnerQuery] = useState('')
  const [partnerOptions, setPartnerOptions] = useState([])
  const [partnerSearching, setPartnerSearching] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [successModal, setSuccessModal] = useState(null)

  const debounceRef = useRef(null)
  const searchDebounceRef = useRef(null)

  const copyPrompt = useCallback(async () => {
    try {
      const prompt = await fetchConciergePrompt()
      await navigator.clipboard.writeText(prompt)
      toast.success('Промпт скопирован')
    } catch (e) {
      toast.error(e?.message || 'Не удалось скопировать промпт')
    }
  }, [])

  const runValidate = useCallback(async (text, profileId) => {
    const parsed = parsePastePackage(text, profileId)
    if (!parsed.ok) {
      setParseError(parsed.error)
      setValidation(null)
      setPreviewListings([])
      return
    }
    setParseError(null)
    setPackageMeta({
      mappingProfile: parsed.mappingProfile,
      sourceType: parsed.sourceType,
      sourceLabel: parsed.sourceLabel,
    })
    setValidating(true)
    try {
      const result = await validateConciergePayloadClient({
        mappingProfile: profileId || parsed.mappingProfile,
        listings: parsed.listings,
        rateToThb: parsed.rateToThb,
        checkImageUrls: true,
      })
      setValidation(result)
      if (result.valid) {
        setPreviewListings(
          Array.isArray(result.listings) && result.listings.length
            ? result.listings
            : parsed.listings,
        )
      } else {
        setPreviewListings([])
      }
    } catch (e) {
      setValidation({ valid: false, error: e?.message || 'Ошибка validate-payload' })
      setPreviewListings([])
    } finally {
      setValidating(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!String(jsonText || '').trim()) {
        setParseError(null)
        setValidation(null)
        setPreviewListings([])
        return
      }
      runValidate(jsonText, mappingProfileId)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [jsonText, mappingProfileId, runValidate])

  useEffect(() => {
    if (partnerMode !== 'existing') return
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(async () => {
      setPartnerSearching(true)
      try {
        const items = await searchConciergePartnersClient(partnerQuery)
        setPartnerOptions(items)
      } catch (e) {
        toast.error(e?.message || 'Ошибка поиска')
        setPartnerOptions([])
      } finally {
        setPartnerSearching(false)
      }
    }, 350)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [partnerQuery, partnerMode])

  const verdict = useMemo(() => {
    if (parseError) return { tone: 'error', label: 'Errors', detail: parseError }
    if (validating) return { tone: 'muted', label: 'Проверка…', detail: null }
    if (!validation) return { tone: 'muted', label: 'Ожидание JSON', detail: null }
    if (validation.valid === true) {
      const warnCount = validation.summary?.warnings?.length || 0
      if (warnCount > 0) {
        return {
          tone: 'warn',
          label: 'Warnings',
          detail: `${validation.summary?.totalListings || 0} объектов, ${warnCount} предупреждений`,
        }
      }
      return {
        tone: 'ok',
        label: 'Valid',
        detail: `${validation.summary?.totalListings || 0} объектов · ${validation.summary?.totalSeasons || 0} сезонов`,
      }
    }
    const errCount = validation.summary?.errors?.length || 0
    return {
      tone: 'error',
      label: 'Errors',
      detail: validation.error || `${errCount} ошибок валидации`,
    }
  }, [parseError, validating, validation])

  const canSubmit =
    validation?.valid === true &&
    previewListings.length > 0 &&
    !submitting &&
    (partnerMode === 'new'
      ? Boolean(newEmail.trim())
      : Boolean(selectedPartner?.id))

  async function handleIngest() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      let partnerProfileId = selectedPartner?.id
      let claimEmail = selectedPartner?.email || newEmail.trim()

      if (partnerMode === 'new') {
        const provisioned = await provisionConciergePartnerClient({
          email: newEmail.trim(),
          fullName: newName.trim() || undefined,
          phone: newPhone.trim() || undefined,
        })
        partnerProfileId = provisioned.profile?.id
        claimEmail = provisioned.profile?.email || newEmail.trim()
        if (!partnerProfileId) throw new Error('Shadow partner id missing')
      }

      const ingest = await ingestConciergeClient({
        partnerProfileId,
        sourceType: packageMeta.sourceType,
        sourceLabel: packageMeta.sourceLabel || `admin-ui-${new Date().toISOString().slice(0, 10)}`,
        mappingProfile: mappingProfileId || packageMeta.mappingProfile,
        listings: previewListings,
        autoRehostMedia: true,
      })

      let claimUrl = null
      if (partnerMode === 'new') {
        const invite = await createConciergeClaimInviteClient({
          partnerProfileId,
          email: claimEmail,
          batchId: ingest.batchId,
          sendEmail: true,
        })
        claimUrl = invite.claimUrl
      }

      setSuccessModal({
        batchId: ingest.batchId,
        importedListingsCount: ingest.importedListingsCount,
        claimUrl,
        partnerMode,
      })
      toast.success(
        partnerMode === 'new'
          ? 'Ingest + claim-инвайт готовы'
          : `Ingest выполнен (${ingest.importedListingsCount} объектов)`,
      )
    } catch (e) {
      toast.error(e?.message || 'Ошибка ingest')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyClaimUrl() {
    if (!successModal?.claimUrl) return
    try {
      await navigator.clipboard.writeText(successModal.claimUrl)
      toast.success('Claim URL скопирован')
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  return (
    <div className="space-y-4" data-testid="concierge-import-tab">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. AI Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={copyPrompt}
            data-testid="concierge-copy-prompt"
          >
            <Copy className="mr-2 h-4 w-4" />
            Скопировать промпт для LLM
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Вставьте промпт в Grok/ChatGPT вместе с файлом партнёра, затем вернитесь с JSON.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. Вставка JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="concierge-mapping-profile">Mapping profile</Label>
            <select
              id="concierge-mapping-profile"
              className="flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm"
              value={mappingProfileId}
              onChange={(e) => setMappingProfileId(e.target.value)}
              data-testid="concierge-mapping-profile"
            >
              {MAPPING_PROFILE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData('text')
              if (!pasted) return
              const cleaned = stripMarkdownJsonFences(pasted)
              if (cleaned !== pasted.trim()) {
                e.preventDefault()
                setJsonText(cleaned)
              }
            }}
            placeholder='{"mappingProfile":"show_property_v1","listings":[...]}'
            className="min-h-[180px] font-mono text-xs"
            data-testid="concierge-json-input"
          />
          <p className="text-xs text-muted-foreground">
            Markdown-ограждения <code className="text-[11px]">```json</code> снимаются автоматически.
          </p>
          {validating ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              validate-payload…
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">3. Валидация и предпросмотр</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={
              verdict.tone === 'ok'
                ? 'rounded-2xl border border-brand/30 bg-brand/5 px-3 py-2'
                : verdict.tone === 'warn'
                  ? 'rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2'
                  : verdict.tone === 'error'
                    ? 'rounded-2xl border border-destructive/40 bg-destructive/5 px-3 py-2'
                    : 'rounded-2xl border border-border bg-muted/40 px-3 py-2'
            }
            data-testid="concierge-validation-verdict"
          >
            <p className="text-sm font-semibold">{verdict.label}</p>
            {verdict.detail ? <p className="text-xs text-muted-foreground mt-0.5">{verdict.detail}</p> : null}
          </div>

          {Array.isArray(validation?.summary?.errors) && validation.summary.errors.length > 0 ? (
            <ul className="space-y-1 text-xs text-destructive" data-testid="concierge-validation-errors">
              {validation.summary.errors.slice(0, 12).map((e, i) => (
                <li key={`${e.code}-${i}`}>
                  {e.externalId ? `${e.externalId}: ` : ''}
                  {e.message || e.code}
                </li>
              ))}
            </ul>
          ) : null}

          {Array.isArray(validation?.summary?.warnings) && validation.summary.warnings.length > 0 ? (
            <ul className="space-y-1 text-xs text-amber-800" data-testid="concierge-validation-warnings">
              {validation.summary.warnings.slice(0, 12).map((w, i) => (
                <li key={`${w.code}-${i}`}>
                  {w.externalId ? `${w.externalId}: ` : ''}
                  {w.message || w.code}
                </li>
              ))}
            </ul>
          ) : null}

          {Array.isArray(validation?.summary?.warnings) &&
          validation.summary.warnings.some((w) =>
            /IMAGE|DRIVE|HTTPS|Фото|фото/i.test(String(w.code || '') + String(w.message || '')),
          ) ? (
            <p
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              data-testid="concierge-drive-playbook-hint"
            >
              Проблемы с фото / Drive: материализуйте папку в прямые HTTPS URL по playbook{' '}
              <code className="text-[11px]">{DRIVE_PLAYBOOK_PATH}</code>
              {' · '}
              <button
                type="button"
                className="underline font-medium min-h-[44px] inline-flex items-center"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(DRIVE_PLAYBOOK_PATH)
                    toast.success('Путь к playbook скопирован')
                  } catch {
                    toast.message(DRIVE_PLAYBOOK_PATH)
                  }
                }}
              >
                скопировать путь
              </button>
            </p>
          ) : null}

          {previewListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {previewListings.map((listing) => (
                <ConciergeListingPreviewCard
                  key={listing.externalId || listing.title}
                  listing={listing}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">4. Назначение партнёра</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={partnerMode}
            onValueChange={setPartnerMode}
            className="gap-3"
            data-testid="concierge-partner-mode"
          >
            <div className="flex items-center gap-2 min-h-[44px]">
              <RadioGroupItem value="new" id="partner-new" />
              <Label htmlFor="partner-new">Новый партнёр (Shadow + Claim)</Label>
            </div>
            <div className="flex items-center gap-2 min-h-[44px]">
              <RadioGroupItem value="existing" id="partner-existing" />
              <Label htmlFor="partner-existing">Существующий партнёр</Label>
            </div>
          </RadioGroup>

          {partnerMode === 'new' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="concierge-email">Email</Label>
                <Input
                  id="concierge-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  data-testid="concierge-new-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concierge-name">Имя</Label>
                <Input
                  id="concierge-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concierge-phone">Телефон</Label>
                <Input
                  id="concierge-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="concierge-partner-search">Поиск PARTNER</Label>
              <Input
                id="concierge-partner-search"
                value={partnerQuery}
                onChange={(e) => setPartnerQuery(e.target.value)}
                placeholder="Email или имя"
                data-testid="concierge-partner-search"
              />
              {partnerSearching ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Поиск…
                </p>
              ) : null}
              <ul className="max-h-48 overflow-auto rounded-xl border border-border divide-y">
                {partnerOptions.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full min-h-[44px] px-3 py-2 text-left text-sm hover:bg-muted/60 ${
                        selectedPartner?.id === p.id ? 'bg-brand/10' : ''
                      }`}
                      onClick={() => setSelectedPartner(p)}
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{p.email}</span>
                    </button>
                  </li>
                ))}
                {!partnerSearching && partnerOptions.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground">Ничего не найдено</li>
                ) : null}
              </ul>
              {selectedPartner ? (
                <p className="text-xs text-brand">
                  Выбран: {selectedPartner.label} ({selectedPartner.id})
                </p>
              ) : null}
            </div>
          )}

          <Button
            type="button"
            variant="brand"
            className="min-h-[44px] w-full sm:w-auto"
            disabled={!canSubmit}
            onClick={handleIngest}
            data-testid="concierge-ingest-submit"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {partnerMode === 'new'
              ? 'Выполнить Ingest и создать Claim-инвайт'
              : 'Выполнить Ingest (без Claim)'}
          </Button>
          {partnerMode === 'existing' ? (
            <p className="text-xs text-muted-foreground">
              Для существующего партнёра claim-ссылка не создаётся (ADR-210): черновики появятся в его кабинете.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(successModal)} onOpenChange={(o) => !o && setSuccessModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Пакет загружен</DialogTitle>
            <DialogDescription>
              Батч {successModal?.batchId} · объектов: {successModal?.importedListingsCount ?? '—'}
            </DialogDescription>
          </DialogHeader>
          {successModal?.claimUrl ? (
            <div className="space-y-2">
              <Label>Claim URL</Label>
              <Textarea readOnly value={successModal.claimUrl} className="min-h-[80px] text-xs font-mono" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Claim не создавался — партнёр уже в системе. Сообщите ему проверить черновики в кабинете.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {successModal?.claimUrl ? (
              <Button type="button" variant="brand" className="min-h-[44px]" onClick={copyClaimUrl}>
                <Copy className="mr-2 h-4 w-4" />
                Скопировать Claim URL
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setSuccessModal(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
