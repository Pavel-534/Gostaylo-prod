'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getUIText } from '@/lib/translations'
import { DECLINE_REASON_PRESETS } from '@/lib/booking-chat-copy'

export function DeclineBookingDialog({
  open,
  onOpenChange,
  declinePreset,
  onDeclinePresetChange,
  declineOtherDetail,
  onDeclineOtherDetailChange,
  onConfirmDecline,
  language,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getUIText('messengerThread_declineTitle', language)}</DialogTitle>
          <DialogDescription>
            {getUIText('messengerThread_declineDescription', language)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>{getUIText('messengerThread_declineReason', language)}</Label>
          <RadioGroup
            value={declinePreset}
            onValueChange={onDeclinePresetChange}
            className="space-y-2"
          >
            {['occupied', 'repair', 'other'].map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <RadioGroupItem value={key} id={`decline-${key}`} />
                <span className="text-sm text-slate-800">
                  {language === 'ru' ? DECLINE_REASON_PRESETS[key].ru : DECLINE_REASON_PRESETS[key].en}
                </span>
              </label>
            ))}
          </RadioGroup>
          {declinePreset === 'other' && (
            <div className="space-y-1">
              <Label htmlFor="decline-other">
                {getUIText('messengerThread_declineComment', language)}
              </Label>
              <Textarea
                id="decline-other"
                value={declineOtherDetail}
                onChange={(e) => onDeclineOtherDetailChange(e.target.value)}
                rows={3}
                placeholder={getUIText('messengerThread_declineDetailsPlaceholder', language)}
                className="resize-none"
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {getUIText('messengerThread_declineCancel', language)}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void onConfirmDecline()}>
            {getUIText('messengerThread_declineSubmit', language)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
