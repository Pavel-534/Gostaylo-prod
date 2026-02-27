'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Calendar, DollarSign, Home, Bike, Map, Anchor, ChevronDown, Menu, User, LogIn, Eye, EyeOff, Loader2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatPrice } from '@/lib/currency'
import { fetchCategories, fetchListings, fetchExchangeRates, fetchDistricts } from '@/lib/client-data'
import { detectLanguage, setLanguage as saveLanguage, supportedLanguages, getCategoryName, getUIText } from '@/lib/translations'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ru, enUS, zhCN, th } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'

// Date-fns locales map
const dateLocales = { ru, en: enUS, zh: zhCN, th }

export default function FunnyRentHome() {
  const router = useRouter()
  
  // State
  const [currency, setCurrency] = useState('THB')
  const [language, setLanguageState] = useState('ru')
  const [categories, setCategories] = useState([])
  const [listings, setListings] = useState([])
  const [districts, setDistricts] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Auto-detect language on mount
  useEffect(() => {
    const detected = detectLanguage()
    setLanguageState(detected)
  }, [])

  // Language change handler
  const handleLanguageChange = (lang) => {
    setLanguageState(lang)
    saveLanguage(lang)
  }

  // Get current locale for date-fns
  const currentLocale = dateLocales[language] || ru

  // Handle login
  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    
    try {
      // Direct Supabase login
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(loginEmail.toLowerCase())}`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      })
      
      const users = await res.json()
      
      if (users && users.length > 0) {
        const user = users[0]
        // Store user in localStorage for session
        localStorage.setItem('funnyrent_user', JSON.stringify({
          id: user.id,
          email: user.email,
          role: user.role,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
        }))
        
        setLoginDialogOpen(false)
        
        // Redirect based on role
        if (user.role === 'ADMIN') {
          router.push('/admin/dashboard')
        } else if (user.role === 'PARTNER') {
          router.push('/partner')
        } else {
          router.push('/renter')
        }
      } else {
        setLoginError('Пользователь не найден')
      }
    } catch (error) {
      console.error('Login error:', error)
      setLoginError('Ошибка входа. Попробуйте снова.')
    }
    
    setLoginLoading(false)
  }

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadListings()
  }, [selectedCategory, selectedDistrict, dateRange])

  async function loadData() {
    try {
      // Fetch directly from Supabase (bypasses Kubernetes routing)
      const [categoriesData, ratesData] = await Promise.all([
        fetchCategories(),
        fetchExchangeRates(),
      ])

      setCategories(categoriesData)
      setDistricts(fetchDistricts())
      setExchangeRates(ratesData)
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setLoading(false)
    }
  }

  async function loadListings() {
    try {
      // Fetch directly from Supabase
      const data = await fetchListings({
        category: selectedCategory,
        district: selectedDistrict
      })
      setListings(data)
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
  }

  function convertPrice(priceThb) {
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency] || 1
    return priceThb / rate
  }

  const categoryIcons = {
    property: Home,
    vehicles: Bike,
    tours: Map,
    yachts: Anchor,
  }

  const filteredListings = listings.filter(listing => {
    if (!searchQuery) return true
    return listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           listing.description.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header - Fixed Mobile Layout with Full Branding */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            {/* Logo - Always show FunnyRent */}
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <div className="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm sm:text-lg">FR</span>
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-slate-900">FunnyRent</h1>
                <p className="text-[10px] sm:text-xs text-teal-600 hidden sm:block">Phuket Rentals</p>
              </div>
            </Link>

            {/* Right Controls - Symmetrical sizing */}
            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-teal-200 hover:bg-teal-50 h-8 px-2 min-w-[40px]">
                    <span className="text-base">{supportedLanguages.find(l => l.code === language)?.flag || '🌐'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {supportedLanguages.map((lang) => (
                    <DropdownMenuItem 
                      key={lang.code} 
                      onClick={() => handleLanguageChange(lang.code)}
                      className={language === lang.code ? 'bg-teal-50' : ''}
                    >
                      <span className="text-lg mr-2">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Currency Switcher - Compact */}
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[72px] sm:w-[90px] border-teal-200 focus:ring-teal-500 h-8 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">฿ THB</SelectItem>
                  <SelectItem value="RUB">₽ RUB</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                  <SelectItem value="USDT">₮ USDT</SelectItem>
                </SelectContent>
              </Select>

              {/* Login Button - Same height as others */}
              <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-teal-200 hover:bg-teal-50 h-8 w-8 p-0">
                    <User className="h-4 w-4 text-teal-600" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{getUIText('loginTitle', language)}</DialogTitle>
                    <DialogDescription>
                      {language === 'ru' ? 'Войдите в систему или создайте новый аккаунт' :
                       language === 'en' ? 'Sign in or create a new account' :
                       language === 'zh' ? '登录或创建新账户' : 'เข้าสู่ระบบหรือสร้างบัญชีใหม่'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleLogin} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{getUIText('email', language)}</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">{getUIText('password', language)}</Label>
                      <div className="relative">
                        <Input 
                          id="password" 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {loginError && (
                      <p className="text-red-500 text-sm">{getUIText('loginError', language)}</p>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full bg-teal-600 hover:bg-teal-700"
                      disabled={loginLoading}
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {getUIText('loading', language)}
                        </>
                      ) : (
                        getUIText('loginButton', language)
                      )}
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-500">Или</span>
                      </div>
                    </div>
                    <Button type="button" variant="outline" className="w-full">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Войти через Google
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-[600px] bg-cover bg-center" style={{ backgroundImage: 'url(https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40" />
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center">
          <div className="max-w-3xl mx-auto sm:mx-0">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 text-center sm:text-left">
              {getUIText('heroTitle', language)}
              <span className="block text-teal-400">{getUIText('heroTitleHighlight', language)}</span>
            </h2>
            <p className="text-lg sm:text-xl text-slate-200 mb-8 text-center sm:text-left">
              {getUIText('heroSubtitle', language)}
            </p>

            {/* Search Bar - Centered on Mobile */}
            <Card className="bg-white/95 backdrop-blur-sm shadow-2xl w-[95%] sm:w-full mx-auto sm:mx-0">
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                  <div className="sm:col-span-2 lg:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                      <Input
                        placeholder={getUIText('searchPlaceholder', language)}
                        className="pl-10 w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Date Range Picker */}
                  <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateRange.from && dateRange.to ? (
                          `${format(dateRange.from, 'dd MMM', { locale: currentLocale })} - ${format(dateRange.to, 'dd MMM', { locale: currentLocale })}`
                        ) : dateRange.from ? (
                          `${format(dateRange.from, 'dd MMM', { locale: currentLocale })} - ...`
                        ) : (
                          getUIText('selectDates', language)
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{getUIText('datePickerTitle', language)}</DialogTitle>
                        <DialogDescription>{getUIText('datePickerDesc', language)}</DialogDescription>
                      </DialogHeader>
                      
                      {/* Selected Range Display */}
                      <div className="bg-teal-50 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <div className={`flex-1 p-2 rounded ${dateRange.from ? 'bg-teal-600 text-white' : 'bg-white border-2 border-dashed border-teal-300'}`}>
                            <p className="text-xs opacity-80">{getUIText('checkIn', language)}</p>
                            <p className="font-semibold">
                              {dateRange.from ? format(dateRange.from, 'dd MMM yyyy', { locale: currentLocale }) : '—'}
                            </p>
                          </div>
                          <span className="text-teal-600 font-bold">→</span>
                          <div className={`flex-1 p-2 rounded ${dateRange.to ? 'bg-teal-600 text-white' : 'bg-white border-2 border-dashed border-teal-300'}`}>
                            <p className="text-xs opacity-80">{getUIText('checkOut', language)}</p>
                            <p className="font-semibold">
                              {dateRange.to ? format(dateRange.to, 'dd MMM yyyy', { locale: currentLocale }) : '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center py-4">
                        <DayPicker
                          mode="range"
                          selected={dateRange}
                          onSelect={(range) => {
                            setDateRange(range || { from: null, to: null })
                            // DO NOT close until both dates selected - user clicks Apply
                          }}
                          locale={currentLocale}
                          disabled={{ before: new Date() }}
                          numberOfMonths={1}
                          classNames={{
                            months: "flex flex-col sm:flex-row gap-4",
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-teal-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-teal-50 rounded-md",
                            day_selected: "bg-teal-600 text-white hover:bg-teal-700 hover:text-white focus:bg-teal-600 focus:text-white",
                            day_today: "bg-slate-100 text-slate-900",
                            day_outside: "text-slate-400 opacity-50",
                            day_disabled: "text-slate-400 opacity-50",
                            day_hidden: "invisible",
                            day_range_middle: "bg-teal-100 rounded-none",
                          }}
                        />
                      </div>
                      <DialogFooter className="flex gap-2 sm:gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setDateRange({ from: null, to: null })}
                          className="flex-1"
                        >
                          {getUIText('clear', language)}
                        </Button>
                        <Button
                          onClick={() => setDatePickerOpen(false)}
                          disabled={!dateRange.from || !dateRange.to}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                        >
                          {getUIText('apply', language)} ✓
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder={getUIText('category', language)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{getUIText('allCategories', language)}</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.icon} {getCategoryName(cat.slug, language, cat.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                    <SelectTrigger>
                      <SelectValue placeholder={getUIText('district', language)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{getUIText('allDistricts', language)}</SelectItem>
                      {districts.map(district => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">{getUIText('categories', language)}</h3>
            <p className="text-slate-600">
              {language === 'ru' ? 'Выберите то, что вам нужно' :
               language === 'en' ? 'Choose what you need' :
               language === 'zh' ? '选择您需要的' : 'เลือกสิ่งที่คุณต้องการ'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat, idx) => {
              const Icon = categoryIcons[cat.slug] || Home
              const images = [
                'https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg',
                'https://images.pexels.com/photos/31342032/pexels-photo-31342032.jpeg',
                'https://images.pexels.com/photos/18277777/pexels-photo-18277777.jpeg',
                'https://images.unsplash.com/photo-1566735201951-bc1cbeeb2964',
              ]
              
              return (
                <Card
                  key={cat.id}
                  className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-teal-500"
                  onClick={() => {
                    // Redirect to listings page with category filter
                    router.push(`/listings?category=${cat.slug}`)
                  }}
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={images[idx]}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 text-white">
                        <Icon className="h-6 w-6" />
                        <h4 className="text-xl font-bold">{getCategoryName(cat.slug, language, cat.name)}</h4>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Listings Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-2">{getUIText('currentListings', language)}</h3>
              <p className="text-slate-600">{getUIText('found', language)}: {filteredListings.length} {getUIText('objects', language)}</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Загрузка...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredListings.map(listing => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className={`group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer ${listing.isFeatured ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-200' : ''}`}>
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      {listing.isFeatured && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                          ⭐ {getUIText('featured', language)}
                        </div>
                      )}
                      {listing.rating > 0 && (
                        <div className="absolute top-3 right-3 bg-teal-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                          ⭐ {listing.rating}
                        </div>
                      )}
                    </div>
                    <CardHeader>
                      <CardTitle className="line-clamp-1 text-lg">{listing.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{listing.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="h-4 w-4" />
                          <span>{listing.district}</span>
                        </div>
                        {/* Bedrooms/Bathrooms - Localized */}
                        {(listing.bedrooms || listing.bathrooms) && (
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {listing.bedrooms && (
                              <span>{listing.bedrooms} {getUIText('bedrooms', language)}</span>
                            )}
                            {listing.bathrooms && (
                              <span>{listing.bathrooms} {getUIText('bathrooms', language)}</span>
                            )}
                          </div>
                        )}
                        {listing.reviewsCount > 0 && (
                          <div className="text-xs text-slate-500">
                            {listing.reviewsCount} {getUIText('reviews', language)}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          {listing.hasSeasonalPricing && !dateRange.from ? (
                            <div>
                              <div className="text-sm text-slate-500 mb-1">{getUIText('priceFrom', language)}</div>
                              <span className="text-2xl font-bold text-teal-600">
                                {formatPrice(convertPrice(listing.lowestSeasonalPrice), currency)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-2xl font-bold text-teal-600">
                              {formatPrice(convertPrice(listing.currentPrice || listing.basePriceThb), currency)}
                            </span>
                          )}
                          <span className="text-sm text-slate-500">/{getUIText('pricePerDay', language)}</span>
                        </div>
                        {dateRange.from && dateRange.to && listing.hasSeasonalPricing && (
                          <Badge className="bg-teal-100 text-teal-700 text-xs">
                            {language === 'ru' ? 'Сезонная цена' : 
                             language === 'en' ? 'Seasonal price' :
                             language === 'zh' ? '季节价格' : 'ราคาตามฤดูกาล'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full bg-teal-600 hover:bg-teal-700">
                        {getUIText('bookNow', language)}
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer - Fully Localized */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">FR</span>
                </div>
                <span className="text-xl font-bold">FunnyRent</span>
              </div>
              <p className="text-slate-400 text-sm">
                {getUIText('footerDesc', language)}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">{getUIText('footerCategories', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{getCategoryName('property', language)}</li>
                <li>{getCategoryName('vehicles', language)}</li>
                <li>{getCategoryName('tours', language)}</li>
                <li>{getCategoryName('yachts', language)}</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">{getUIText('footerCompany', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{getUIText('aboutUs', language)}</li>
                <li>{getUIText('careers', language)}</li>
                <li>{getUIText('contactUs', language)}</li>
                <li>{getUIText('blog', language)}</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">{getUIText('footerSupport', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{getUIText('helpCenter', language)}</li>
                <li>{getUIText('terms', language)}</li>
                <li>{getUIText('privacyPolicy', language)}</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm text-slate-400">
            <p>&copy; 2025 FunnyRent. {getUIText('allRightsReserved', language)}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}