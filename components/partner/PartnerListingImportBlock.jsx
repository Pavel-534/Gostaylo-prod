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

/**
 * @param {object} props
 * @param {string} props.categoryId — UUID категории Gostaylo (обязателен для API)
 * @param {'wizard' | 'edit'} props.variant
 * @param {(preview: object) => void} props.onSuccess — вызывается с preview после успешного запроса (до merge в форму)
 * @param {(preview: object) => void} props.onApplyPreview — применить к форме (родитель мержит)
 * @param {string} [props.listingId] — при редактировании: перенос фото в Storage сразу в БД (migrateImagesToStorage)
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
  const ru = language === 'ru'

  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const loadPreview = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error(ru ? 'Вставьте ссылку на объявление' : 'Paste a listing URL')
      return
    }
    if (!categoryId) {
      toast.error(ru ? 'Сначала выберите категорию объекта' : 'Select a category first')
      return
    }

    setLoading(true)
    try {
      const body = {
        url: trimmed,
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
        const msg = data.error || data.hint || `HTTP ${res.status}`
        toast.error(msg)
        return
      }

      if (!data.success || !data.preview) {
        toast.error(data.error || (ru ? 'Пустой ответ' : 'Empty response'))
        return
      }

      onSuccess?.(data.preview)
      onApplyPreview?.(data.preview)

      const w = data.warnings?.length ? ` ${data.warnings.join(' ')}` : ''
      toast.success(
        (ru ? 'Данные подставлены в форму. Проверьте и при необходимости отредактируйте.' : 'Form filled from import. Review before publishing.') + w,
        { duration: 6000 }
      )

      if (data.source) {
        console.info('[import] source:', data.source)
      }
      if (data.imageMigration && (data.imageMigration.migrated > 0 || data.imageMigration.failed > 0)) {
        toast.message(
          ru
            ? `Фото: перенесено в хранилище ${data.imageMigration.migrated}, с ошибками ${data.imageMigration.failed} (оставлены исходные ссылки).`
            : `Photos: migrated ${data.imageMigration.migrated}, failed ${data.imageMigration.failed} (original URLs kept).`,
          { duration: 5000 }
        )
      }
    } catch (e) {
      console.error(e)
      toast.error(ru ? 'Ошибка сети' : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [url, categoryId, listingId, migrateImportedImagesToStorage, onSuccess, onApplyPreview, ru])

  return (
    <Card className="border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-slate-50/90 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">
              {ru ? 'Быстрый старт: импорт с Airbnb' : 'Quick start: import from Airbnb'}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed text-slate-600">
              {ru ? (
                <>
                  Скопируйте ссылку на объявление с сайта Airbnb (страница вида{' '}
                  <span className="font-mono text-[11px]">airbnb.com/rooms/…</span>). Нажмите «Загрузить данные» —
                  поля формы заполнятся автоматически. Рекомендуем проверить цену в батах, район и фото; при необходимости
                  загрузите свои снимки вместо ссылок с Airbnb.
                </>
              ) : (
                <>
                  Copy your Airbnb listing URL (<span className="font-mono text-[11px]">airbnb.com/rooms/…</span>), then
                  load — we fill the form for you. Always verify THB price, district, and photos; re-upload images if
                  needed.
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
              ? 'Импорт Booking.com пока в разработке. Для Airbnb на сервере должен быть настроен APIFY_TOKEN (или Playwright на своём хостинге) — иначе загрузка вернёт ошибку конфигурации.'
              : 'Booking import is planned. Airbnb requires APIFY_TOKEN on the server (or self-hosted Playwright), or the API returns a configuration error.'}
          </AlertDescription>
        </Alert>

        {!categoryId && (
          <p className="text-sm text-amber-700">
            {ru ? 'Выберите категорию выше — без неё импорт недоступен.' : 'Select a category first — import requires it.'}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="airbnb-import-url" className="text-sm font-medium">
            {ru ? 'Ссылка на объявление Airbnb' : 'Airbnb listing URL'}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <Input
              id="airbnb-import-url"
              type="url"
              inputMode="url"
              placeholder="https://www.airbnb.com/rooms/12345678"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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
                  {ru ? 'Загрузка…' : 'Loading…'}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {ru ? 'Загрузить данные' : 'Load data'}
                </>
              )}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              {ru ? 'Получаем данные объекта…' : 'Fetching listing…'}
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
          <p className="text-xs text-slate-500">
            {ru
              ? 'После импорта можно перейти к шагам «Локация», «Характеристики» и «Галерея» — значения уже подставлены, где удалось их распознать.'
              : 'After import, check Location, Specs, and Gallery steps — fields are prefilled when parsed.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
