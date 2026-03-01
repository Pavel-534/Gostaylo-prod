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

export default function ListingDetail({ params }) {
  const router = useRouter()
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [language, setLanguage] = useState('ru')
  
  // Form state
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [message, setMessage] = useState('')
  
  // Price calculation state
  const [priceCalc, setPriceCalc] = useState(null)

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
      total: 'Итого',
      basePrice: 'Базовая цена',
      selectDates: 'Выберите даты для расчёта',
      avgPerNight: 'в среднем за ночь'
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
      total: 'Total',
      basePrice: 'Base price',
      selectDates: 'Select dates to calculate',
      avgPerNight: 'avg per night'
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
      total: '总计',
      basePrice: '基础价格',
      selectDates: '选择日期计算',
      avgPerNight: '平均每晚'
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
      total: 'รวม',
      basePrice: 'ราคาพื้นฐาน',
      selectDates: 'เลือกวันที่เพื่อคำนวณ',
      avgPerNight: 'เฉลี่ยต่อคืน'
    }
  }

  // Get current language labels
  const t = labels[language] || labels.ru
  
  // Calculate price when dates change
  useEffect(() => {
    if (listing && checkIn && checkOut) {
      const seasonalPricing = listing.metadata?.seasonal_pricing || []
      const result = PricingService.calculateBookingPriceSync(
        listing.basePriceThb,
        checkIn,
        checkOut,
        seasonalPricing
      )
      setPriceCalc(result.error ? null : result)
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
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
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
      // Calculate final price - use calculated total if available, otherwise base price
      const finalPrice = priceCalc ? priceCalc.totalPrice : listing.basePriceThb
      
      // Create booking directly in Supabase
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          listing_id: listing.id,
          partner_id: listing.ownerId,
          status: 'PENDING',
          check_in: checkIn,
          check_out: checkOut,
          price_thb: finalPrice,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          special_requests: message,
          metadata: priceCalc ? {
            nights: priceCalc.nights,
            avgNightlyRate: priceCalc.averageNightlyRate,
            seasonSummary: priceCalc.seasonSummary
          } : null
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.length > 0) {
        toast.success(t.successMsg)
        setBookingModalOpen(false)
        router.push(`/checkout/${data[0].id}`)
      } else {
        toast.error(t.errorMsg)
      }
    } catch (error) {
      console.error('Booking error:', error)
      toast.error(t.errorMsg)
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
          </div>

          {/* Sidebar - Booking Card */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-teal-600">
                    {formatPrice(listing.basePriceThb, 'THB')}
                  </span>
                  <span className="text-slate-600">/ {t.perDay}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-teal-600 hover:bg-teal-700 text-lg py-6">
                      {t.bookNow}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t.bookingRequest}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleBookingSubmit} className="space-y-4">
                      <div>
                        <Label>{t.yourName}</Label>
                        <Input
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label>{t.email}</Label>
                        <Input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label>{t.phone}</Label>
                        <Input
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{t.checkInDate}</Label>
                          <Input
                            type="date"
                            value={checkIn}
                            onChange={(e) => setCheckIn(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label>{t.checkOutDate}</Label>
                          <Input
                            type="date"
                            value={checkOut}
                            onChange={(e) => setCheckOut(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <Label>{t.messageLabel}</Label>
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={t.messagePlaceholder}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t.submitting}
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            {t.submit}
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
