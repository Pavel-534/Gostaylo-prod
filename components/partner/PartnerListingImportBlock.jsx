'use client'

/**
 * Быстрый импорт превью с Airbnb (API airbnb-preview). Booking — в планах.
 */

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Download, Info, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'

// ─── Client-side URL helpers ────────────────────────────────────────────────

const AIRBNB_HOST_RE = /^(?:www\.|(?:[a-z]{2}[_-]?)?)airbnb\./i

/**
 * Клиентская нормализация ссылки Airbnb: убирает параметры, нормализует поддомен.
 * Возвращает очищенную строку или исходную, если разобрать не удалось.
 */
function clientNormalizeAirbnbUrl(raw) {
  if (!raw || typeof raw !== 'string') return raw
  try {
    const u = new URL(raw.trim())
    if (AIRBNB_HOST_RE.test(u.hostname)) {
      u.hostname = 'www.airbnb.com'
      u.protocol = 'https:'
    }
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return raw.trim()
  }
}

function looksLikeAirbnbUrl(raw) {
  try {
    const u = new URL(raw.trim())
    return AIRBNB_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

// ─── I18n helpers ────────────────────────────────────────────────────────────

const I18N = {
  title: { ru: 'Быстрый старт: импорт с Airbnb', en: 'Quick start: import from Airbnb', zh: '快速开始：从 Airbnb 导入', th: 'เริ่มต้นเร็ว: นำเข้าจาก Airbnb' },
  urlLabel: { ru: 'Ссылка на объявление Airbnb', en: 'Airbnb listing URL', zh: 'Airbnb 房源链接', th: 'URL รายการ Airbnb' },
  loadBtn: { ru: 'Загрузить данные', en: 'Load data', zh: '加载数据', th: 'โหลดข้อมูล' },
  loading: { ru: 'Загрузка…', en: 'Loading…', zh: '加载中…', th: 'กำลังโหลด…' },
  fetching: { ru: 'Получаем данные объекта…', en: 'Fetching listing…', zh: '正在获取房源数据…', th: 'กำลังดึงข้อมูล…' },
  selectCategoryFirst: {
    ru: 'Выберите категорию выше — без неё импорт недоступен.',
    en: 'Select a category first — import requires it.',
    zh: '请先选择类别 — 导入需要此项。',
    th: 'เลือกหมวดหมู่ก่อน — การนำเข้าต้องใช้',
  },
  importHint: {
    ru: 'После импорта можно перейти к шагам «Локация», «Характеристики» и «Галерея» — значения уже подставлены.',
    en: 'After import, check Location, Specs, and Gallery steps — fields are prefilled when parsed.',
    zh: '导入后，检查位置、规格和图库步骤 — 已预填写字段。',
    th: 'หลังนำเข้า ตรวจสอบขั้นตอน ที่ตั้ง, ข้อมูล และแกลเลอรี่ — ฟิลด์ถูกเติมล่วงหน้า',
  },
  // Errors
  errPasteUrl: { ru: 'Вставьте ссылку на объявление', en: 'Paste a listing URL', zh: '请粘贴房源链接', th: 'วางลิงก์รายการ' },
  errNotAirbnb: {
    ru: 'Ссылка не похожа на Airbnb. Используйте URL вида airbnb.com/rooms/…',
    en: 'URL does not look like Airbnb. Use a link like airbnb.com/rooms/…',
    zh: '链接不像 Airbnb。请使用 airbnb.com/rooms/… 格式',
    th: 'ลิงก์ไม่เหมือน Airbnb ใช้ลิงก์เช่น airbnb.com/rooms/…',
  },
  errSelectCategory: {
    ru: 'Пожалуйста, выберите категорию объекта перед импортом',
    en: 'Please select a listing category before importing',
    zh: '请在导入前选择房源类别',
    th: 'กรุณาเลือกหมวดหมู่รายการก่อนนำเข้า',
  },
  errNetwork: { ru: 'Ошибка сети. Попробуйте ещё раз.', en: 'Network error. Please try again.', zh: '网络错误，请重试', th: 'ข้อผิดพลาดเครือข่าย โปรดลองอีกครั้ง' },
  errNotConfigured: {
    ru: 'Импорт временно недоступен — обратитесь к администратору',
    en: 'Import temporarily unavailable — contact support',
    zh: '导入暂时不可用 — 联系管理员',
    th: 'นำเข้าไม่พร้อมใช้ชั่วคราว — ติดต่อผู้ดูแล',
  },
  successFilled: {
    ru: 'Данные подставлены в форму. Проверьте и при необходимости отредактируйте.',
    en: 'Form filled from import. Review before publishing.',
    zh: '导入数据已填入表单，发布前请检查。',
    th: 'ข้อมูลถูกเติมในฟอร์มแล้ว ตรวจสอบก่อนเผยแพร่',
  },
  photosMigrated: {
    ru: (m, f) => `Фото: перенесено в хранилище ${m}, с ошибками ${f} (ссылки сохранены).`,
    en: (m, f) => `Photos: migrated ${m}, failed ${f} (original URLs kept).`,
    zh: (m, f) => `照片：已迁移 ${m}，失败 ${f}（保留原始链接）。`,
    th: (m, f) => `รูปภาพ: ย้ายแล้ว ${m}, ล้มเหลว ${f} (เก็บลิงก์เดิม)`,
  },
}

function txt(key, language, ...args) {
  const lang = language || 'ru'
  const val = I18N[key]?.[lang] ?? I18N[key]?.['en'] ?? key
  return typeof val === 'function' ? val(...args) : val
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string} props.categoryId — UUID категории Gostaylo (обязателен для API)
 * @param {'wizard' | 'edit'} props.variant
 * @param {(preview: object) => void} [props.onSuccess]
 * @param {(preview: object) => void} [props.onApplyPreview]
 * @param {string} [props.listingId]
 * @param {boolean} [props.migrateImportedImagesToStorage]
 */
export function PartnerListingImportBlock({
  categoryId,
  variant = 'wizard',
  onSuccess,
  onApplyPreview,
  listingId,
  migrateImportedImagesToStorage = false,
}) {
  const { language } = useI18n()
  const t = (key, ...args) => txt(key, language, ...args)
  const ru = language === 'ru'

  const [rawUrl, setRawUrl] = useState('')
  const [loading, setLoading] = useState(false)

  /** Авто-очистка при вставке / изменении */
  function handleUrlChange(e) {
    const val = e.target.value
    // Показываем очищенный URL если выглядит как Airbnb — иначе оставляем как есть
    if (looksLikeAirbnbUrl(val)) {
      setRawUrl(clientNormalizeAirbnbUrl(val))
    } else {
      setRawUrl(val)
    }
  }

  const loadPreview = useCallback(async () => {
    const trimmed = rawUrl.trim()
    if (!trimmed) {
      toast.error(t('errPasteUrl'))
      return
    }
    if (!looksLikeAirbnbUrl(trimmed)) {
      toast.error(t('errNotAirbnb'))
      return
    }
    if (!categoryId) {
      toast.error(t('errSelectCategory'))
      return
    }

    setLoading(true)
    try {
      const body = {
        url: clientNormalizeAirbnbUrl(trimmed),
        categoryId,
        ...(listingId && migrateImportedImagesToStorage
          ? { listingId, migrateImagesToStorage: true }
          : {}),
      }

      const res = await fetch('/api/v2/partner/listings/import/airbnb-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Используем локализованное сообщение от сервера или fallback
        const serverMsg = ru ? data.error : (data.error_en || data.error)
        if (res.status === 503) {
          toast.error(t('errNotConfigured'), { duration: 8000 })
        } else if (data.field === 'url') {
          toast.error(serverMsg || t('errNotAirbnb'), { duration: 7000 })
        } else if (data.field === 'categoryId') {
          toast.error(serverMsg || t('errSelectCategory'), { duration: 7000 })
        } else {
          toast.error(serverMsg || `HTTP ${res.status}`, { duration: 7000 })
        }
        return
      }

      if (!data.success || !data.preview) {
        const msg = ru ? data.error : (data.error_en || data.error)
        toast.error(msg || (ru ? 'Пустой ответ от сервера' : 'Empty server response'))
        return
      }

      onSuccess?.(data.preview)
      onApplyPreview?.(data.preview)

      const warnings = data.warnings?.length ? ` ${data.warnings.join(' ')}` : ''
      toast.success(t('successFilled') + warnings, { duration: 6000 })

      if (data.imageMigration && (data.imageMigration.migrated > 0 || data.imageMigration.failed > 0)) {
        toast.message(t('photosMigrated', data.imageMigration.migrated, data.imageMigration.failed), { duration: 5000 })
      }
    } catch (e) {
      console.error('[PartnerListingImportBlock]', e)
      toast.error(t('errNetwork'))
    } finally {
      setLoading(false)
    }
  }, [rawUrl, categoryId, listingId, migrateImportedImagesToStorage, onSuccess, onApplyPreview, language, ru, t])

  return (
    <Card className="border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-slate-50/90 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed text-slate-600">
              {ru ? (
                <>
                  Скопируйте ссылку на объявление с сайта Airbnb (страница вида{' '}
                  <span className="font-mono text-[11px]">airbnb.com/rooms/…</span>). Нажмите «Загрузить данные» —
                  поля формы заполнятся автоматически. Рекомендуем проверить цену в батах, район и фото.
                </>
              ) : (
                <>
                  Copy your Airbnb listing URL (<span className="font-mono text-[11px]">airbnb.com/rooms/…</span>), then
                  load — we fill the form for you. Always verify THB price, district, and photos.
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
          <Info className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-sm font-medium text-amber-900">
            {ru ? 'Booking и другие площадки' : 'Booking & other platforms'}
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-900/90">
            {ru
              ? 'Импорт Booking.com пока в разработке. Для Airbnb на сервере должен быть настроен APIFY_TOKEN.'
              : 'Booking import is planned. Airbnb requires APIFY_TOKEN on the server.'}
          </AlertDescription>
        </Alert>

        {!categoryId && (
          <p className="text-sm text-amber-700">{t('selectCategoryFirst')}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="airbnb-import-url" className="text-sm font-medium">
            {t('urlLabel')}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <Input
              id="airbnb-import-url"
              type="url"
              inputMode="url"
              placeholder="https://www.airbnb.com/rooms/12345678"
              value={rawUrl}
              onChange={handleUrlChange}
              disabled={loading}
              className="h-11 flex-1 font-mono text-sm"
              autoComplete="off"
            />
            <Button
              type="button"
              onClick={loadPreview}
              disabled={loading || !categoryId}
              className="h-11 shrink-0 bg-teal-600 hover:bg-teal-700 sm:min-w-[160px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('loadBtn')}
                </>
              )}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              {t('fetching')}
            </div>
            <Skeleton className="h-9 w-full bg-slate-200/80" />
            <Skeleton className="h-20 w-full bg-slate-200/80" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="aspect-square rounded-md bg-slate-200/80" />
              <Skeleton className="aspect-square rounded-md bg-slate-200/80" />
              <Skeleton className="aspect-square rounded-md bg-slate-200/80" />
            </div>
          </div>
        )}

        {variant === 'wizard' && (
          <p className="text-xs text-slate-500">{t('importHint')}</p>
        )}
      </CardContent>
    </Card>
  )
}
