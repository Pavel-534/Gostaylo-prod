'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { useToast } from '@/hooks/use-toast'
import {
  fetchPartnerSettlementDocumentDownloadUrl,
  fetchPartnerSettlementDocuments,
} from '@/lib/api/partner-finances-client'

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/**
 * @param {{ t: (k: string) => string, language: string }} props
 */
export function PartnerFinancesDocuments({ t, language }) {
  const { toast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const documents = await fetchPartnerSettlementDocuments()
      setRows(documents)
    } catch (e) {
      toast({
        title: t('partnerFinances_docsError'),
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleDownload = async (row) => {
    setDownloadingId(row.id)
    try {
      const signedUrl = await fetchPartnerSettlementDocumentDownloadUrl({
        source: row.source,
        refId: row.refId,
      })
      if (!signedUrl) throw new Error('download_failed')
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast({
        title: t('partnerFinances_docsDownloadError'),
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const sourceLabel = (s) =>
    s === 'batch' ? t('partnerFinances_docsSourceBatch') : t('partnerFinances_docsSourcePayout')

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-brand-hover" />
            {t('partnerFinances_docsTitle')}
          </CardTitle>
          <CardDescription>{t('partnerFinances_docsDesc')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          {t('retry')}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {t('loading')}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('partnerFinances_docsEmpty')}</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-2 font-medium">{t('partnerFinances_docsColDate')}</th>
                  <th className="p-2 font-medium">{t('partnerFinances_docsColType')}</th>
                  <th className="p-2 font-medium">{t('partnerFinances_docsColAmount')}</th>
                  <th className="p-2 font-medium">{t('partnerFinances_docsColNo')}</th>
                  <th className="p-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{fmtWhen(row.generatedAt)}</td>
                    <td className="p-2">
                      <Badge variant="secondary">{sourceLabel(row.source)}</Badge>
                    </td>
                    <td className="p-2 font-medium">
                      {formatPrice(row.amountThb ?? 0, 'THB', language)}
                    </td>
                    <td className="p-2 font-mono text-xs">{row.documentNo}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadingId === row.id}
                        onClick={() => handleDownload(row)}
                      >
                        {downloadingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                            {t('partnerFinances_docsDownload')}
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">{t('partnerFinances_docsLinkHint')}</p>
      </CardContent>
    </Card>
  )
}
