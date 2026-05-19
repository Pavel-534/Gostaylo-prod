'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Scale,
  Shield,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { AdminLegalVersionCard } from '@/components/admin/legal/AdminLegalVersionCard'
import { AdminLegalFullPackageCard } from '@/components/admin/legal/AdminLegalFullPackageCard'

const NAVY = '#0F172A'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function AdminLegalSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [registry, setRegistry] = useState(null)
  const [textMeta, setTextMeta] = useState(null)
  const [publishWarning, setPublishWarning] = useState('')
  const [documents, setDocuments] = useState([])
  const [publisher, setPublisher] = useState(null)
  const [consents, setConsents] = useState([])
  const [consentLoading, setConsentLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterVersion, setFilterVersion] = useState('')
  const [busyDoc, setBusyDoc] = useState(null)
  const [publishConfirm, setPublishConfirm] = useState(null)
  const [testActBusy, setTestActBusy] = useState(false)
  const [testActUrl, setTestActUrl] = useState('')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings/legal', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Ошибка загрузки')
      setRegistry(json.data.registry)
      setTextMeta(json.data.textMeta || json.data.registry?.textMeta)
      setPublishWarning(json.data.publishWarning || '')
      setDocuments(json.data.documents || [])
      setPublisher(json.data.publisher)
    } catch (e) {
      toast({ title: 'Не удалось загрузить', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const generateTestAct = useCallback(async () => {
    setTestActBusy(true)
    setTestActUrl('')
    try {
      const res = await fetch('/api/admin/settings/legal/test-act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || json.error || 'Ошибка')
      setTestActUrl(json.data?.signedUrl || '')
      toast({
        title: 'Тестовый акт готов',
        description: json.data?.message || 'PDF сформирован для smoke-проверки.',
      })
    } catch (e) {
      toast({ title: 'Не удалось сформировать акт', description: e.message, variant: 'destructive' })
    } finally {
      setTestActBusy(false)
    }
  }, [toast])

  const loadConsents = useCallback(async () => {
    setConsentLoading(true)
    try {
      const q = new URLSearchParams({ type: filterType, limit: '40' })
      if (filterVersion.trim()) q.set('version', filterVersion.trim())
      const res = await fetch(`/api/admin/settings/legal/consents?${q}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Ошибка')
      setConsents(json.data.rows || [])
    } catch (e) {
      toast({ title: 'Список акцептов', description: e.message, variant: 'destructive' })
    } finally {
      setConsentLoading(false)
    }
  }, [filterType, filterVersion, toast])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadConsents()
  }, [loadConsents])

  const saveDraft = async (doc, payload) => {
    setBusyDoc(doc)
    try {
      const res = await fetch('/api/admin/settings/legal/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc, ...payload }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Ошибка')
      toast({
        title: 'Черновик сохранён',
        description: `Будущая версия: ${json.data?.draft?.proposedVersion}`,
      })
      await loadOverview()
    } catch (e) {
      toast({ title: 'Черновик', description: e.message, variant: 'destructive' })
    } finally {
      setBusyDoc(null)
    }
  }

  const publish = async (doc) => {
    setBusyDoc(doc)
    try {
      const res = await fetch('/api/admin/settings/legal/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || json.error || 'Ошибка')
      toast({ title: 'Версия опубликована', description: json.data?.message })
      setPublishConfirm(null)
      await loadOverview()
    } catch (e) {
      toast({ title: 'Публикация', description: e.message, variant: 'destructive' })
    } finally {
      setBusyDoc(null)
    }
  }

  const kindLabel = (k) => {
    if (k === 'guest') return 'Гость'
    if (k === 'partner') return 'Партнёр'
    if (k === 'booking') return 'Бронь'
    return k
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div
        className="border-b border-slate-200/80"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #134e4a 100%)` }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-white">
          <Link
            href="/admin/settings"
            className="inline-flex items-center text-sm text-teal-200/90 hover:text-white mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Настройки
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-8 w-8 text-teal-300" />
            Юридические документы
          </h1>
          <p className="text-teal-100/80 text-sm mt-1 max-w-2xl">
            Черновик → проверка текста на сайте → публикация версии. Согласия и оплаты фиксируют
            номер активной версии.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={loadOverview}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              Обновить
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              asChild
            >
              <a href="/api/admin/settings/legal/pdf" download>
                <Download className="h-4 w-4 mr-1" />
                Скачать справку PDF
              </a>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              asChild
            >
              <a href="/api/admin/settings/legal/export-zip" download>
                <Download className="h-4 w-4 mr-1" />
                Экспорт всех документов (ZIP)
              </a>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              asChild
            >
              <Link href="/admin/settings/finances">
                <FileText className="h-4 w-4 mr-1" />
                Финансовый пульт
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {publishWarning ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p>{publishWarning}</p>
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-4">
          <AdminLegalVersionCard
            docKey="guest"
            title="Оферта для гостей"
            description="Принимается при каждой оплате"
            icon={Shield}
            slice={registry?.guest}
            textMeta={textMeta?.guest_offer}
            busy={busyDoc === 'guest'}
            onSaveDraft={saveDraft}
            onPublish={(doc) => setPublishConfirm(doc)}
          />
          <AdminLegalVersionCard
            docKey="partner"
            title="Условия для партнёров"
            description="При подаче заявки хоста"
            icon={Users}
            slice={registry?.partner}
            textMeta={textMeta?.partner_terms}
            busy={busyDoc === 'partner'}
            onSaveDraft={saveDraft}
            onPublish={(doc) => setPublishConfirm(doc)}
          />
        </div>

        <AdminLegalFullPackageCard />

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Быстрый тест: один PDF-акт</CardTitle>
            <CardDescription>
              Только акт на 1 000 ฿ без полной цепочки. Для полной проверки используйте кнопку выше.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-center">
            <Button variant="outline" onClick={generateTestAct} disabled={testActBusy}>
              {testActBusy ? 'Генерируем…' : 'Сгенерировать тестовый акт'}
            </Button>
            {testActUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={testActUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1" />
                  Открыть PDF (1 ч)
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {publisher && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Оператор на сайте</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{publisher.companyName}</p>
              <p>ИНН {publisher.inn}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Актуальные документы на сайте</CardTitle>
            <CardDescription>Откройте страницу и сверьте текст перед публикацией версии</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {documents.map((d) => (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-slate-50"
              >
                <span>{d.label}</span>
                <ExternalLink className="h-4 w-4 text-teal-600 shrink-0" />
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Последние согласия</CardTitle>
            <CardDescription>Кто и когда принял условия</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Тип</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="guest">Гости</SelectItem>
                    <SelectItem value="partner">Партнёры</SelectItem>
                    <SelectItem value="booking">По броням</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label>Версия</Label>
                <Input
                  placeholder="2026-05-18-v1"
                  value={filterVersion}
                  onChange={(e) => setFilterVersion(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={loadConsents} disabled={consentLoading}>
                <RefreshCw className={cn('h-4 w-4 mr-1', consentLoading && 'animate-spin')} />
                Применить
              </Button>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-2 font-medium">Тип</th>
                    <th className="p-2 font-medium">Когда</th>
                    <th className="p-2 font-medium">Версия</th>
                    <th className="p-2 font-medium">Контакт / ID</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        {consentLoading ? 'Загрузка…' : 'Нет записей по фильтру'}
                      </td>
                    </tr>
                  ) : (
                    consents.map((row, i) => (
                      <tr key={`${row.kind}-${row.userId || row.bookingId}-${i}`} className="border-t">
                        <td className="p-2">
                          <Badge variant="secondary">{kindLabel(row.kind)}</Badge>
                        </td>
                        <td className="p-2 whitespace-nowrap">{fmtDate(row.acceptedAt)}</td>
                        <td className="p-2 font-mono text-xs">{row.version || '—'}</td>
                        <td className="p-2 text-xs">{row.email || row.bookingId || row.userId}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(publishConfirm)} onOpenChange={(o) => !o && setPublishConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Опубликовать новую версию?</AlertDialogTitle>
            <AlertDialogDescription>
              После публикации все новые оплаты и согласия будут записываться под новым номером
              версии. Убедитесь, что текст на сайте уже обновлён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyDoc)}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(busyDoc)}
              onClick={() => publishConfirm && publish(publishConfirm)}
            >
              {busyDoc ? 'Публикуем…' : 'Опубликовать'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
