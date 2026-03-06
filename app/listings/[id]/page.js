'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, Star, ArrowLeft, ChevronLeft, ChevronRight, 
  Bed, Bath, Square, Calendar, Send, Loader2, User,
  Wifi, Car, Waves, Utensils, Info, Calculator
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'
import { detectLanguage, getUIText, getListingText, supportedLanguages } from '@/lib/translations'
import { PricingService } from '@/lib/services/pricing.service'
import { ReviewsSection } from '@/components/reviews-section'
import { useAuth } from '@/contexts/auth-context'

export default function ListingDetail({ params }) {
  const router = useRouter()
  const { user, openLoginModal } = useAuth()
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [language, setLanguage] = useState('ru')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({})
  
  // Blocked dates for calendar grey-out
  const [blockedDates, setBlockedDates] = useState([])
  
  // Form state
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [message, setMessage] = useState('')
  
  // Price calculation state
  const [priceCalc, setPriceCalc] = useState(null)

  // Load blocked dates for calendar
  useEffect(() => {
    if (params?.id) {
      loadBlockedDates()
    }
  }, [params?.id])

  async function loadBlockedDates() {
    try {
      const res = await fetch(`/api/v2/listings/${params.id}/availability`)
      const data = await res.json()
      if (data.success) {
        setBlockedDates(data.data.blockedDates || [])
      }
    } catch (error) {
      console.error('Failed to load availability:', error)
    }
  }

  // Check if date is blocked
  function isDateBlocked(dateStr) {
    return blockedDates.includes(dateStr)
  }

  // Load currency preference and listen for changes
  useEffect(() => {
    // Load saved currency
    const savedCurrency = localStorage.getItem('gostaylo_currency')
    if (savedCurrency) setCurrency(savedCurrency)

    // Load exchange rates
    async function loadRates() {
      try {
        const { fetchExchangeRates } = await import('@/lib/client-data')
        const rates = await fetchExchangeRates()
        setExchangeRates(rates)
      } catch (e) {
        console.error('Failed to load exchange rates:', e)
      }
    }
    loadRates()

    // Listen for currency changes
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  // Price conversion function
  function convertPrice(priceThb) {
    if (!priceThb) return 0
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency]
    return rate ? priceThb / rate : priceThb
  }

  // Localized labels
  const labels = {
    ru: {
      backToSearch: 'Вернуться к поиску',
      available: 'Доступно',
      unavailable: 'Занято',
      reviews: 'отзывов',
      description: 'Описание',
      features: 'Характеристики',
      bedrooms: 'спален',
      bathrooms: 'ванных',
      area: 'м²',
      wifi: 'Wi-Fi',
      pool: 'Бассейн',
      parking: 'Парковка',
      kitchen: 'Кухня',
      price: 'Цена',
      perDay: 'в день',
      bookNow: 'Забронировать',
      bookingRequest: 'Заявка на бронирование',
      yourName: 'Ваше имя',
      email: 'Email',
      phone: 'Телефон',
      checkInDate: 'Дата заезда',
      checkOutDate: 'Дата выезда',
      messageLabel: 'Сообщение',
      messagePlaceholder: 'Особые пожелания...',
      submit: 'Отправить заявку',
      submitting: 'Отправка...',
      notFound: 'Объявление не найдено',
      notFoundDesc: 'Это объявление было удалено или не существует.',
      goHome: 'На главную',
      successMsg: 'Заявка отправлена! Ожидайте подтверждения.',
      errorMsg: 'Ошибка при создании заявки',
      priceBreakdown: 'Расчёт стоимости',
      nights: 'ночей',
      night: 'ночь',
      total: 'Итого к оплате',
      basePrice: 'Базовая цена',
      selectDates: 'Выберите даты для расчёта',
      avgPerNight: 'в среднем за ночь',
      rental: 'Стоимость аренды',
      serviceFee: 'Сервисный сбор',
      discount: 'Скидка',
      deal: 'Выгодно!'
    },
    en: {
      backToSearch: 'Back to search',
      available: 'Available',
      unavailable: 'Unavailable',
      reviews: 'reviews',
      description: 'Description',
      features: 'Features',
      bedrooms: 'bedrooms',
      bathrooms: 'bathrooms',
      area: 'm²',
      wifi: 'Wi-Fi',
      pool: 'Pool',
      parking: 'Parking',
      kitchen: 'Kitchen',
      price: 'Price',
      perDay: 'per day',
      bookNow: 'Book Now',
      bookingRequest: 'Booking Request',
      yourName: 'Your name',
      email: 'Email',
      phone: 'Phone',
      checkInDate: 'Check-in date',
      checkOutDate: 'Check-out date',
      messageLabel: 'Message',
      messagePlaceholder: 'Special requests...',
      submit: 'Submit Request',
      submitting: 'Submitting...',
      notFound: 'Listing not found',
      notFoundDesc: 'This listing has been removed or does not exist.',
      goHome: 'Go Home',
      successMsg: 'Request submitted! Awaiting confirmation.',
      errorMsg: 'Error creating request',
      priceBreakdown: 'Price Breakdown',
      nights: 'nights',
      night: 'night',
      total: 'Total to Pay',
      basePrice: 'Base price',
      selectDates: 'Select dates to calculate',
      avgPerNight: 'avg per night',
      rental: 'Rental cost',
      serviceFee: 'Service fee',
      discount: 'Discount',
      deal: 'Deal!'
    },
    zh: {
      backToSearch: '返回搜索',
      available: '可预订',
      unavailable: '已预订',
      reviews: '条评价',
      description: '描述',
      features: '特征',
      bedrooms: '间卧室',
      bathrooms: '间浴室',
      area: '平方米',
      wifi: '无线网络',
      pool: '游泳池',
      parking: '停车场',
      kitchen: '厨房',
      price: '价格',
      perDay: '每天',
      bookNow: '立即预订',
      bookingRequest: '预订申请',
      yourName: '您的姓名',
      email: '邮箱',
      phone: '电话',
      checkInDate: '入住日期',
      checkOutDate: '退房日期',
      messageLabel: '留言',
      messagePlaceholder: '特殊要求...',
      submit: '提交申请',
      submitting: '提交中...',
      notFound: '未找到房源',
      notFoundDesc: '此房源已被删除或不存在。',
      goHome: '返回首页',
      successMsg: '申请已提交！等待确认。',
      errorMsg: '创建申请时出错',
      priceBreakdown: '价格明细',
      nights: '晚',
      night: '晚',
      total: '应付总额',
      basePrice: '基础价格',
      selectDates: '选择日期计算',
      avgPerNight: '平均每晚',
      rental: '租金',
      serviceFee: '服务费',
      discount: '折扣',
      deal: '优惠!'
    },
    th: {
      backToSearch: 'กลับไปค้นหา',
      available: 'ว่าง',
      unavailable: 'ไม่ว่าง',
      reviews: 'รีวิว',
      description: 'รายละเอียด',
      features: 'สิ่งอำนวยความสะดวก',
      bedrooms: 'ห้องนอน',
      bathrooms: 'ห้องน้ำ',
      area: 'ตร.ม.',
      wifi: 'Wi-Fi',
      pool: 'สระว่ายน้ำ',
      parking: 'ที่จอดรถ',
      kitchen: 'ห้องครัว',
      price: 'ราคา',
      perDay: 'ต่อวัน',
      bookNow: 'จองเลย',
      bookingRequest: 'คำขอจอง',
      yourName: 'ชื่อของคุณ',
      email: 'อีเมล',
      phone: 'โทรศัพท์',
      checkInDate: 'วันเช็คอิน',
      checkOutDate: 'วันเช็คเอาท์',
      messageLabel: 'ข้อความ',
      messagePlaceholder: 'คำขอพิเศษ...',
      submit: 'ส่งคำขอ',
      submitting: 'กำลังส่ง...',
      notFound: 'ไม่พบรายการ',
      notFoundDesc: 'รายการนี้ถูกลบหรือไม่มีอยู่',
      goHome: 'กลับหน้าแรก',
      successMsg: 'ส่งคำขอแล้ว! รอการยืนยัน',
      errorMsg: 'เกิดข้อผิดพลาดในการสร้างคำขอ',
      priceBreakdown: 'รายละเอียดราคา',
      nights: 'คืน',
      night: 'คืน',
      total: 'ยอดชำระ',
      basePrice: 'ราคาพื้นฐาน',
      selectDates: 'เลือกวันที่เพื่อคำนวณ',
      avgPerNight: 'เฉลี่ยต่อคืน',
      rental: 'ค่าเช่า',
      serviceFee: 'ค่าบริการ',
      discount: 'ส่วนลด',
      deal: 'คุ้มค่า!'
    }
  }

  // Get current language labels
  const t = labels[language] || labels.ru
  
  // Service fee rate (15%)
  const SERVICE_FEE_RATE = 0.15
  
  // Calculate price when dates change - includes service fee
  useEffect(() => {
    if (listing && checkIn && checkOut) {
      const seasonalPricing = listing.metadata?.seasonal_pricing || []
      const result = PricingService.calculateBookingPriceSync(
        listing.basePriceThb,
        checkIn,
        checkOut,
        seasonalPricing
      )
      
      if (!result.error) {
        // Calculate base price without seasonal adjustments for comparison
        const baseTotalWithoutSeasonal = listing.basePriceThb * result.nights
        
        // Calculate service fee
        const serviceFee = Math.round(result.totalPrice * SERVICE_FEE_RATE)
        const grandTotal = result.totalPrice + serviceFee
        
        // Determine if this is a discount (seasonal price < base price)
        const isDiscount = result.totalPrice < baseTotalWithoutSeasonal
        const discountAmount = isDiscount ? baseTotalWithoutSeasonal - result.totalPrice : 0
        const surchargeAmount = !isDiscount ? result.totalPrice - baseTotalWithoutSeasonal : 0
        
        setPriceCalc({
          ...result,
          baseTotalWithoutSeasonal,
          serviceFee,
          grandTotal,
          isDiscount,
          discountAmount,
          surchargeAmount
        })
      } else {
        setPriceCalc(null)
      }
    } else {
      setPriceCalc(null)
    }
  }, [listing, checkIn, checkOut])

  useEffect(() => {
    // Detect language from localStorage
    const detectedLang = detectLanguage()
    setLanguage(detectedLang)
    
    loadListing()
    loadReviews()
  }, [params.id])

  async function loadListing() {
    try {
      // Fetch directly from Supabase (bypasses Kubernetes routing)
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${params.id}&select=*,categories(id,name,slug,icon)`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const data = await res.json();
      
      if (data && data.length > 0) {
        const l = data[0];
        setListing({
          id: l.id,
          ownerId: l.owner_id,
          categoryId: l.category_id,
          category: l.categories,
          status: l.status,
          title: l.title,
          description: l.description,
          district: l.district,
          address: l.address,
          basePriceThb: parseFloat(l.base_price_thb),
          images: l.images || [],
          coverImage: l.cover_image,
          metadata: l.metadata || {},
          available: l.available,
          isFeatured: l.is_featured,
          views: l.views || 0,
          rating: parseFloat(l.rating) || 0,
          reviewsCount: l.reviews_count || 0,
          seasonalPricing: l.metadata?.seasonal_pricing || []
        });
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
    }
  }

  async function loadReviews() {
    // Reviews not implemented yet - skip for now
    setReviews([])
  }

  async function handleBookingSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Calculate final price with service fee
      const basePrice = priceCalc ? priceCalc.totalPrice : listing.basePriceThb
      const serviceFee = Math.round(basePrice * SERVICE_FEE_RATE)
      const finalPrice = basePrice + serviceFee
      
      // Use API route instead of direct Supabase call (bypasses RLS)
      const res = await fetch('/api/v2/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          checkIn: checkIn,
          checkOut: checkOut,
          guestName: guestName,
          guestEmail: guestEmail,
          guestPhone: guestPhone,
          specialRequests: message || null,
          currency: 'THB'
        })
      })
      
      const data = await res.json()
      
      if (data.success && data.booking) {
        toast.success(t.successMsg)
        setBookingModalOpen(false)
        router.push(`/checkout/${data.booking.id}`)
      } else {
        const errorMsg = data?.error || 'Unknown error'
        console.error('[BOOKING] Error:', errorMsg)
        toast.error(`${t.errorMsg}: ${errorMsg}`)
      }
    } catch (error) {
      console.error('[BOOKING] Exception:', error)
      toast.error(`${t.errorMsg}: ${error.message}`)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{t.notFound}</h3>
            <p className="text-slate-600 mb-4">{t.notFoundDesc}</p>
            <Button asChild>
              <Link href="/">{t.goHome}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % listing.images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + listing.images.length) % listing.images.length)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium">
            <ArrowLeft className="h-5 w-5 mr-1" />
            {t.backToSearch}
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Image Gallery */}
        <div className="relative h-96 md:h-[500px] rounded-2xl overflow-hidden mb-8 group">
          <img
            src={listing.images[currentImageIndex]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
          
          {listing.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {listing.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex
                        ? 'bg-white w-8'
                        : 'bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Info */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold text-slate-900">
                  {getListingText(listing, 'title', language)}
                </h1>
                <Badge className={listing.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {listing.status === 'ACTIVE' ? t.available : t.unavailable}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{listing.district}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{listing.rating || 0}</span>
                  <span className="text-sm">({listing.reviewsCount || 0} {t.reviews})</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>{t.description}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed">
                  {getListingText(listing, 'description', language)}
                </p>
              </CardContent>
            </Card>

            {/* Amenities */}
            {listing.metadata && (
              <Card>
                <CardHeader>
                  <CardTitle>{t.features}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {listing.metadata.bedrooms && (
                      <div className="flex items-center gap-2">
                        <Bed className="h-5 w-5 text-teal-600" />
                        <span>{listing.metadata.bedrooms} {t.bedrooms}</span>
                      </div>
                    )}
                    {listing.metadata.bathrooms && (
                      <div className="flex items-center gap-2">
                        <Bath className="h-5 w-5 text-teal-600" />
                        <span>{listing.metadata.bathrooms} {t.bathrooms}</span>
                      </div>
                    )}
                    {listing.metadata.area && (
                      <div className="flex items-center gap-2">
                        <Square className="h-5 w-5 text-teal-600" />
                        <span>{listing.metadata.area} {t.area}</span>
                      </div>
                    )}
                    {listing.metadata.wifi && (
                      <div className="flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-teal-600" />
                        <span>{t.wifi}</span>
                      </div>
                    )}
                    {listing.metadata.pool && (
                      <div className="flex items-center gap-2">
                        <Waves className="h-5 w-5 text-teal-600" />
                        <span>{t.pool}</span>
                      </div>
                    )}
                    {listing.metadata.parking && (
                      <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-teal-600" />
                        <span>{t.parking}</span>
                      </div>
                    )}
                    {listing.metadata.kitchen && (
                      <div className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-teal-600" />
                        <span>{t.kitchen}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews Section */}
            <ReviewsSection listingId={params?.id} language={language} />
          </div>

          {/* Sidebar - Booking Card */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-teal-600">
                    {formatPrice(convertPrice(listing.basePriceThb), currency)}
                  </span>
                  <span className="text-slate-600">/ {t.perDay}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
                  <DialogTrigger asChild>
                    <Button className='w-full bg-teal-600 hover:bg-teal-700 text-lg py-6' data-testid='book-now-btn'>
                      {t.bookNow}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                      <DialogTitle>{t.bookingRequest}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleBookingSubmit} className='space-y-4 pb-4'>
                      <div>
                        <Label>{t.yourName}</Label>
                        <Input
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          required
                          className='h-12'
                          data-testid='guest-name-input'
                        />
                      </div>
                      <div>
                        <Label>{t.email}</Label>
                        <Input
                          type='email'
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          required
                          className='h-12'
                          data-testid='guest-email-input'
                        />
                      </div>
                      <div>
                        <Label>{t.phone}</Label>
                        <Input
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          required
                          className='h-12'
                          data-testid='guest-phone-input'
                        />
                      </div>
                      <div className='grid grid-cols-2 gap-3'>
                        <div>
                          <Label>{t.checkInDate}</Label>
                          <Input
                            type='date'
                            value={checkIn}
                            onChange={(e) => {
                              const newDate = e.target.value
                              if (isDateBlocked(newDate)) {
                                toast.error(language === 'ru' ? 'Эта дата уже занята' : 'This date is not available')
                                return
                              }
                              setCheckIn(newDate)
                            }}
                            min={new Date().toISOString().split('T')[0]}
                            required
                            className='h-12'
                            data-testid='check-in-input'
                          />
                        </div>
                        <div>
                          <Label>{t.checkOutDate}</Label>
                          <Input
                            type='date'
                            value={checkOut}
                            onChange={(e) => {
                              const newDate = e.target.value
                              // Check all dates between checkIn and newDate
                              if (checkIn) {
                                const start = new Date(checkIn)
                                const end = new Date(newDate)
                                let current = new Date(start)
                                while (current < end) {
                                  const dateStr = current.toISOString().split('T')[0]
                                  if (isDateBlocked(dateStr)) {
                                    toast.error(language === 'ru' ? 'Некоторые даты в этом диапазоне уже заняты' : 'Some dates in this range are not available')
                                    return
                                  }
                                  current.setDate(current.getDate() + 1)
                                }
                              }
                              setCheckOut(newDate)
                            }}
                            min={checkIn || new Date().toISOString().split('T')[0]}
                            required
                            className='h-12'
                            data-testid='check-out-input'
                          />
                        </div>
                      </div>
                      
                      {/* Blocked dates info */}
                      {blockedDates.length > 0 && (
                        <p className='text-xs text-amber-600 flex items-center gap-1'>
                          <Info className='h-3 w-3' />
                          {language === 'ru' 
                            ? 'Некоторые даты недоступны для бронирования'
                            : 'Some dates are not available for booking'}
                        </p>
                      )}
                      
                      {/* Price Breakdown Section with Service Fee */}
                      {priceCalc ? (
                        <div className='bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 border border-teal-200' data-testid='price-breakdown'>
                          <div className='flex items-center gap-2 mb-3'>
                            <Calculator className='h-4 w-4 text-teal-600' />
                            <span className='font-medium text-teal-800'>{t.priceBreakdown}</span>
                            {priceCalc.isDiscount && (
                              <Badge className='bg-green-500 text-white text-xs'>{t.deal}</Badge>
                            )}
                          </div>
                          
                          {/* Rental cost with discount display */}
                          <div className='space-y-2 mb-3'>
                            <div className='flex justify-between text-sm'>
                              <span className='text-slate-600'>
                                {t.rental} ({priceCalc.nights} {priceCalc.nights === 1 ? t.night : t.nights})
                              </span>
                              <div className='text-right'>
                                {priceCalc.isDiscount ? (
                                  <>
                                    <span className='text-slate-400 line-through text-xs mr-2'>
                                      {formatPrice(convertPrice(priceCalc.baseTotalWithoutSeasonal), currency)}
                                    </span>
                                    <span className='font-medium text-green-600'>
                                      {formatPrice(convertPrice(priceCalc.totalPrice), currency)}
                                    </span>
                                  </>
                                ) : (
                                  <span className='font-medium'>{formatPrice(convertPrice(priceCalc.totalPrice), currency)}</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Show discount amount if applicable */}
                            {priceCalc.isDiscount && priceCalc.discountAmount > 0 && (
                              <div className='flex justify-between text-sm text-green-600'>
                                <span className='flex items-center gap-1'>
                                  🎉 {t.discount}
                                </span>
                                <span className='font-medium'>-{formatPrice(convertPrice(priceCalc.discountAmount), currency)}</span>
                              </div>
                            )}
                            
                            {/* Service fee (15%) */}
                            <div className='flex justify-between text-sm'>
                              <span className='text-slate-600'>{t.serviceFee} (15%)</span>
                              <span className='font-medium'>{formatPrice(convertPrice(priceCalc.serviceFee), currency)}</span>
                            </div>
                          </div>
                          
                          <Separator className='my-3' />
                          
                          {/* Grand Total - matches checkout page */}
                          <div className='flex justify-between items-center'>
                            <div>
                              <span className='font-bold text-teal-800'>{t.total}</span>
                              <p className='text-xs text-slate-500'>
                                {formatPrice(convertPrice(Math.round(priceCalc.grandTotal / priceCalc.nights)), currency)} {t.avgPerNight}
                              </p>
                            </div>
                            <span className='text-2xl font-bold text-teal-600' data-testid='grand-total'>
                              {formatPrice(convertPrice(priceCalc.grandTotal), currency)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className='bg-slate-50 rounded-lg p-4 border border-slate-200'>
                          <div className='flex items-center gap-2 text-slate-500'>
                            <Info className='h-4 w-4' />
                            <span className='text-sm'>{t.selectDates}</span>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Label>{t.messageLabel}</Label>
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={t.messagePlaceholder}
                          className='min-h-[80px]'
                        />
                      </div>
                      <Button
                        type='submit'
                        className='w-full bg-teal-600 hover:bg-teal-700 h-12 text-base'
                        disabled={submitting || !priceCalc}
                        data-testid='submit-booking-btn'
                      >
                        {submitting ? (
                          <>
                            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                            {t.submitting}
                          </>
                        ) : (
                          <>
                            <Send className='h-4 w-4 mr-2' />
                            {t.submit} {priceCalc && `(฿${priceCalc.grandTotal.toLocaleString()})`}
                          </>
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
