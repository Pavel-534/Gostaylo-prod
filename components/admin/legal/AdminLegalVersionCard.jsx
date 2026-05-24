'use client'

import { useState } from 'react'
import { Eye, FilePen, Rocket } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const MINT = '#0D9488'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/**
 * @param {object} props
 * @param {'guest'|'partner'} props.docKey
 * @param {string} props.title
 * @param {string} props.description
 * @param {object} props.slice — registry slice
 * @param {object} props.textMeta — textMeta entry
 * @param {boolean} props.busy
 * @param {(doc: string, payload: object) => Promise<void>} props.onSaveDraft
 * @param {(doc: string) => Promise<void>} props.onPublish
 */
export function AdminLegalVersionCard({
  docKey,
  title,
  description,
  icon: Icon,
  slice,
  textMeta,
  busy,
  onSaveDraft,
  onPublish,
}) {
  const [changeSummary, setChangeSummary] = useState(slice?.draft?.changeSummary || '')
  const [textLastUpdated, setTextLastUpdated] = useState(
    slice?.draft?.textLastUpdated || textMeta?.textLastUpdated || '',
  )
  const [previewOpen, setPreviewOpen] = useState(false)

  const draft = slice?.draft
  const history = slice?.history || []

  return (
    <>
      <Card className="border-brand/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className="h-5 w-5" style={{ color: MINT }} />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Активная версия (для акцептов)</p>
            <p className="text-xl font-semibold font-mono">{slice?.currentVersion || '…'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Опубликована: {fmtDate(slice?.publishedAt)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Текст на сайте обновлён: {textMeta?.textLastUpdated || '—'}
              {textMeta?.textUpdatedAt ? ` (${fmtDate(textMeta.textUpdatedAt)})` : ''}
            </p>
          </div>

          {draft ? (
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
              Черновик: {draft.proposedVersion}
            </Badge>
          ) : null}

          <div className="space-y-2">
            <Label>Что изменилось (для истории и превью)</Label>
            <Textarea
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Например: уточнили порядок возвратов, раздел 4.2"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Дата обновления текста на сайте</Label>
            <Input
              value={textLastUpdated}
              onChange={(e) => setTextLastUpdated(e.target.value)}
              placeholder="19 мая 2026"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                onSaveDraft(docKey, {
                  changeSummary,
                  textLastUpdated,
                })
              }
            >
              <FilePen className="h-4 w-4 mr-1" />
              {draft ? 'Обновить черновик' : 'Создать черновик новой версии'}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={!draft}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Превью изменений
            </Button>
            <Button
              className="w-full"
              style={{ backgroundColor: MINT }}
              disabled={busy || !draft}
              onClick={() => onPublish(docKey)}
            >
              <Rocket className="h-4 w-4 mr-1" />
              Опубликовать версию
            </Button>
          </div>

          {history.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">История версий</p>
              <ul className="space-y-2 max-h-40 overflow-y-auto text-xs">
                {history.slice(0, 8).map((h) => (
                  <li key={h.version + h.publishedAt} className="rounded-md bg-slate-50 px-2 py-1.5">
                    <span className="font-mono font-medium">{h.version}</span>
                    <span className="text-muted-foreground"> · {fmtDate(h.publishedAt)}</span>
                    {h.changeSummary ? (
                      <p className="text-muted-foreground mt-0.5">{h.changeSummary}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Превью публикации</DialogTitle>
            <DialogDescription>Так будет зафиксировано после нажатия «Опубликовать»</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Сейчас:</span>{' '}
              <code>{slice?.currentVersion}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Станет:</span>{' '}
              <code className="font-semibold">{draft?.proposedVersion || '—'}</code>
            </p>
            {changeSummary || draft?.changeSummary ? (
              <div className="rounded-lg border p-3 bg-slate-50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Описание изменений</p>
                <p>{changeSummary || draft?.changeSummary}</p>
              </div>
            ) : null}
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
              После публикации все новые оплаты и согласия будут записываться под новой версией.
              Проверьте текст на сайте.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
