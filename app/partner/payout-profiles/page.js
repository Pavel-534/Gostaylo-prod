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
import { useI18n } from '@/contexts/i18n-context'

function getChannelIcon(channel) {
  if (channel === 'BANK') return Landmark
  if (channel === 'CRYPTO') return Wallet
  return CreditCard
}

function maskField(channel, data, t) {
  if (channel === 'BANK')
    return `${t('payoutProfiles_maskAccount')}: …${String(data?.accountNumber || '').slice(-4)}`
  if (channel === 'CRYPTO')
    return `${t('payoutProfiles_maskAddress')}: ${String(data?.address || '').slice(0, 8)}…${String(data?.address || '').slice(-6)}`
  return `${t('payoutProfiles_maskCard')}: **** ${String(data?.cardNumber || '').slice(-4)}`
}

function PayoutCredentialFields({ channel, formData, setFormData, t }) {
  if (channel === 'CARD') {
    return (
      <div className='grid md:grid-cols-2 gap-3'>
        <Input
          placeholder={t('payoutProfiles_cardNumber')}
          value={formData.cardNumber || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, cardNumber: e.target.value }))}
        />
        <Input
          placeholder={t('payoutProfiles_cardHolder')}
          value={formData.fullName || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
        />
      </div>
    )
  }
  if (channel === 'BANK') {
    return (
      <div className='space-y-3'>
      <p className='text-xs text-slate-500'>
        {t('payoutProfiles_bankHint')}
      </p>
      <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-3'>
        <Input
          className='lg:col-span-2'
          placeholder={t('payoutProfiles_recipientName')}
          value={formData.recipientName || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, recipientName: e.target.value }))}
        />
        <Input
          placeholder={t('payoutProfiles_inn')}
          value={formData.inn || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, inn: e.target.value }))}
        />
        <Input
          placeholder={t('payoutProfiles_bik')}
          value={formData.bik || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, bik: e.target.value }))}
        />
        <Input
          className='lg:col-span-2'
          placeholder={t('payoutProfiles_accountNumber')}
          value={formData.accountNumber || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
        />
      </div>
      </div>
    )
  }
  return (
    <div className='space-y-3'>
      <p className='text-xs text-slate-500'>
        {t('payoutProfiles_usdtHint')}
      </p>
      <div className='grid md:grid-cols-2 gap-3'>
      <Input
        placeholder={t('payoutProfiles_usdtAddress')}
        value={formData.address || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
      />
      <Input
        placeholder={t('payoutProfiles_usdtNetwork')}
        value={formData.network || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, network: e.target.value }))}
      />
      </div>
    </div>
  )
}

