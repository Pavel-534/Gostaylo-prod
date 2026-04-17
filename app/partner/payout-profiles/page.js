'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Landmark, CreditCard, Wallet } from 'lucide-react'
import { toast } from 'sonner'

function getChannelIcon(channel) {
  if (channel === 'BANK') return Landmark
  if (channel === 'CRYPTO') return Wallet
  return CreditCard
}

function maskField(channel, data) {
  if (channel === 'BANK') return `Счет: ${String(data?.accountNumber || '').slice(-4)}`
  if (channel === 'CRYPTO') return `Address: ${String(data?.address || '').slice(0, 8)}...${String(data?.address || '').slice(-6)}`
  return `Карта: **** ${String(data?.cardNumber || '').slice(-4)}`
}

export default function PartnerPayoutProfilesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [methods, setMethods] = useState([])
  const [profiles, setProfiles] = useState([])
  const [methodId, setMethodId] = useState('')
  const [formData, setFormData] = useState({})

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === methodId) || null,
    [methods, methodId],
  )

  const selectedChannel = selectedMethod?.channel || 'CARD'

  async function loadData() {
    setLoading(true)
    try {
      const [methodsRes, profilesRes] = await Promise.all([
        fetch('/api/v2/payout-methods', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/v2/partner/payout-profiles', { cache: 'no-store', credentials: 'include' }),
      ])
      const [methodsJson, profilesJson] = await Promise.all([methodsRes.json(), profilesRes.json()])

      if (!methodsRes.ok || !methodsJson.success) {
        throw new Error(methodsJson.error || 'Failed to load payout methods')
      }
      if (!profilesRes.ok || !profilesJson.success) {
        throw new Error(profilesJson.error || 'Failed to load payout profiles')
      }
      const nextMethods = methodsJson.data || []
      setMethods(nextMethods)
      setProfiles(profilesJson.data || [])
      if (!methodId && nextMethods.length > 0) {
        setMethodId(nextMethods[0].id)
      }
    } catch (error) {
      toast.error(error.message || 'Ошибка загрузки реквизитов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      await loadData()
    })()
  }, [])

  useEffect(() => {
    setFormData({})
  }, [methodId])

  async function handleCreateProfile() {
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
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save payout profile')
      toast.success('Реквизиты сохранены')
      setFormData({})
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
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
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to set default profile')
      toast.success('Профиль выплат обновлен')
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
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete payout profile')
      toast.success('Профиль удален')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Ошибка удаления')
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold text-slate-900'>Реквизиты для выплат</h1>
        <p className='text-slate-600 mt-1'>
          Настройте способ выплаты, чтобы видеть комиссию и сумму к зачислению до отправки payout.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новый профиль выплаты</CardTitle>
          <CardDescription>
            Поддерживаются профили CARD, BANK и CRYPTO.
          </CardDescription>
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
                      {method.name} ({method.channel}) — {method.fee_type === 'percentage' ? `${method.value}%` : `${method.value} ${method.currency}`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedChannel === 'CARD' && (
                <div className='grid md:grid-cols-2 gap-3'>
                  <Input
                    placeholder='Номер карты'
                    value={formData.cardNumber || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cardNumber: e.target.value }))}
                  />
                  <Input
                    placeholder='ФИО'
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
              )}

              {selectedChannel === 'BANK' && (
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
              )}

              {selectedChannel === 'CRYPTO' && (
                <div className='grid md:grid-cols-2 gap-3'>
                  <Input
                    placeholder='Address'
                    value={formData.address || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                  <Input
                    placeholder='Network (e.g. TRC20)'
                    value={formData.network || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, network: e.target.value }))}
                  />
                </div>
              )}

              <Button
                onClick={handleCreateProfile}
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
          <CardTitle>Мои payout-профили</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {profiles.length === 0 ? (
            <p className='text-sm text-slate-500'>Пока нет сохраненных реквизитов.</p>
          ) : (
            profiles.map((profile) => {
              const method = profile.method || {}
              const Icon = getChannelIcon(method.channel)
              return (
                <div key={profile.id} className='rounded-lg border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3'>
                  <div className='flex items-start gap-3'>
                    <div className='h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center'>
                      <Icon className='h-5 w-5 text-slate-600' />
                    </div>
                    <div>
                      <p className='font-semibold text-slate-900'>{method.name || 'Метод выплаты'}</p>
                      <p className='text-sm text-slate-600'>{maskField(method.channel, profile.data || {})}</p>
                      <div className='flex items-center gap-2 mt-2'>
                        {profile.is_default ? <Badge>Default</Badge> : null}
                        {profile.is_verified ? (
                          <Badge variant='secondary' className='gap-1'>
                            <CheckCircle2 className='h-3 w-3' />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant='outline'>Awaiting verification</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    {!profile.is_default && (
                      <>
                        <Button variant='outline' onClick={() => handleSetDefault(profile)}>
                          Сделать default
                        </Button>
                        <Button variant='destructive' onClick={() => handleDelete(profile.id)}>
                          Удалить
                        </Button>
                      </>
                    )}
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
