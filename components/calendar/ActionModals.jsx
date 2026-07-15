/**
 * ActionModals — partner master calendar actions (Stage 188.0: mobile bottom sheets).
 */

'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ru as ruLocale, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import {
  Lock,
  User,
  Check,
  Loader2,
  DollarSign,
  Clock,
  Unlock,
  ExternalLink,
  CalendarDays,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { getBookingStatusLabel } from '@/lib/booking/booking-status-display.js'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  CalendarActionOverlay,
  CalendarOverlayFooter,
} from '@/components/calendar/calendar-action-overlay.jsx'
import {
  buildBlockedCellTitle,
  formatBlockExpiresAt,
} from '@/lib/calendar/calendar-cell-presentation.js'
import { cn } from '@/lib/utils'

const DF_LOCALE = { ru: ruLocale, en: enUS, zh: zhCN, th: thLocale }

function trTpl(template, vars) {
  let s = String(template || '')
  for (const [k, v] of Object.entries(vars || {})) {
    s = s.split(`{{${k}}}`).join(String(v))
  }
  return s
}

function formatSheetDate(dateStr, language) {
  if (!dateStr) return ''
  try {
    const loc = DF_LOCALE[String(language || 'ru').slice(0, 2)] || ruLocale
    return format(parseISO(dateStr), 'd MMMM yyyy', { locale: loc })
  } catch {
    return dateStr
  }
}

function overlayBtnClass(isMobile) {
  return cn('min-h-11', isMobile && 'w-full')
}

