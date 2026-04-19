'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Loader2, CheckCircle2, Landmark, CreditCard, Wallet, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { getTelegramBotUsername, telegramBotStartUrl } from '@/lib/telegram-bot-public'
import { formatPayoutMethodOptionSuffix } from '@/lib/finance/payout-method-fee'

const MODERATION_NOTICE =
  'После сохранения реквизиты проверяет модератор. Убедитесь, что ФИО, номер счёта или карты указаны без ошибок — неверные данные задержат выплату.'

function getChannelIcon(channel) {
  if (channel === 'BANK') return Landmark
  if (channel === 'CRYPTO') return Wallet
  return CreditCard
}

function maskField(channel, data) {
  if (channel === 'BANK') return `Счёт: …${String(data?.accountNumber || '').slice(-4)}`
  if (channel === 'CRYPTO')
    return `Адрес: ${String(data?.address || '').slice(0, 8)}…${String(data?.address || '').slice(-6)}`
  return `Карта: **** ${String(data?.cardNumber || '').slice(-4)}`
}

function PayoutCredentialFields({ channel, formData, setFormData }) {
  if (channel === 'CARD') {
    return (
      <div className='grid md:grid-cols-2 gap-3'>
        <Input
          placeholder='Номер карты'
          value={formData.cardNumber || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, cardNumber: e.target.value }))}
        />
        <Input
          placeholder='ФИО как на карте'
          value={formData.fullName || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
        />
      </div>
    )
  }
  if (channel === 'BANK') {
    return (
      <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-3'>
        <Input
          className='lg:col-span-2'
          placeholder='ФИО получателя (как в банке)'
          value={formData.recipientName || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, recipientName: e.target.value }))}
        />
        <Input
          placeholder='ИНН'
          value={formData.inn || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, inn: e.target.value }))}
        />
        <Input
          placeholder='БИК'
          value={formData.bik || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, bik: e.target.value }))}
        />
        <Input
          className='lg:col-span-2'
          placeholder='Расчётный счёт'
          value={formData.accountNumber || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
        />
      </div>
    )
  }
  return (
    <div className='grid md:grid-cols-2 gap-3'>
      <Input
        placeholder='Адрес кошелька'
        value={formData.address || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
      />
      <Input
        placeholder='Сеть (например TRC20)'
        value={formData.network || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, network: e.target.value }))}
      />
    </div>
  )
}

