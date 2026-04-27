'use client'

import { Card, CardContent } from '@/components/ui/card'
import { getUIText } from '@/lib/translations'
import { getOrderTypeLabel } from '@/lib/orders/unified-order-card-model'
import { useUnifiedOrderCard } from '@/hooks/useUnifiedOrderCard'
import { OrderCardHeader } from '@/components/orders/card-parts/OrderCardHeader'
import { OrderCardFinancialTotals } from '@/components/orders/card-parts/OrderCardFinancials'
import { OrderCardMainSections } from '@/components/orders/card-parts/OrderCardMainSections'
import { OrderCardMessageStrip } from '@/components/orders/card-parts/OrderCardMessageStrip'
import { OrderCardGuestActions } from '@/components/orders/card-parts/OrderCardGuestActions'
import { OrderCardPartnerActions } from '@/components/orders/card-parts/OrderCardPartnerActions'
import { OrderCardAdminActions } from '@/components/orders/card-parts/OrderCardAdminActions'
import { OrderCardHelpDialogs } from '@/components/orders/card-parts/OrderCardHelpDialogs'
import { OrderCardLightboxPortal } from '@/components/orders/card-parts/OrderCardLightboxPortal'

export default function UnifiedOrderCard({
  booking,
  unifiedOrder,
  role = 'renter',
  language = 'ru',
  isBusy = false,
  cardAnchorId = null,
  onConfirm = null,
  onDecline = null,
  onComplete = null,
  onCancel = null,
  onReview = null,
  onCheckIn = null,
}) {
  const u = useUnifiedOrderCard({
    booking,
    unifiedOrder,
    role,
    language,
    onConfirm,
    onDecline,
    onCancel,
    onReview,
    onCheckIn,
    onComplete,
  })

  const orderTypeLabel = getOrderTypeLabel(u.normalizedOrder.type, language)
  const orderRefTemplate = getUIText('orderCard_orderRef', language)

  return (
    <>
      <Card
        className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
        data-booking-card={cardAnchorId || u.bookingId}
      >
        <OrderCardHeader
          listingImage={u.listingImage}
          title={u.title}
          district={u.district}
          checkIn={u.checkIn}
          checkOut={u.checkOut}
          orderType={u.normalizedOrder.type}
          orderTypeLabel={orderTypeLabel}
          bookingId={u.bookingId}
          status={u.status}
          language={language}
          orderRefTemplate={orderRefTemplate}
        />

        <CardContent className="space-y-4">
          <OrderCardMainSections
            language={language}
            normalizedRole={u.normalizedRole}
            booking={booking}
            normalizedOrder={u.normalizedOrder}
            status={u.status}
            checkOut={u.checkOut}
            reviewed={u.reviewed}
            partnerTrustPublic={u.partnerTrustPublic}
            partnerFinanceOpen={u.partnerFinanceOpen}
            setPartnerFinanceOpen={u.setPartnerFinanceOpen}
            title={u.title}
            bookingId={u.bookingId}
            pickupServiceKind={u.pickupServiceKind}
            checkInInstructionsText={u.checkInInstructionsText}
            checkInPhotoUrls={u.checkInPhotoUrls}
            onPhotoClick={(idx) => u.setPhotoLightboxIndex(idx)}
            listingImage={u.listingImage}
            guestName={u.guestName}
            guestPhone={u.guestPhone}
            guestEmail={u.guestEmail}
          />

          <OrderCardFinancialTotals
            language={language}
            normalizedRole={u.normalizedRole}
            normalizedOrder={u.normalizedOrder}
            partnerEarnings={u.partnerEarnings}
            hasUnifiedTotal={u.hasUnifiedTotal}
          />

          {u.normalizedRole !== 'admin' && u.conversationId ? (
            <OrderCardMessageStrip
              conversationId={u.conversationId}
              language={language}
              lastMessagePreview={u.lastMessagePreview}
              hasUnread={u.chatStripUnread}
            />
          ) : null}

          {u.normalizedRole === 'admin' ? (
            <OrderCardAdminActions conversationId={u.conversationId} bookingId={u.bookingId} language={language} />
          ) : null}

          {u.normalizedRole === 'renter' ? (
            <OrderCardGuestActions
              language={language}
              booking={booking}
              bookingId={u.bookingId}
              listingId={u.listingId}
              status={u.status}
              isBusy={isBusy}
              onCancel={onCancel}
              onCheckIn={onCheckIn}
              onReview={onReview}
              onOpenHelp={() => {
                u.setHelpStep('pre')
                u.setHelpOpen(true)
              }}
              showCancel={u.showRenterCancel}
              showCheckIn={u.showRenterCheckIn}
              showReview={u.showRenterReview}
              showRepeat={u.showRepeatBooking}
            />
          ) : null}

          {u.normalizedRole === 'partner' ? (
            <OrderCardPartnerActions
              language={language}
              booking={booking}
              bookingId={u.bookingId}
              isBusy={isBusy}
              onConfirm={onConfirm}
              onDecline={onDecline}
              onComplete={onComplete}
              onOpenHelp={() => {
                u.setHelpStep('main')
                u.setHelpOpen(true)
              }}
              showConfirm={u.showPartnerConfirm}
              showDecline={u.showPartnerDecline}
              showComplete={u.showPartnerComplete}
            />
          ) : null}

          <OrderCardHelpDialogs
            language={language}
            normalizedRole={u.normalizedRole}
            bookingId={u.bookingId}
            helpOpen={u.helpOpen}
            onHelpOpenChange={(open) => {
              u.setHelpOpen(open)
              if (!open) {
                u.setDisputeEvidenceFiles([])
                u.setHelpStep('pre')
                u.setMediationUnlockAt(null)
                u.setEmergencyModalOpen(false)
              }
            }}
            helpStep={u.helpStep}
            setHelpStep={u.setHelpStep}
            supportChatHref={u.supportChatHref}
            helpNudgeSending={u.helpNudgeSending}
            onNotifyPartnerHelp={u.handleNotifyPartnerHelp}
            emergencyCtx={u.emergencyCtx}
            emergencyCtxReady={u.emergencyCtxReady}
            emergencyAccessCheckKey={u.emergencyAccessCheckKey}
            debugEmergencyAlways={u.debugEmergencyAlways}
            emergencySending={u.emergencySending}
            onOpenEmergencyChecklist={u.openEmergencyChecklistModal}
            disputeEligibility={u.disputeEligibility}
            mediationLockActive={u.mediationLockActive}
            mediationUnlockAt={u.mediationUnlockAt}
            disputeReason={u.disputeReason}
            setDisputeReason={u.setDisputeReason}
            disputeEvidenceFiles={u.disputeEvidenceFiles}
            setDisputeEvidenceFiles={u.setDisputeEvidenceFiles}
            disputeEvidenceInputRef={u.disputeEvidenceInputRef}
            disputeSubmitting={u.disputeSubmitting}
            onCreateDispute={u.handleCreateDispute}
            emergencyModalOpen={u.emergencyModalOpen}
            onEmergencyModalOpenChange={(open) => {
              u.setEmergencyModalOpen(open)
              if (!open) u.setEmergencyRateBlocked(false)
            }}
            emergencyRateBlocked={u.emergencyRateBlocked}
            supportEscalating={u.supportEscalating}
            onEmergencySupportAfterLimit={u.handleEmergencySupportAfterLimit}
            emergencyCheck={u.emergencyCheck}
            setEmergencyCheck={u.setEmergencyCheck}
            canSubmitEmergency={u.canSubmitEmergency}
            onEmergencySubmit={u.handleEmergencySubmit}
          />
        </CardContent>
      </Card>

      <OrderCardLightboxPortal
        language={language}
        lightboxUrl={u.lightboxUrl}
        photoLightboxIndex={u.photoLightboxIndex}
        checkInPhotoUrlsLength={u.checkInPhotoUrls.length}
        onClose={() => u.setPhotoLightboxIndex(null)}
        onPrev={() =>
          u.setPhotoLightboxIndex((i) => ((i ?? 0) - 1 + u.checkInPhotoUrls.length) % u.checkInPhotoUrls.length)
        }
        onNext={() => u.setPhotoLightboxIndex((i) => ((i ?? 0) + 1) % u.checkInPhotoUrls.length)}
      />
    </>
  )
}
