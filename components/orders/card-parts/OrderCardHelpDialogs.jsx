'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { getUIText } from '@/lib/translations'
import {
  AlertTriangle,
  BookOpen,
  Image as ImageIcon,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Siren,
} from 'lucide-react'

/** Help + dispute flow and emergency checklist (renter/partner only; admin skips). */
export function OrderCardHelpDialogs({
  language,
  normalizedRole,
  bookingId,
  helpOpen,
  onHelpOpenChange,
  helpStep,
  setHelpStep,
  supportChatHref,
  helpNudgeSending,
  onNotifyPartnerHelp,
  emergencyCtx,
  emergencyCtxReady,
  emergencyAccessCheckKey,
  debugEmergencyAlways,
  emergencySending,
  onOpenEmergencyChecklist,
  disputeEligibility,
  mediationLockActive,
  mediationUnlockAt,
  disputeReason,
  setDisputeReason,
  disputeEvidenceFiles,
  setDisputeEvidenceFiles,
  disputeEvidenceInputRef,
  disputeSubmitting,
  onCreateDispute,
  emergencyModalOpen,
  onEmergencyModalOpenChange,
  emergencyRateBlocked,
  supportEscalating,
  onEmergencySupportAfterLimit,
  emergencyCheck,
  setEmergencyCheck,
  canSubmitEmergency,
  onEmergencySubmit,
}) {
  if (normalizedRole === 'admin') return null

  return (
    <>
      <Dialog open={helpOpen} onOpenChange={onHelpOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{getUIText('orderHelp_title', language)}</DialogTitle>
            <DialogDescription>{getUIText('orderHelp_description', language)}</DialogDescription>
          </DialogHeader>

          {helpStep === 'pre' && normalizedRole === 'renter' ? (
            <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/80 p-4">
              <p className="text-sm font-semibold text-teal-950">{getUIText('orderHelp_preContactTitle', language)}</p>
              <p className="text-sm text-teal-900/90">{getUIText('orderHelp_preContactDesc', language)}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {supportChatHref ? (
                  <Button asChild variant="default" className="bg-teal-600 hover:bg-teal-700">
                    <Link href={supportChatHref}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {getUIText('orderHelp_openChat', language)}
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="border-teal-400"
                  disabled={helpNudgeSending}
                  onClick={() => void onNotifyPartnerHelp()}
                >
                  {helpNudgeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {getUIText('orderHelp_notifyPartner', language)}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setHelpStep('main')}>
                  {getUIText('orderHelp_skipPreStep', language)}
                </Button>
              </div>
            </div>
          ) : null}

          {helpStep !== 'pre' || normalizedRole !== 'renter' ? (
            <>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">{getUIText('orderHelp_level1Title', language)}</p>
                <p className="text-sm text-slate-700">{getUIText('orderHelp_level1Desc', language)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/help/escrow-protection">
                      <BookOpen className="h-4 w-4 mr-2" />
                      {getUIText('orderHelp_knowledgeBase', language)}
                    </Link>
                  </Button>
                  {supportChatHref ? (
                    <Button asChild variant="outline">
                      <Link href={supportChatHref}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {getUIText('orderHelp_openChat', language)}
                      </Link>
                    </Button>
                  ) : null}
                  {normalizedRole === 'renter' && bookingId && emergencyCtxReady && emergencyCtx?.bookingEligible ? (
                    <div className="w-full pt-2 border-t border-slate-200 mt-2 space-y-2">
                      {(() => {
                        const partnerQuiet = emergencyCtx?.partnerInQuietHours === true
                        const showEmergencyButton = partnerQuiet || debugEmergencyAlways
                        return (
                          <>
                            {partnerQuiet ? (
                              <p className="text-xs text-slate-600">{getUIText('orderHelp_emergencyHint', language)}</p>
                            ) : null}
                            {debugEmergencyAlways && !partnerQuiet ? (
                              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                                <span className="font-semibold">{getUIText('orderHelp_emergencyDebugBadge', language)}</span>
                                {' — '}
                                {getUIText('orderHelp_emergencyDebugHint', language)}
                              </p>
                            ) : null}
                            {showEmergencyButton ? (
                              <Button
                                type="button"
                                variant="destructive"
                                className="bg-red-700 hover:bg-red-800"
                                disabled={emergencySending}
                                onClick={onOpenEmergencyChecklist}
                              >
                                <Siren className="h-4 w-4 mr-2" />
                                {getUIText('orderHelp_emergencyContact', language)}
                              </Button>
                            ) : null}
                            {!showEmergencyButton ? (
                              <>
                                <p className="text-xs text-slate-600">{getUIText('orderHelp_emergencyDaytimeHint', language)}</p>
                                {supportChatHref ? (
                                  <Button asChild variant="default" className="bg-teal-600 hover:bg-teal-700">
                                    <Link href={supportChatHref}>
                                      <MessageSquare className="h-4 w-4 mr-2" />
                                      {getUIText('orderHelp_writeToPartnerChat', language)}
                                    </Link>
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                          </>
                        )
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">{getUIText('orderHelp_level2Title', language)}</p>
                {disputeEligibility.allowed ? (
                  <>
                    <p className="text-sm text-amber-800">{getUIText('orderHelp_level2Allowed', language)}</p>
                    {mediationLockActive ? (
                      <p className="text-sm text-amber-950 bg-amber-100/80 border border-amber-300 rounded-lg px-3 py-2">
                        {getUIText('orderDispute_mediationActiveHint', language).replace(
                          '{{mins}}',
                          String(
                            Math.max(
                              1,
                              Math.ceil((new Date(mediationUnlockAt).getTime() - Date.now()) / 60_000),
                            ),
                          ),
                        )}
                      </p>
                    ) : null}
                    <Textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder={getUIText('orderDispute_reasonPlaceholder', language)}
                      maxLength={2000}
                      rows={4}
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-amber-900">{getUIText('partnerTrust_evidenceLabel', language)}</p>
                      <p className="text-xs text-amber-800/90">{getUIText('partnerTrust_evidenceHint', language)}</p>
                      <input
                        ref={disputeEvidenceInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || [])
                          e.target.value = ''
                          setDisputeEvidenceFiles((prev) => [...prev, ...picked].slice(0, 3))
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-amber-300"
                          onClick={() => disputeEvidenceInputRef.current?.click()}
                          disabled={disputeEvidenceFiles.length >= 3}
                        >
                          <ImageIcon className="h-4 w-4 mr-1.5" />
                          {getUIText('orderDispute_addPhotos', language)}
                        </Button>
                        {disputeEvidenceFiles.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-amber-900"
                            onClick={() => setDisputeEvidenceFiles([])}
                          >
                            {getUIText('orderDispute_clearPhotos', language)}
                          </Button>
                        ) : null}
                      </div>
                      {disputeEvidenceFiles.length > 0 ? (
                        <ul className="text-xs text-amber-950 space-y-0.5 list-disc pl-4">
                          {disputeEvidenceFiles.map((f) => (
                            <li key={`${f.name}-${f.size}`}>{f.name}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 text-sm text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{getUIText(`orderDispute_blockReason_${disputeEligibility.reason}`, language)}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onHelpOpenChange(false)}>
                  {getUIText('orderHelp_close', language)}
                </Button>
                {disputeEligibility.allowed ? (
                  <Button
                    type="button"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={onCreateDispute}
                    disabled={disputeSubmitting || mediationLockActive}
                  >
                    {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {mediationLockActive
                      ? getUIText('orderDispute_mediationButtonWait', language)
                      : getUIText('orderHelp_openOfficialDispute', language)}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : (
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onHelpOpenChange(false)}>
                {getUIText('orderHelp_close', language)}
              </Button>
              <Button type="button" onClick={() => setHelpStep('main')}>
                {getUIText('orderHelp_continueSupport', language)}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={emergencyModalOpen} onOpenChange={onEmergencyModalOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {emergencyRateBlocked
                ? getUIText('orderHelp_emergencyRateLimitTitle', language)
                : getUIText('orderHelp_emergencyModalTitle', language)}
            </DialogTitle>
            <DialogDescription>
              {emergencyRateBlocked
                ? getUIText('orderHelp_emergencyRateLimited', language)
                : getUIText('orderHelp_emergencyModalIntro', language)}
            </DialogDescription>
          </DialogHeader>
          {!emergencyRateBlocked ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 leading-relaxed">
              {getUIText('orderHelp_emergencyNightDisclaimer', language)}
            </div>
          ) : null}
          {emergencyRateBlocked ? (
            <div className="space-y-3 py-1">
              <Button
                type="button"
                variant="default"
                className="w-full bg-teal-700 hover:bg-teal-800"
                disabled={supportEscalating}
                onClick={() => void onEmergencySupportAfterLimit()}
              >
                {supportEscalating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LifeBuoy className="h-4 w-4 mr-2" />}
                {getUIText('orderHelp_emergencyWriteSupport', language)}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800">
                <Checkbox
                  className="mt-0.5"
                  checked={emergencyCheck.health_or_safety}
                  onCheckedChange={(v) => setEmergencyCheck((c) => ({ ...c, health_or_safety: v === true }))}
                  aria-label={getUIText('orderHelp_emergencyCheck_health', language)}
                />
                <span>{getUIText('orderHelp_emergencyCheck_health', language)}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800">
                <Checkbox
                  className="mt-0.5"
                  checked={emergencyCheck.no_property_access}
                  onCheckedChange={(v) => setEmergencyCheck((c) => ({ ...c, no_property_access: v === true }))}
                  aria-label={getUIText(emergencyAccessCheckKey, language)}
                />
                <span>{getUIText(emergencyAccessCheckKey, language)}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800">
                <Checkbox
                  className="mt-0.5"
                  checked={emergencyCheck.disaster}
                  onCheckedChange={(v) => setEmergencyCheck((c) => ({ ...c, disaster: v === true }))}
                  aria-label={getUIText('orderHelp_emergencyCheck_disaster', language)}
                />
                <span>{getUIText('orderHelp_emergencyCheck_disaster', language)}</span>
              </label>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onEmergencyModalOpenChange(false)}>
              {getUIText('orderHelp_close', language)}
            </Button>
            {emergencyRateBlocked ? null : (
              <Button
                type="button"
                variant="destructive"
                className="bg-red-700 hover:bg-red-800"
                disabled={emergencySending || !canSubmitEmergency}
                onClick={() => void onEmergencySubmit()}
              >
                {emergencySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4 mr-2" />}
                {getUIText('orderHelp_emergencyConfirmSend', language)}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