export function ActionModals({
  actionModal,
  setActionModal,
  blockForm,
  setBlockForm,
  bookingForm,
  setBookingForm,
  priceModal,
  setPriceModal,
  priceForm,
  setPriceForm,
  listings,
  onBlockSubmit,
  onBookingSubmit,
  onPriceSubmit,
  onUnblockSubmit,
  createBlockMutation,
  createBookingMutation,
  deleteBlockMutation,
  priceSubmitPending = false,
  onActionModalClose,
  language = 'ru',
  exchangeRates = { THB: 1 },
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const dfLoc = DF_LOCALE[String(language || 'ru').slice(0, 2)] || ruLocale
  const fp = (amountThb) => formatPrice(amountThb, 'THB', exchangeRates, language)
  const t = (key) => getUIText(key, language)

  const closeActionModal = () => {
    setActionModal({
      open: false,
      type: null,
      listing: null,
      date: null,
      cellData: null,
      checkOutDate: null,
    })
    onActionModalClose?.()
  }

  const actionOpenChange = (open) => {
    if (!open) closeActionModal()
    else setActionModal((prev) => ({ ...prev, open: true }))
  }

  const listingTitle = actionModal.listing?.title || ''
  const tappedDateLabel = actionModal.date ? formatSheetDate(actionModal.date, language) : ''
  const rangeEndLabel = actionModal.checkOutDate
    ? formatSheetDate(actionModal.checkOutDate, language)
    : ''
  const selectPeriodLabel =
    actionModal.checkOutDate && actionModal.checkOutDate !== actionModal.date
      ? trTpl(t('partnerCal_selectedRange'), {
          start: tappedDateLabel,
          end: rangeEndLabel,
        })
      : tappedDateLabel

  const renderSelectBody = () => (
    <div className="grid gap-3">
      <Button
        variant="outline"
        className="h-auto min-h-[44px] w-full justify-start whitespace-normal py-3 pl-3 pr-3 text-left [&_svg]:!size-5"
        onClick={() => setActionModal((prev) => ({ ...prev, type: 'block' }))}
      >
        <span className="flex w-full min-w-0 items-start gap-3 text-left">
          <Lock className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium leading-snug">{t('partnerCal_blockTitleBtn')}</span>
            <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500">
              {t('partnerCal_blockHintBtn')}
            </span>
          </span>
        </span>
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-[44px] w-full justify-start whitespace-normal py-3 pl-3 pr-3 text-left [&_svg]:!size-5"
        onClick={() => setActionModal((prev) => ({ ...prev, type: 'booking' }))}
      >
        <span className="flex w-full min-w-0 items-start gap-3 text-left">
          <User className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium leading-snug">{t('partnerCal_bookingTitleBtn')}</span>
            <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500">
              {t('partnerCal_bookingHintBtn')}
            </span>
          </span>
        </span>
      </Button>
    </div>
  )

  const renderBlockBody = () => (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>{t('partnerCal_labelStart')}</Label>
          <Input type="date" value={actionModal.date || ''} disabled className="mt-1 min-h-11" />
        </div>
        <div>
          <Label>{t('partnerCal_labelEnd')}</Label>
          <Input
            type="date"
            value={blockForm.endDate}
            min={actionModal.date}
            onChange={(e) => setBlockForm((prev) => ({ ...prev, endDate: e.target.value }))}
            className="mt-1 min-h-11"
          />
        </div>
      </div>
      <div>
        <Label>{t('partnerCal_blockType')}</Label>
        <Select
          value={blockForm.type}
          onValueChange={(v) => setBlockForm((prev) => ({ ...prev, type: v }))}
        >
          <SelectTrigger className="mt-1 min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER_USE">{t('partnerCal_typeOwner')}</SelectItem>
            <SelectItem value="MAINTENANCE">{t('partnerCal_typeMaintenance')}</SelectItem>
            <SelectItem value="OTHER">{t('partnerCal_typeOther')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t('partnerCal_reasonOptional')}</Label>
        <Textarea
          value={blockForm.reason}
          onChange={(e) => setBlockForm((prev) => ({ ...prev, reason: e.target.value }))}
          placeholder={t('partnerCal_reasonPh')}
          className="mt-1"
        />
      </div>
    </div>
  )

  const renderBlockFooter = () => (
    <CalendarOverlayFooter>
      <Button
        variant="outline"
        className={overlayBtnClass(isMobile)}
        onClick={() => setActionModal((prev) => ({ ...prev, type: 'select' }))}
      >
        {t('partnerCal_back')}
      </Button>
      <Button
        onClick={onBlockSubmit}
        disabled={createBlockMutation.isPending}
        className={cn('bg-slate-600 hover:bg-slate-700', overlayBtnClass(isMobile))}
      >
        {createBlockMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Lock className="mr-2 h-4 w-4" />
        )}
        {t('partnerCal_blockSubmit')}
      </Button>
    </CalendarOverlayFooter>
  )

  const renderBookingBody = () => (
    <div className={cn('grid gap-4', !isMobile && 'max-h-[60vh] overflow-y-auto')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>{t('partnerCal_labelCheckIn')}</Label>
          <Input type="date" value={actionModal.date || ''} disabled className="mt-1 min-h-11" />
        </div>
        <div>
          <Label>{t('partnerCal_labelCheckOut')}</Label>
          <Input
            type="date"
            value={bookingForm.checkOut}
            min={actionModal.date}
            onChange={(e) => setBookingForm((prev) => ({ ...prev, checkOut: e.target.value }))}
            className="mt-1 min-h-11"
          />
        </div>
      </div>
      <div>
        <Label>{t('partnerCal_guestName')}</Label>
        <Input
          value={bookingForm.guestName}
          onChange={(e) => setBookingForm((prev) => ({ ...prev, guestName: e.target.value }))}
          placeholder={t('partnerCal_guestNamePh')}
          className="mt-1 min-h-11"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>{t('partnerCal_phone')}</Label>
          <Input
            type="tel"
            value={bookingForm.guestPhone}
            onChange={(e) => setBookingForm((prev) => ({ ...prev, guestPhone: e.target.value }))}
            placeholder={t('partnerCal_phonePh')}
            className="mt-1 min-h-11"
          />
        </div>
        <div>
          <Label>{t('partnerCal_email')}</Label>
          <Input
            type="email"
            value={bookingForm.guestEmail}
            onChange={(e) => setBookingForm((prev) => ({ ...prev, guestEmail: e.target.value }))}
            placeholder={t('partnerCal_emailPh')}
            className="mt-1 min-h-11"
          />
        </div>
      </div>
      <div>
        <Label>{t('partnerCal_amountThb')}</Label>
        <Input
          type="number"
          value={bookingForm.priceThb}
          onChange={(e) => setBookingForm((prev) => ({ ...prev, priceThb: e.target.value }))}
          placeholder={getUIText('partnerCal_basePriceHint', language).replace(
            '{{price}}',
            fp(actionModal.listing?.basePriceThb || 0),
          )}
          className="mt-1 min-h-11"
        />
      </div>
      <div>
        <Label>{t('partnerCal_notes')}</Label>
        <Textarea
          value={bookingForm.notes}
          onChange={(e) => setBookingForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder={t('partnerCal_notesPh')}
          className="mt-1"
        />
      </div>
    </div>
  )

  const renderBookingFooter = () => (
    <CalendarOverlayFooter>
      <Button
        variant="outline"
        className={overlayBtnClass(isMobile)}
        onClick={() => setActionModal((prev) => ({ ...prev, type: 'select' }))}
      >
        {t('partnerCal_back')}
      </Button>
      <Button
        onClick={onBookingSubmit}
        disabled={
          createBookingMutation.isPending || !bookingForm.guestName || !bookingForm.checkOut
        }
        variant="brand"
        className={overlayBtnClass(isMobile)}
      >
        {createBookingMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-2 h-4 w-4" />
        )}
        {t('partnerCal_create')}
      </Button>
    </CalendarOverlayFooter>
  )

  const renderHoldInfoBody = () => (
    <div className="space-y-3 text-sm text-slate-700">
      <p className="leading-relaxed">
        {buildBlockedCellTitle(actionModal.cellData, t, trTpl, language)}
      </p>
      {actionModal.cellData?.blockExpiresAt ? (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span>
            {trTpl(t('partnerCal_holdExpiresAt'), {
              expires: formatBlockExpiresAt(actionModal.cellData.blockExpiresAt, language),
            })}
          </span>
        </p>
      ) : null}
    </div>
  )

  const renderBlockedIcalBody = () => {
    const cell = actionModal.cellData
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p className="leading-relaxed">
          {buildBlockedCellTitle(cell, t, trTpl, language)}
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span>{t('partnerCal_blockedIcalBody')}</span>
        </p>
      </div>
    )
  }

  const renderBlockedManualBody = () => {
    const cell = actionModal.cellData
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p className="leading-relaxed">
          {buildBlockedCellTitle(cell, t, trTpl, language)}
        </p>
        {cell?.reason ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600">{cell.reason}</p>
        ) : null}
        <p className="text-xs text-slate-500">{t('partnerCal_unblockHint')}</p>
      </div>
    )
  }

  const renderBlockedManualFooter = () => (
    <CalendarOverlayFooter>
      <Button variant="outline" className={overlayBtnClass(isMobile)} onClick={closeActionModal}>
        {t('partnerCal_cancel')}
      </Button>
      <Button
        variant="brand"
        className={overlayBtnClass(isMobile)}
        disabled={deleteBlockMutation?.isPending || !actionModal.cellData?.blockId}
        onClick={onUnblockSubmit}
      >
        {deleteBlockMutation?.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Unlock className="mr-2 h-4 w-4" />
        )}
        {t('partnerCal_unblockSubmit')}
      </Button>
    </CalendarOverlayFooter>
  )

  const renderBookedInfoBody = () => {
    const cell = actionModal.cellData
    const statusLabel = getBookingStatusLabel(cell?.bookingStatus, t, language)
    const checkOutLabel = actionModal.checkOutDate
      ? formatSheetDate(actionModal.checkOutDate, language)
      : '—'

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('partnerCal_bookedGuest')}
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">
              {cell?.guestName || t('partnerCal_guestShort')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('partnerCal_bookedStatus')}
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-800">{statusLabel}</p>
          </div>
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>
              {trTpl(t('partnerCal_bookedDates'), {
                checkIn: tappedDateLabel,
                checkOut: checkOutLabel,
              })}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const renderBookedInfoFooter = () => (
    <CalendarOverlayFooter>
      <Button variant="outline" className={overlayBtnClass(isMobile)} onClick={closeActionModal}>
        {t('partnerCal_cancel')}
      </Button>
      {actionModal.cellData?.bookingId ? (
        <Button asChild variant="brand" className={overlayBtnClass(isMobile)}>
          <Link href={`/partner/bookings/${actionModal.cellData.bookingId}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('partnerCal_viewBooking')}
          </Link>
        </Button>
      ) : null}
    </CalendarOverlayFooter>
  )

  const actionTitle = () => {
    if (actionModal.type === 'select') return t('partnerCal_selectAction')
    if (actionModal.type === 'block') return t('partnerCal_blockModalTitle')
    if (actionModal.type === 'booking') return t('partnerCal_bookingModalTitle')
    if (actionModal.type === 'hold-info') return t('partnerCal_holdInfoTitle')
    if (actionModal.type === 'blocked-manual') return t('partnerCal_blockedManualTitle')
    if (actionModal.type === 'blocked-ical') return t('partnerCal_blockedIcalTitle')
    if (actionModal.type === 'booked-info') return t('partnerCal_bookedInfoTitle')
    return ''
  }

  const actionDescription = () => {
    if (actionModal.type === 'select') {
      return `${listingTitle}${selectPeriodLabel ? ` • ${selectPeriodLabel}` : ''}`
    }
    if (['block', 'booking', 'blocked-manual', 'booked-info'].includes(actionModal.type)) {
      return listingTitle
    }
    if (actionModal.type === 'hold-info') {
      return `${listingTitle}${tappedDateLabel ? ` • ${tappedDateLabel}` : ''}`
    }
    if (actionModal.type === 'blocked-ical') {
      return `${listingTitle}${tappedDateLabel ? ` • ${tappedDateLabel}` : ''}`
    }
    return undefined
  }

  const actionBody = () => {
    switch (actionModal.type) {
      case 'select':
        return renderSelectBody()
      case 'block':
        return renderBlockBody()
      case 'booking':
        return renderBookingBody()
      case 'hold-info':
        return renderHoldInfoBody()
      case 'blocked-manual':
        return renderBlockedManualBody()
      case 'blocked-ical':
        return renderBlockedIcalBody()
      case 'booked-info':
        return renderBookedInfoBody()
      default:
        return null
    }
  }

  const actionFooter = () => {
    switch (actionModal.type) {
      case 'block':
        return renderBlockFooter()
      case 'booking':
        return renderBookingFooter()
      case 'hold-info':
        return (
          <CalendarOverlayFooter>
            <Button type="button" className={overlayBtnClass(isMobile)} onClick={closeActionModal}>
              {t('partnerCal_holdInfoClose')}
            </Button>
          </CalendarOverlayFooter>
        )
      case 'blocked-manual':
        return renderBlockedManualFooter()
      case 'blocked-ical':
        return (
          <CalendarOverlayFooter>
            <Button type="button" className={overlayBtnClass(isMobile)} onClick={closeActionModal}>
              {t('partnerCal_holdInfoClose')}
            </Button>
          </CalendarOverlayFooter>
        )
      case 'booked-info':
        return renderBookedInfoFooter()
      default:
        return null
    }
  }

  const renderPriceBody = () => (
    <div className="grid gap-4">
      <div>
        <Label>{t('partnerCal_listing')}</Label>
        <Select
          value={priceForm.listingId}
          onValueChange={(v) => setPriceForm((prev) => ({ ...prev, listingId: v }))}
        >
          <SelectTrigger className="mt-1 min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('partnerCal_allListings')}</SelectItem>
            {listings.map((item) => (
              <SelectItem key={item.listing.id} value={item.listing.id}>
                {item.listing.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>{t('partnerCal_periodStart')}</Label>
          <Input
            type="date"
            value={priceForm.startDate}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, startDate: e.target.value }))}
            className="mt-1 min-h-11"
          />
        </div>
        <div>
          <Label>{t('partnerCal_periodEnd')}</Label>
          <Input
            type="date"
            value={priceForm.endDate}
            min={priceForm.startDate}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, endDate: e.target.value }))}
            className="mt-1 min-h-11"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>{t('partnerCal_pricePerDay')}</Label>
          <Input
            type="number"
            value={priceForm.priceDaily}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, priceDaily: e.target.value }))}
            placeholder={t('partnerCal_pricePh')}
            className="mt-1 min-h-11"
          />
        </div>
        <div>
          <Label>{t('partnerCal_seasonType')}</Label>
          <Select
            value={priceForm.seasonType}
            onValueChange={(v) => setPriceForm((prev) => ({ ...prev, seasonType: v }))}
          >
            <SelectTrigger className="mt-1 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">{t('partnerCal_seasonLow')}</SelectItem>
              <SelectItem value="HIGH">{t('partnerCal_seasonHigh')}</SelectItem>
              <SelectItem value="PEAK">{t('partnerCal_seasonPeak')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>{t('partnerCal_minNights')}</Label>
        <Input
          type="number"
          min="1"
          value={priceForm.minStay}
          onChange={(e) => setPriceForm((prev) => ({ ...prev, minStay: e.target.value }))}
          placeholder="1"
          className="mt-1 min-h-11"
        />
        <p className="mt-1 text-xs text-slate-500">{t('partnerCal_minNightsHint')}</p>
      </div>
      <div>
        <Label>{t('partnerCal_labelNameOptional')}</Label>
        <Input
          value={priceForm.label}
          onChange={(e) => setPriceForm((prev) => ({ ...prev, label: e.target.value }))}
          placeholder={t('partnerCal_labelNamePh')}
          className="mt-1 min-h-11"
        />
      </div>
      <div className="rounded-lg border border-brand/25 bg-brand/10 p-3 text-sm text-brand">
        <p className="mb-1 font-medium">🔧 {t('partnerCal_conflictTitle')}</p>
        <p className="text-xs text-brand-hover">{t('partnerCal_conflictBody')}</p>
      </div>
    </div>
  )

  const renderPriceFooter = () => (
    <CalendarOverlayFooter>
      <Button
        variant="outline"
        className={overlayBtnClass(isMobile)}
        onClick={() => setPriceModal({ open: false })}
      >
        {t('partnerCal_cancel')}
      </Button>
      <Button
        onClick={onPriceSubmit}
        disabled={priceSubmitPending || !priceForm.priceDaily}
        variant="brand"
        className={overlayBtnClass(isMobile)}
      >
        {priceSubmitPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-2 h-4 w-4" />
        )}
        {t('partnerCal_apply')}
      </Button>
    </CalendarOverlayFooter>
  )

  return (
    <>
      <CalendarActionOverlay
        open={actionModal.open}
        onOpenChange={actionOpenChange}
        isMobile={isMobile}
        title={actionTitle()}
        description={actionDescription()}
        footer={actionFooter()}
      >
        {actionBody()}
      </CalendarActionOverlay>

      <CalendarActionOverlay
        open={priceModal.open}
        onOpenChange={(open) => setPriceModal({ open })}
        isMobile={isMobile}
        wide
        title={
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-brand" aria-hidden />
            {t('partnerCal_seasonTitle')}
          </span>
        }
        description={t('partnerCal_seasonDesc')}
        footer={renderPriceFooter()}
      >
        {renderPriceBody()}
      </CalendarActionOverlay>
    </>
  )
}
