'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Eye, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createConciergeClaimInviteClient,
  fetchConciergeBatchDetail,
  fetchConciergeBatches,
} from '@/lib/admin/concierge-admin-api-client'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU')
}

export function ConciergeBatchesTab() {
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [claimBusyId, setClaimBusyId] = useState(null)
  const limit = 20

  const load = useCallback(async (nextPage = page) => {
    setLoading(true)
    try {
      const data = await fetchConciergeBatches({ page: nextPage, limit })
      setItems(data.items || [])
      setTotal(data.total || 0)
      setPage(data.page || nextPage)
    } catch (e) {
      toast.error(e?.message || 'Ошибка загрузки журнала')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openBatch(batchId) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const data = await fetchConciergeBatchDetail(batchId)
      setDetail(data)
    } catch (e) {
      toast.error(e?.message || 'Не удалось открыть батч')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function copyOrIssueClaim(batch) {
    if (!batch?.claimEligible) {
      toast.error('Claim доступен только для shadow-партнёра до активации')
      return
    }
    const email = batch.partner?.email
    if (!email) {
      toast.error('У партнёра нет email')
      return
    }
    setClaimBusyId(batch.id)
    try {
      const invite = await createConciergeClaimInviteClient({
        partnerProfileId: batch.partnerProfileId,
        email,
        batchId: batch.id,
        sendEmail: false,
      })
      await navigator.clipboard.writeText(invite.claimUrl)
      toast.success('Новая Claim URL скопирована (сырой токен в БД не хранится)')
    } catch (e) {
      toast.error(e?.message || 'Не удалось выпустить Claim URL')
    } finally {
      setClaimBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-4" data-testid="concierge-batches-tab">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Журнал батчей</CardTitle>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => load(page)}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          {loading && items.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Батчей пока нет</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" data-testid="concierge-batches-table">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">ID</th>
                      <th className="py-2 pr-2 font-medium">Источник / партнёр</th>
                      <th className="py-2 pr-2 font-medium">Листинги</th>
                      <th className="py-2 pr-2 font-medium">Создан</th>
                      <th className="py-2 pr-2 font-medium">Статус</th>
                      <th className="py-2 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((batch) => (
                      <tr key={batch.id} className="border-b border-border/60 align-top">
                        <td className="py-3 pr-2 font-mono text-xs">{batch.id}</td>
                        <td className="py-3 pr-2">
                          <div className="font-medium">
                            {batch.sourceLabel || batch.sourceType || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {batch.partner?.email || batch.partnerProfileId}
                            {batch.claimEligible ? ' · shadow' : batch.claimed ? ' · claimed' : ''}
                          </div>
                        </td>
                        <td className="py-3 pr-2">{batch.listingsCount}</td>
                        <td className="py-3 pr-2 whitespace-nowrap">{formatDate(batch.createdAt)}</td>
                        <td className="py-3 pr-2">{batch.status}</td>
                        <td className="py-3">
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] justify-start"
                              onClick={() => openBatch(batch.id)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Объекты
                            </Button>
                            {batch.claimEligible ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] justify-start"
                                disabled={claimBusyId === batch.id}
                                onClick={() => copyOrIssueClaim(batch)}
                              >
                                {claimBusyId === batch.id ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="mr-1 h-4 w-4" />
                                )}
                                Claim URL
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {items.map((batch) => (
                  <div key={batch.id} className="rounded-2xl border border-border p-3 space-y-2">
                    <p className="font-mono text-xs break-all">{batch.id}</p>
                    <p className="text-sm font-medium">{batch.sourceLabel || batch.sourceType || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {batch.partner?.email || batch.partnerProfileId} · {batch.listingsCount} объектов ·{' '}
                      {batch.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(batch.createdAt)}</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px] w-full"
                        onClick={() => openBatch(batch.id)}
                      >
                        Просмотреть объекты
                      </Button>
                      {batch.claimEligible ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] w-full"
                          disabled={claimBusyId === batch.id}
                          onClick={() => copyOrIssueClaim(batch)}
                        >
                          Скопировать Claim URL
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Стр. {page} / {totalPages} · всего {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={page <= 1 || loading}
                    onClick={() => load(page - 1)}
                  >
                    Назад
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={page >= totalPages || loading}
                    onClick={() => load(page + 1)}
                  >
                    Далее
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Объекты батча</DialogTitle>
            <DialogDescription>{detail?.batch?.id || '…'}</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
            </p>
          ) : (
            <ul className="space-y-2">
              {(detail?.listings || []).map((l) => (
                <li key={l.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.importExternalId || l.id} · {l.status}
                    {l.isDraft ? ' · draft' : ''} · {l.basePriceThb ?? '—'} THB
                  </p>
                </li>
              ))}
              {!detail?.listings?.length ? (
                <li className="text-sm text-muted-foreground">Листингов не найдено</li>
              ) : null}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
