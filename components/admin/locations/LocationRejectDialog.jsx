'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   suggestion: object | null,
 *   processing: boolean,
 *   rejectReason: string,
 *   onRejectReasonChange: (v: string) => void,
 *   onConfirm: () => void,
 * }} props
 */
export function LocationRejectDialog({
  open,
  onOpenChange,
  suggestion,
  processing,
  rejectReason,
  onRejectReasonChange,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Отклонить термин?</AlertDialogTitle>
          <AlertDialogDescription>
            «{suggestion?.raw_term}» исчезнет из гостевых подсказок. Листинги останутся unverified.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="reject-reason">Причина (опционально)</Label>
          <Textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            placeholder="Например: опечатка, дубликат Patong, спам"
            rows={3}
            maxLength={500}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>Отмена</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={processing} onClick={onConfirm}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Отклонить
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