export default function PartnerPayoutProfilesPage() {
  const { t } = useI18n()
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
      const ts = Date.now()
      const [methodsRes, profilesRes] = await Promise.all([
        fetch(`/api/v2/payout-methods?ts=${ts}`, { cache: 'no-store', credentials: 'include' }),
        fetch('/api/v2/partner/payout-profiles', { cache: 'no-store', credentials: 'include' }),
      ])
      const [methodsJson, profilesJson] = await Promise.all([methodsRes.json(), profilesRes.json()])

      if (!methodsRes.ok || !methodsJson.success) {
        throw new Error(methodsJson.error || t('payoutProfiles_loadMethodsErr'))
      }
      if (!profilesRes.ok || !profilesJson.success) {
        throw new Error(profilesJson.error || t('payoutProfiles_loadProfilesErr'))
      }
      const nextMethods = methodsJson.data || []
      setMethods(nextMethods)
      setProfiles(profilesJson.data || [])
      setMethodId((prev) => prev || (nextMethods.length > 0 ? nextMethods[0].id : ''))
    } catch (error) {
      toast.error(error.message || t('payoutProfiles_loadErr'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setFormData({})
  }, [methodId])

  async function submitCreateProfile() {
    if (!methodId) {
      toast.error(t('payoutProfiles_selectMethod'))
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
      if (!res.ok || !json.success) throw new Error(json.error || t('payoutProfiles_createErr'))
      toast.success(t('payoutProfiles_createOk'))
      setFormData({})
      await loadData()
    } catch (error) {
      toast.error(error.message || t('payoutProfiles_saveErr'))
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
      if (!res.ok || !json.success) throw new Error(json.error || t('payoutProfiles_editErr'))
      toast.success(t('payoutProfiles_editOk'))
      setEditDialogOpen(false)
      setEditingProfile(null)
      await loadData()
    } catch (error) {
      toast.error(error.message || t('payoutProfiles_updateErr'))
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
      if (!res.ok || !json.success) throw new Error(json.error || t('payoutProfiles_setDefaultErr'))
      toast.success(t('payoutProfiles_setDefaultOk'))
      await loadData()
    } catch (error) {
      toast.error(error.message || t('payoutProfiles_updateErr'))
    }
  }

  async function handleDelete(profileId) {
    try {
      const res = await fetch(`/api/v2/partner/payout-profiles?id=${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || t('payoutProfiles_deleteErr'))
      toast.success(t('payoutProfiles_deleteOk'))
      await loadData()
    } catch (error) {
      toast.error(error.message || t('payoutProfiles_deleteErr'))
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
        <h1 className='text-3xl font-bold text-slate-900'>{t('payoutProfiles_pageTitle')}</h1>
        <p className='text-slate-600 mt-1 max-w-2xl'>
          {t('payoutProfiles_pageSubtitle')}
        </p>
      </div>

      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payoutProfiles_confirmCreateTitle')}</AlertDialogTitle>
            <AlertDialogDescription className='text-slate-600'>
              {t('payoutProfiles_moderationNotice')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('payoutProfiles_back')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void submitCreateProfile()
              }}
            >
              {t('payoutProfiles_sendToReview')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payoutProfiles_confirmEditTitle')}</AlertDialogTitle>
            <AlertDialogDescription className='text-slate-600'>
              {t('payoutProfiles_moderationNotice')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('payoutProfiles_back')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void submitEditProfile()
              }}
            >
              {t('payoutProfiles_save')}
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
            <DialogTitle>{t('payoutProfiles_editDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('payoutProfiles_editDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className='space-y-4 py-2'>
              <div>
                <label className='text-sm text-slate-600 block mb-1'>{t('payoutProfiles_methodLabel')}</label>
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
                t={t}
              />
            </div>
          )}
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button type='button' variant='outline' onClick={() => setEditDialogOpen(false)}>
              {t('payoutProfiles_cancel')}
            </Button>
            <Button
              type='button'
              variant='brand'
              disabled={saving || !editMethodId}
              onClick={() => setConfirmEditOpen(true)}
            >
              {t('payoutProfiles_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{t('payoutProfiles_newProfileTitle')}</CardTitle>
          <CardDescription>
            {t('payoutProfiles_newProfileDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {loading ? (
            <div className='py-4 flex items-center justify-center'>
              <Loader2 className='h-5 w-5 animate-spin text-brand' />
            </div>
          ) : (
            <>
              <div>
                <label className='text-sm text-slate-600 block mb-1'>{t('payoutProfiles_methodLabel')}</label>
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
                t={t}
              />

              <Button
                onClick={() => setConfirmCreateOpen(true)}
                disabled={saving || !methodId}
                variant='brand'
              >
                {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
                {t('payoutProfiles_saveProfile')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('payoutProfiles_myRequisitesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {profiles.length === 0 ? (
            <p className='text-sm text-slate-500'>{t('payoutProfiles_empty')}</p>
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
                      <p className='font-semibold text-slate-900'>{method.name || t('payoutProfiles_methodDefaultName')}</p>
                      <p className='text-sm text-slate-600 break-all'>{maskField(method.channel, profile.data || {}, t)}</p>
                      <div className='flex flex-wrap items-center gap-2 mt-2'>
                        {profile.is_default ? (
                          <Badge className='bg-emerald-50 text-emerald-800 border-emerald-200'>{t('payoutProfiles_badgeDefault')}</Badge>
                        ) : null}
                        {profile.is_verified ? (
                          <Badge variant='secondary' className='gap-1'>
                            <CheckCircle2 className='h-3 w-3' />
                            {t('payoutProfiles_badgeVerified')}
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='text-amber-800 border-amber-200 bg-amber-50'>
                            {t('payoutProfiles_badgePending')}
                          </Badge>
                        )}
                      </div>
                      {profile.is_verified ? (
                        <p className='text-xs text-slate-500 mt-2 max-w-xl leading-relaxed'>
                          {t('payoutProfiles_verifiedSupportHintPrefix')}
                          <a
                            href={supportTelegramHref}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='font-medium text-brand-hover underline underline-offset-2 hover:text-brand'
                          >
                            {`Telegram (@${getTelegramBotUsername()})`}
                          </a>
                          .
                        </p>
                      ) : null}
                      {profile.is_default ? (
                        <p className='text-xs text-slate-500 mt-2 max-w-xl leading-relaxed'>
                          {t('payoutProfiles_defaultChangeHint')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-2 shrink-0'>
                    {!profile.is_verified ? (
                      <Button variant='outline' size='sm' onClick={() => openEdit(profile)} className='gap-1'>
                        <Pencil className='h-3.5 w-3.5' />
                        {t('payoutProfiles_editBtn')}
                      </Button>
                    ) : null}
                    {!profile.is_default ? (
                      <>
                        <Button variant='outline' size='sm' onClick={() => handleSetDefault(profile)}>
                          {t('payoutProfiles_makeDefault')}
                        </Button>
                        <Button variant='destructive' size='sm' onClick={() => handleDelete(profile.id)}>
                          {t('payoutProfiles_delete')}
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
