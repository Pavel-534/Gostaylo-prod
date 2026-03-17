/**
 * ActionModals Component
 * Modals for blocking dates, creating bookings, and managing seasonal prices
 */

'use client'

import { format, parseISO, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
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
  upsertSeasonalPriceMutation
}) {
  return (
    <>
      {/* Action Modal (Block/Booking Selection) */}
      <Dialog 
        open={actionModal.open} 
        onOpenChange={(open) => setActionModal(prev => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-[425px]">
          {/* Selection View */}
          {actionModal.type === 'select' && (
            <>
              <DialogHeader>
                <DialogTitle>Выберите действие</DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title} • {actionModal.date && format(parseISO(actionModal.date), 'd MMMM yyyy', { locale: ru })}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start"
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'block' }))}
                >
                  <Lock className="h-5 w-5 mr-3 text-slate-500" />
                  <div className="text-left">
                    <div className="font-medium">Заблокировать даты</div>
                    <div className="text-xs text-slate-500">Для обслуживания или личного использования</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start"
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'booking' }))}
                >
                  <User className="h-5 w-5 mr-3 text-teal-600" />
                  <div className="text-left">
                    <div className="font-medium">Создать бронирование</div>
                    <div className="text-xs text-slate-500">Для офлайн продаж</div>
                  </div>
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
                  Заблокировать даты
                </DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Начало</Label>
                    <Input 
                      type="date" 
                      value={actionModal.date || ''} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Конец</Label>
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
                  <Label>Тип блокировки</Label>
                  <Select 
                    value={blockForm.type} 
                    onValueChange={(v) => setBlockForm(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER_USE">Личное использование</SelectItem>
                      <SelectItem value="MAINTENANCE">Техническое обслуживание</SelectItem>
                      <SelectItem value="OTHER">Другое</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Причина (необязательно)</Label>
                  <Textarea
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Укажите причину блокировки..."
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'select' }))}
                >
                  Назад
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
                  Заблокировать
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
                  Создать бронирование
                </DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Заезд</Label>
                    <Input 
                      type="date" 
                      value={actionModal.date || ''} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Выезд *</Label>
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
                  <Label>Имя гостя *</Label>
                  <Input 
                    value={bookingForm.guestName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, guestName: e.target.value }))}
                    placeholder="Иван Петров"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Телефон</Label>
                    <Input 
                      type="tel"
                      value={bookingForm.guestPhone}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, guestPhone: e.target.value }))}
                      placeholder="+7 999 123 4567"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={bookingForm.guestEmail}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                      placeholder="email@example.com"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Сумма (THB)</Label>
                  <Input 
                    type="number"
                    value={bookingForm.priceThb}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, priceThb: e.target.value }))}
                    placeholder={`Базовая цена: ${formatPrice(actionModal.listing?.basePriceThb || 0, 'THB')}/ночь`}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label>Заметки</Label>
                  <Textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Дополнительная информация..."
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'select' }))}
                >
                  Назад
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
                  Создать
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
              Управление сезонными ценами
            </DialogTitle>
            <DialogDescription>
              Установите цены для выбранного периода. Система автоматически разрешит конфликты дат.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Listing Selection */}
            <div>
              <Label>Объект</Label>
              <Select 
                value={priceForm.listingId} 
                onValueChange={(v) => setPriceForm(prev => ({ ...prev, listingId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все объекты</SelectItem>
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
                <Label>Начало периода</Label>
                <Input 
                  type="date" 
                  value={priceForm.startDate}
                  onChange={(e) => setPriceForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Конец периода</Label>
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
                <Label>Цена (THB/день) *</Label>
                <Input 
                  type="number"
                  value={priceForm.priceDaily}
                  onChange={(e) => setPriceForm(prev => ({ ...prev, priceDaily: e.target.value }))}
                  placeholder="3500"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Тип сезона</Label>
                <Select 
                  value={priceForm.seasonType} 
                  onValueChange={(v) => setPriceForm(prev => ({ ...prev, seasonType: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Низкий сезон</SelectItem>
                    <SelectItem value="HIGH">Высокий сезон</SelectItem>
                    <SelectItem value="PEAK">Пиковый сезон</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Min Stay */}
            <div>
              <Label>Минимум ночей</Label>
              <Input 
                type="number"
                min="1"
                value={priceForm.minStay}
                onChange={(e) => setPriceForm(prev => ({ ...prev, minStay: e.target.value }))}
                placeholder="1"
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Гости должны забронировать минимум указанное количество ночей
              </p>
            </div>
            
            {/* Label */}
            <div>
              <Label>Название (необязательно)</Label>
              <Input 
                value={priceForm.label}
                onChange={(e) => setPriceForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Новый год, Рождество..."
                className="mt-1"
              />
            </div>
            
            {/* Info Box */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-900">
              <p className="font-medium mb-1">🔧 Автоматическое разрешение конфликтов</p>
              <p className="text-xs text-teal-700">
                Если выбранный период пересекается с существующими ценами, система автоматически разделит или обрежет старые диапазоны. Перекрытий не будет.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPriceModal({ open: false })}
            >
              Отмена
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
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
