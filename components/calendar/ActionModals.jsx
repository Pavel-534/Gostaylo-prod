/**
 * ActionModals Component
 * Modals for blocking dates, creating bookings, and managing seasonal prices
 */

'use client'

import { format, parseISO, addDays } from 'date-fns'
import { ru as ruLocale, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { 
  Lock, User, Check, Loader2, X, DollarSign 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'

const DF_LOCALE = { ru: ruLocale, en: enUS, zh: zhCN, th: thLocale }

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
  createBlockMutation,
  createBookingMutation,
  upsertSeasonalPriceMutation,
  language = 'ru',
  exchangeRates = { THB: 1 },
}) {
  const dfLoc = DF_LOCALE[String(language || 'ru').slice(0, 2)] || ruLocale
  const fp = (amountThb) => formatPrice(amountThb, 'THB', exchangeRates, language)
  const t = (key) => getUIText(key, language)

  return (
    <>
      {/* Action Modal (Block/Booking Selection) */}
      <Dialog 
        open={actionModal.open} 
        onOpenChange={(open) => setActionModal(prev => ({ ...prev, open }))}
      >
        <DialogContent className="w-[min(100vw-2rem,28rem)] max-w-[min(100vw-2rem,28rem)] gap-0 p-4 sm:w-full sm:max-w-[425px] sm:p-6">
          {/* Selection View */}
          {actionModal.type === 'select' && (
            <>
              <DialogHeader className="space-y-2 pr-8 text-left">
                <DialogTitle className="leading-snug">{t('partnerCal_selectAction')}</DialogTitle>
                <DialogDescription className="break-words text-left leading-snug">
                  {actionModal.listing?.title} •{' '}
                  {actionModal.date && format(parseISO(actionModal.date), 'd MMMM yyyy', { locale: dfLoc })}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-3 pl-3 pr-3 text-left [&_svg]:!size-5"
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'block' }))}
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
                  className="h-auto w-full justify-start whitespace-normal py-3 pl-3 pr-3 text-left [&_svg]:!size-5"
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'booking' }))}
                >
                  <span className="flex w-full min-w-0 items-start gap-3 text-left">
                    <User className="mt-0.5 shrink-0 text-teal-600" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{t('partnerCal_bookingTitleBtn')}</span>
                      <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500">
                        {t('partnerCal_bookingHintBtn')}
                      </span>
                    </span>
                  </span>
                </Button>
              </div>
            </>
          )}
          
          {/* Block Form */}
          {actionModal.type === 'block' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-slate-500" />
                  {t('partnerCal_blockModalTitle')}
                </DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('partnerCal_labelStart')}</Label>
                    <Input 
                      type="date" 
                      value={actionModal.date || ''} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t('partnerCal_labelEnd')}</Label>
                    <Input 
                      type="date" 
                      value={blockForm.endDate}
                      min={actionModal.date}
                      onChange={(e) => setBlockForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>{t('partnerCal_blockType')}</Label>
                  <Select 
                    value={blockForm.type} 
                    onValueChange={(v) => setBlockForm(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger className="mt-1">
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
                    onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder={t('partnerCal_reasonPh')}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'select' }))}
                >
                  {t('partnerCal_back')}
                </Button>
                <Button 
                  onClick={onBlockSubmit}
                  disabled={createBlockMutation.isPending}
                  className="bg-slate-600 hover:bg-slate-700"
                >
                  {createBlockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  {t('partnerCal_blockSubmit')}
                </Button>
              </DialogFooter>
            </>
          )}
          
          {/* Manual Booking Form */}
          {actionModal.type === 'booking' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  {t('partnerCal_bookingModalTitle')}
                </DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('partnerCal_labelCheckIn')}</Label>
                    <Input 
                      type="date" 
                      value={actionModal.date || ''} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t('partnerCal_labelCheckOut')}</Label>
                    <Input 
                      type="date" 
                      value={bookingForm.checkOut}
                      min={actionModal.date}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, checkOut: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>{t('partnerCal_guestName')}</Label>
                  <Input 
                    value={bookingForm.guestName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, guestName: e.target.value }))}
                    placeholder={t('partnerCal_guestNamePh')}
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('partnerCal_phone')}</Label>
                    <Input 
                      type="tel"
                      value={bookingForm.guestPhone}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, guestPhone: e.target.value }))}
                      placeholder={t('partnerCal_phonePh')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t('partnerCal_email')}</Label>
                    <Input 
                      type="email"
                      value={bookingForm.guestEmail}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                      placeholder={t('partnerCal_emailPh')}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>{t('partnerCal_amountThb')}</Label>
                  <Input 
                    type="number"
                    value={bookingForm.priceThb}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, priceThb: e.target.value }))}
                    placeholder={getUIText('partnerCal_basePriceHint', language).replace(
                      '{{price}}',
                      fp(actionModal.listing?.basePriceThb || 0),
                    )}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label>{t('partnerCal_notes')}</Label>
                  <Textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('partnerCal_notesPh')}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'select' }))}
                >
                  {t('partnerCal_back')}
                </Button>
                <Button 
                  onClick={onBookingSubmit}
                  disabled={createBookingMutation.isPending || !bookingForm.guestName || !bookingForm.checkOut}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {createBookingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {t('partnerCal_create')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Seasonal Price Manager Modal */}
      <Dialog 
        open={priceModal.open} 
        onOpenChange={(open) => setPriceModal({ open })}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-teal-600" />
              {t('partnerCal_seasonTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('partnerCal_seasonDesc')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Listing Selection */}
            <div>
              <Label>{t('partnerCal_listing')}</Label>
              <Select 
                value={priceForm.listingId} 
                onValueChange={(v) => setPriceForm(prev => ({ ...prev, listingId: v }))}
              >
                <SelectTrigger className="mt-1">
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
            
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('partnerCal_periodStart')}</Label>
                <Input 
                  type="date" 
                  value={priceForm.startDate}
                  onChange={(e) => setPriceForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('partnerCal_periodEnd')}</Label>
                <Input 
                  type="date" 
                  value={priceForm.endDate}
                  min={priceForm.startDate}
                  onChange={(e) => setPriceForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* Price and Season Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('partnerCal_pricePerDay')}</Label>
                <Input 
                  type="number"
                  value={priceForm.priceDaily}
                  onChange={(e) => setPriceForm(prev => ({ ...prev, priceDaily: e.target.value }))}
                  placeholder={t('partnerCal_pricePh')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('partnerCal_seasonType')}</Label>
                <Select 
                  value={priceForm.seasonType} 
                  onValueChange={(v) => setPriceForm(prev => ({ ...prev, seasonType: v }))}
                >
                  <SelectTrigger className="mt-1">
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
            
            {/* Min Stay */}
            <div>
              <Label>{t('partnerCal_minNights')}</Label>
              <Input 
                type="number"
                min="1"
                value={priceForm.minStay}
                onChange={(e) => setPriceForm(prev => ({ ...prev, minStay: e.target.value }))}
                placeholder="1"
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('partnerCal_minNightsHint')}
              </p>
            </div>
            
            {/* Label */}
            <div>
              <Label>{t('partnerCal_labelNameOptional')}</Label>
              <Input 
                value={priceForm.label}
                onChange={(e) => setPriceForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder={t('partnerCal_labelNamePh')}
                className="mt-1"
              />
            </div>
            
            {/* Info Box */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-900">
              <p className="font-medium mb-1">🔧 {t('partnerCal_conflictTitle')}</p>
              <p className="text-xs text-teal-700">
                {t('partnerCal_conflictBody')}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPriceModal({ open: false })}
            >
              {t('partnerCal_cancel')}
            </Button>
            <Button 
              onClick={onPriceSubmit}
              disabled={upsertSeasonalPriceMutation.isPending || !priceForm.priceDaily}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {upsertSeasonalPriceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t('partnerCal_apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
