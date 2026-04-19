'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { formatPayoutMethodOptionSuffix } from '@/lib/finance/payout-method-fee'

const CHANNEL_LABEL = {
  CARD: 'Карта',
  BANK: 'Банк',
  CRYPTO: 'Крипто',
}

const EMPTY_FORM = {
  name: '',
  channel: 'CARD',
  feeType: 'fixed',
  value: '0',
  currency: 'THB',
  minPayout: '0',
}

export default function AdminPayoutMethodsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [methods, setMethods] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)

  async function loadMethods() {
    setLoading(true)
    try {
      const res = await fetch('/api/v2/admin/payout-methods', { cache: 'no-store', credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось загрузить методы')
      setMethods(json.data || [])
    } catch (error) {
      toast.error(error.message || 'Ошибка загрузки методов выплат')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMethods()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        id: editingId || undefined,
        name: form.name,
        channel: form.channel,
        feeType: form.feeType,
        value: Number(form.value),
        currency: form.currency,
        minPayout: Number(form.minPayout),
      }
      const res = await fetch('/api/v2/admin/payout-methods', {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось сохранить')
      toast.success(editingId ? 'Метод обновлён' : 'Метод добавлен')
      setForm(EMPTY_FORM)
      setEditingId(null)
      await loadMethods()
    } catch (error) {
      toast.error(error.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(methodId) {
    try {
      const res = await fetch(`/api/v2/admin/payout-methods?id=${encodeURIComponent(methodId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось удалить')
      toast.success('Метод удалён')
      await loadMethods()
    } catch (error) {
      toast.error(error.message || 'Ошибка удаления')
    }
  }

  function startEdit(method) {
    setEditingId(method.id)
    setForm({
      name: method.name || '',
      channel: method.channel || 'CARD',
      feeType: method.fee_type || 'fixed',
      value: String(method.value ?? 0),
      currency: method.currency || 'THB',
      minPayout: String(method.min_payout ?? 0),
    })
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold text-slate-900'>Способы выплат</h1>
        <p className='text-slate-600 mt-1'>
          Справочник рейлов для партнёров: комиссия банка или сети (фикс или процент), валюта, минимальная сумма
          вывода.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Редактировать метод' : 'Добавить метод'}</CardTitle>
          <CardDescription>
            Пример: «Карта РФ» — канал «Карта», тип «Процент», значение 3.5, валюта RUB, мин. выплата 500.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid md:grid-cols-6 gap-3'>
          <Input
            placeholder='Название для партнёра'
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className='md:col-span-2'
          />
          <select
            value={form.channel}
            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value='CARD'>Карта (CARD)</option>
            <option value='BANK'>Банк (BANK)</option>
            <option value='CRYPTO'>Крипто (CRYPTO)</option>
          </select>
          <select
            value={form.feeType}
            onChange={(e) => setForm((prev) => ({ ...prev, feeType: e.target.value }))}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value='fixed'>Фиксированная сумма</option>
            <option value='percentage'>Процент от суммы</option>
          </select>
          <Input
            type='number'
            step='0.01'
            placeholder='Комиссия (число)'
            value={form.value}
            onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
          />
          <Input
            placeholder='Валюта (THB, RUB…)'
            value={form.currency}
            onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
          />
          <Input
            type='number'
            step='0.01'
            placeholder='Мин. выплата'
            value={form.minPayout}
            onChange={(e) => setForm((prev) => ({ ...prev, minPayout: e.target.value }))}
          />
          <div className='md:col-span-6 flex gap-2'>
            <Button onClick={handleSave} disabled={saving || !form.name} className='bg-teal-600 hover:bg-teal-700'>
              {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : editingId ? <Save className='h-4 w-4 mr-2' /> : <Plus className='h-4 w-4 mr-2' />}
              {editingId ? 'Сохранить' : 'Добавить'}
            </Button>
            {editingId && (
              <Button variant='outline' onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>
                Отмена
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Доступные методы</CardTitle>
          <CardDescription>Все записи из таблицы payout_methods (в т.ч. отключённые).</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {loading ? (
            <div className='py-4 flex items-center justify-center'>
              <Loader2 className='h-5 w-5 animate-spin text-teal-600' />
            </div>
          ) : (
            methods.map((method) => (
              <div key={method.id} className='rounded-lg border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3'>
                <div>
                  <p className='font-semibold text-slate-900'>{method.name}</p>
                  <p className='text-sm text-slate-600'>
                    {CHANNEL_LABEL[method.channel] || method.channel} • {formatPayoutMethodOptionSuffix(method)}
                  </p>
                  <div className='mt-2'>
                    <Badge variant={method.is_active ? 'default' : 'outline'}>
                      {method.is_active ? 'Активен' : 'Отключён'}
                    </Badge>
                  </div>
                </div>
                <div className='flex gap-2'>
                  <Button variant='outline' onClick={() => startEdit(method)}>
                    Редактировать
                  </Button>
                  <Button variant='destructive' onClick={() => handleDelete(method.id)}>
                    <Trash2 className='h-4 w-4 mr-1' />
                    Удалить
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