export default function PartnerPayoutProfilesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [methods, setMethods] = useState([])
  const [profiles, setProfiles] = useState([])
  const [methodId, setMethodId] = useState('')
  const [formData, setFormData] = useState({})

  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [confirmEditOpen, setConfirmEditOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [editMethodId, setEditMethodId] = useState('')
  const [editFormData, setEditFormData] = useState({})

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === methodId) || null,
    [methods, methodId],
  )

  const editSelectedMethod = useMemo(
    () => methods.find((m) => m.id === editMethodId) || null,
    [methods, editMethodId],
  )

  const supportTelegramHref = useMemo(() => telegramBotStartUrl('support_payout_change'), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [methodsRes, profilesRes] = await Promise.all([
        fetch('/api/v2/payout-methods', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/v2/partner/payout-profiles', { cache: 'no-store', credentials: 'include' }),
      ])
      const [methodsJson, profilesJson] = await Promise.all([methodsRes.json(), profilesRes.json()])

      if (!methodsRes.ok || !methodsJson.success) {
        throw new Error(methodsJson.error || 'Не удалось загрузить способы выплаты')
      }
      if (!profilesRes.ok || !profilesJson.success) {
        throw new Error(profilesJson.error || 'Не удалось загрузить реквизиты')
      }
      const nextMethods = methodsJson.data || []
      setMethods(nextMethods)
      setProfiles(profilesJson.data || [])
      setMethodId((prev) => prev || (nextMethods.length > 0 ? nextMethods[0].id : ''))
    } catch (error) {
      toast.error(error.message || 'Ошибка загрузки реквизитов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setFormData({})
  }, [methodId])

  async function submitCreateProfile() {
    if (!methodId) {
      toast.error('Выберите метод выплаты')
      return
    }
    setSaving(true)
    try {
      const payload = {
        methodId,
        data: formData,
        isDefault: profiles.length === 0,
      }
      const res = await fetch('/api/v2/partner/payout-profiles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось сохранить профиль')
      toast.success('Реквизиты отправлены на проверку')
      setFormData({})
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
      setConfirmCreateOpen(false)
    }
  }

  async function submitEditProfile() {
    if (!editingProfile) return
    setSaving(true)
    try {
      const res = await fetch('/api/v2/partner/payout-profiles', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProfile.id,
          methodId: editMethodId,
          data: editFormData,
          isDefault: !!editingProfile.is_default,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось обновить профиль')
      toast.success('Изменения сохранены, профиль снова на проверке')
      setEditDialogOpen(false)
      setEditingProfile(null)
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Ошибка обновления')
    } finally {
      setSaving(false)
      setConfirmEditOpen(false)
    }
  }

  async function handleSetDefault(profile) {
    try {
      const res = await fetch('/api/v2/partner/payout-profiles', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: profile.id,
          methodId: profile.method_id,
          data: profile.data || {},
          isDefault: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось назначить основной профиль')
      toast.success('Основной способ выплаты обновлён')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Ошибка обновления')
    }
  }

  async function handleDelete(profileId) {
    try {
      const res = await fetch(`/api/v2/partner/payout-profiles?id=${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Не удалось удалить профиль')
      toast.success('Профиль удалён')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Ошибка удаления')
    }
  }

  function openEdit(profile) {
    if (profile.is_verified) return
    setEditingProfile(profile)
    setEditMethodId(profile.method_id)
    setEditFormData({ ...(profile.data || {}) })
    setConfirmEditOpen(false)
    setEditDialogOpen(true)
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold text-slate-900'>Реквизиты для выплат</h1>
        <p className='text-slate-600 mt-1'>
          Настройте способ выплаты, чтобы видеть комиссию и сумму к зачислению до отправки выплаты.
        </p>
      </div>

      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Проверка реквизитов</AlertDialogTitle>
            <AlertDialogDescription className='text-slate-600'>{MODERATION_NOTICE}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction
              className='bg-teal-600 hover:bg-teal-700'
              onClick={(e) => {
                e.preventDefault()
                void submitCreateProfile()
              }}
            >
              Отправить на проверку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить изменения?</AlertDialogTitle>
            <AlertDialogDescription className='text-slate-600'>{MODERATION_NOTICE}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction
              className='bg-teal-600 hover:bg-teal-700'
              onClick={(e) => {
                e.preventDefault()
                void submitEditProfile()
              }}
            >
              Сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setEditingProfile(null)
        }}
      >
        <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Изменить реквизиты</DialogTitle>
            <DialogDescription>
              Доступно, пока профиль не подтверждён модератором. После подтверждения создайте новый профиль.
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className='space-y-4 py-2'>
              <div>
                <label className='text-sm text-slate-600 block mb-1'>Метод выплаты</label>
                <select
                  value={editMethodId}
                  onChange={(e) => setEditMethodId(e.target.value)}
                  className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
                >
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} ({method.channel}) — {formatPayoutMethodOptionSuffix(method)}
                    </option>
                  ))}
                </select>
              </div>
              <PayoutCredentialFields
                channel={editSelectedMethod?.channel || 'CARD'}
                formData={editFormData}
                setFormData={setEditFormData}
              />
            </div>
          )}
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button type='button' variant='outline' onClick={() => setEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type='button'
              className='bg-teal-600 hover:bg-teal-700'
              disabled={saving || !editMethodId}
              onClick={() => setConfirmEditOpen(true)}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Новый профиль выплаты</CardTitle>
          <CardDescription>Поддерживаются карта, банковский перевод и криптовалюта.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {loading ? (
            <div className='py-4 flex items-center justify-center'>
              <Loader2 className='h-5 w-5 animate-spin text-teal-600' />
            </div>
          ) : (
            <>
              <div>
                <label className='text-sm text-slate-600 block mb-1'>Метод выплаты</label>
                <select
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
                >
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} ({method.channel}) — {formatPayoutMethodOptionSuffix(method)}
                    </option>
                  ))}
                </select>
              </div>

              <PayoutCredentialFields
                channel={selectedMethod?.channel || 'CARD'}
                formData={formData}
                setFormData={setFormData}
              />

              <Button
                onClick={() => setConfirmCreateOpen(true)}
                disabled={saving || !methodId}
                className='bg-teal-600 hover:bg-teal-700'
              >
                {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
                Сохранить профиль
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Мои реквизиты</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {profiles.length === 0 ? (
            <p className='text-sm text-slate-500'>Пока нет сохранённых реквизитов.</p>
          ) : (
            profiles.map((profile) => {
              const method = profile.method || {}
              const Icon = getChannelIcon(method.channel)
              return (
                <div
                  key={profile.id}
                  className='rounded-lg border border-slate-200 p-4 flex flex-col md:flex-row md:items-start justify-between gap-3'
                >
                  <div className='flex items-start gap-3 min-w-0'>
                    <div className='h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0'>
                      <Icon className='h-5 w-5 text-slate-600' />
                    </div>
                    <div className='min-w-0'>
                      <p className='font-semibold text-slate-900'>{method.name || 'Способ выплаты'}</p>
                      <p className='text-sm text-slate-600 break-all'>{maskField(method.channel, profile.data || {})}</p>
                      <div className='flex flex-wrap items-center gap-2 mt-2'>
                        {profile.is_default ? (
                          <Badge className='bg-emerald-50 text-emerald-800 border-emerald-200'>Основной</Badge>
                        ) : null}
                        {profile.is_verified ? (
                          <Badge variant='secondary' className='gap-1'>
                            <CheckCircle2 className='h-3 w-3' />
                            Подтверждено
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='text-amber-800 border-amber-200 bg-amber-50'>
                            На проверке у модератора
                          </Badge>
                        )}
                      </div>
                      {profile.is_verified ? (
                        <p className='text-xs text-slate-500 mt-2 max-w-xl leading-relaxed'>
                          Для смены подтверждённых реквизитов обратитесь в поддержку:{' '}
                          <a
                            href={supportTelegramHref}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800'
                          >
                            {`Telegram (@${getTelegramBotUsername()})`}
                          </a>
                          .
                        </p>
                      ) : null}
                      {profile.is_default ? (
                        <p className='text-xs text-slate-500 mt-2 max-w-xl leading-relaxed'>
                          Чтобы изменить реквизиты основного счёта: добавьте новый профиль, назначьте его основным,
                          затем удалите старый.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-2 shrink-0'>
                    {!profile.is_verified ? (
                      <Button variant='outline' size='sm' onClick={() => openEdit(profile)} className='gap-1'>
                        <Pencil className='h-3.5 w-3.5' />
                        Изменить
                      </Button>
                    ) : null}
                    {!profile.is_default ? (
                      <>
                        <Button variant='outline' size='sm' onClick={() => handleSetDefault(profile)}>
                          Сделать основным
                        </Button>
                        <Button variant='destructive' size='sm' onClick={() => handleDelete(profile.id)}>
                          Удалить
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
