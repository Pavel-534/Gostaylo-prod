'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU')
}

export default function AdminWaitlistPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [emailFilter, setEmailFilter] = useState('')

  useEffect(() => {
    fetch('/api/v2/admin/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setCategories(j.data)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    fetch(`/api/v2/admin/waitlist?${params.toString()}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.success) {
          toast.error(j?.error || 'Не удалось загрузить waitlist')
          setRows([])
          return
        }
        setRows(j.data || [])
      })
      .catch(() => {
        toast.error('Ошибка загрузки waitlist')
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [selectedCategory])

  const visibleRows = useMemo(() => {
    const q = String(emailFilter || '').trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => String(r.email || '').toLowerCase().includes(q))
  }, [rows, emailFilter])

  const handleCsvExport = () => {
    const params = new URLSearchParams({ format: 'csv' })
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    const href = `/api/v2/admin/waitlist?${params.toString()}`
    window.open(href, '_blank')
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Waitlist лиды</h1>
          <p className="text-sm text-gray-600 mt-1">Email-подписки на категории в режиме “Скоро”.</p>
        </div>
        <Button onClick={handleCsvExport} className="min-h-[44px] w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          Экспорт в CSV
        </Button>
      </div>

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'grid grid-cols-1 gap-3 sm:grid-cols-2')}>
          <div>
            <p className="text-xs text-gray-500 mb-1">Категория</p>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Все категории" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>{c.name} /{c.slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Поиск по email</p>
            <Input
              className="min-h-[44px]"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="example@mail.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'max-sm:p-0 sm:p-0')}>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Загрузка...</div>
          ) : visibleRows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Лиды не найдены.</div>
          ) : (
            <>
              <div className="space-y-0 sm:hidden">
                {visibleRows.map((row) => (
                  <div
                    key={row.id}
                    className="border-b border-slate-100 px-0 py-3 last:border-b-0"
                  >
                    <p className="font-mono text-sm break-all text-slate-900">{row.email}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <p className="text-slate-400">Категория</p>
                        <p className="mt-0.5">{row.categorySlug || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Язык</p>
                        <p className="mt-0.5 uppercase">{row.language || '—'}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(row.createdAt)}</p>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Email</th>
                      <th className="text-left px-4 py-3 font-semibold">Категория</th>
                      <th className="text-left px-4 py-3 font-semibold">Язык</th>
                      <th className="text-left px-4 py-3 font-semibold">Дата подписки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-mono">{row.email}</td>
                        <td className="px-4 py-3">{row.categorySlug || '—'}</td>
                        <td className="px-4 py-3 uppercase">{row.language || '—'}</td>
                        <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
