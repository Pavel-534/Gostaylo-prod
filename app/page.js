'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Calendar, Home, Bike, Map, Anchor, User, Eye, EyeOff, Loader2, BedDouble, Bath, Maximize, Plus } from 'lucide-react'
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
import { detectLanguage, setLanguage as saveLanguage, supportedLanguages, getCategoryName, getUIText, getListingText } from '@/lib/translations'
import { CurrencySelector } from '@/components/currency-selector'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ru, enUS, zhCN, th } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'

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
  const [currentUser, setCurrentUser] = useState(null)
  
  // Login/Register state
  const [authMode, setAuthMode] = useState('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
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

  // Check for logged in user
  useEffect(() => {
    const stored = localStorage.getItem('funnyrent_user')
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored))
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    const detected = detectLanguage()
    setLanguageState(detected)
  }, [])

  const handleLanguageChange = (lang) => {
    setLanguageState(lang)
    saveLanguage(lang)
  }

  const currentLocale = dateLocales[language] || ru

  // Handle login
  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    
    try {
      const { signIn } = await import('@/lib/auth')
      const result = await signIn(loginEmail.toLowerCase(), loginPassword)
      
      if (!result.success) {
        if (result.error.includes('Invalid login')) {
          setLoginError(language === 'ru' ? 'Неверный email или пароль' : 'Invalid email or password')
        } else {
          setLoginError(result.error)
        }
        setLoginLoading(false)
        return
      }
      
      setCurrentUser(result.user)
      setLoginDialogOpen(false)
      
      const user = result.user
      if (user.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else if (user.role === 'PARTNER') {
        router.push('/partner/dashboard')
      } else {
        router.push('/renter/dashboard')
      }
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoginLoading(false)
    }
  }

  // Handle registration
  async function handleRegister(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    
    try {
      const { signUp } = await import('@/lib/auth')
      const result = await signUp({
        email: loginEmail.toLowerCase(),
        password: loginPassword,
        name: registerName,
        role: 'RENTER'
      })
      
      if (!result.success) {
        setLoginError(result.error)
        setLoginLoading(false)
        return
      }
      
      setCurrentUser(result.user)
      setLoginDialogOpen(false)
      router.push('/renter/dashboard')
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoginLoading(false)
    }
  }

  // Handle logout
  function handleLogout() {
    localStorage.removeItem('funnyrent_user')
    setCurrentUser(null)
    router.push('/')
  }

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [cats, items, rates, dists] = await Promise.all([
          fetchCategories(),
          fetchListings(),
          fetchExchangeRates(),
          fetchDistricts()
        ])
        setCategories(cats)
        setListings(items)
        setExchangeRates(rates)
        setDistricts(dists)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Price conversion
  function convertPrice(priceThb) {
    if (!priceThb) return 0
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency]
    return rate ? priceThb / rate : priceThb
  }

  const categoryIcons = {
    property: Home,
    vehicles: Bike,
    tours: Map,
    yachts: Anchor,
  }

  // Filter listings
  const filteredListings = listings.filter(listing => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query) ||
        listing.district?.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }
    // Category filter
    if (selectedCategory !== 'all') {
      const cat = categories.find(c => c.slug === selectedCategory)
      if (cat && listing.category_id !== cat.id) return false
    }
    // District filter
    if (selectedDistrict !== 'all' && listing.district !== selectedDistrict) {
      return false
    }
    return true
  })

  // Handle search
  function handleSearch() {
    // Scroll to listings section
    const listingsSection = document.getElementById('listings-section')
    if (listingsSection) {
      listingsSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className='min-h-screen bg-white'>
      {/* Login Dialog - rendered globally but visible only when triggered */}
      <Dialog open={loginDialogOpen} onOpenChange={(open) => {
        setLoginDialogOpen(open)
        if (!open) {
          setLoginError('')
          setAuthMode('login')
        }
      }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {authMode === 'login' 
                ? getUIText('loginTitle', language)
                : (language === 'ru' ? 'Регистрация' : 'Sign Up')}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'login'
                ? (language === 'ru' ? 'Войдите в систему' : 'Sign in to your account')
                : (language === 'ru' ? 'Создайте аккаунт' : 'Create your account')}
            </DialogDescription>
          </DialogHeader>
          
          {/* Auth Tabs */}
          <div className='flex border-b mb-4'>
            <button
              type='button'
              onClick={() => { setAuthMode('login'); setLoginError('') }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                authMode === 'login' 
                  ? 'border-teal-600 text-teal-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {language === 'ru' ? 'Вход' : 'Login'}
            </button>
            <button
              type='button'
              onClick={() => { setAuthMode('register'); setLoginError('') }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                authMode === 'register' 
                  ? 'border-teal-600 text-teal-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {language === 'ru' ? 'Регистрация' : 'Sign Up'}
            </button>
          </div>
          
          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className='space-y-4'>
            {authMode === 'register' && (
              <div className='space-y-2'>
                <Label htmlFor='name'>{language === 'ru' ? 'Имя' : 'Name'}</Label>
                <Input 
                  id='name' 
                  type='text' 
                  placeholder={language === 'ru' ? 'Ваше имя' : 'Your name'}
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className='space-y-2'>
              <Label htmlFor='email'>{getUIText('email', language)}</Label>
              <Input 
                id='email' 
                type='email' 
                placeholder='your@email.com'
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>{getUIText('password', language)}</Label>
              <div className='relative'>
                <Input 
                  id='password' 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder='••••••••'
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className='pr-10'
                  required
                  minLength={authMode === 'register' ? 8 : undefined}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                >
                  {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
            </div>
            {loginError && (
              <p className='text-red-500 text-sm'>{loginError}</p>
            )}
            <Button 
              type='submit' 
              className='w-full bg-teal-600 hover:bg-teal-700'
              disabled={loginLoading}
            >
              {loginLoading ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  {getUIText('loading', language)}
                </>
              ) : (
                authMode === 'login' 
                  ? getUIText('loginButton', language)
                  : (language === 'ru' ? 'Создать аккаунт' : 'Create Account')
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hero Section */}
      <section className='relative h-[550px] sm:h-[600px] bg-cover bg-center' style={{ backgroundImage: 'url(https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)' }}>
        <div className='absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40' />
        <div className='relative container mx-auto px-4 h-full flex flex-col justify-center'>
          <div className='max-w-3xl mx-auto sm:mx-0'>
            <h1 className='text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 text-center sm:text-left'>
              {getUIText('heroTitle', language)}
              <span className='block text-teal-400'>{getUIText('heroTitleHighlight', language)}</span>
            </h1>
            <p className='text-base sm:text-xl text-slate-200 mb-6 sm:mb-8 text-center sm:text-left'>
              {getUIText('heroSubtitle', language)}
            </p>

            {/* Search Bar */}
            <Card className='bg-white shadow-2xl w-full'>
              <CardContent className='p-4 sm:p-6'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3'>
                  {/* Search Input */}
                  <div className='sm:col-span-2'>
                    <div className='relative'>
                      <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4' />
                      <Input
                        placeholder={getUIText('searchPlaceholder', language)}
                        className='pl-10 h-10'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      />
                    </div>
                  </div>
                  
                  {/* Date Range */}
                  <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <DialogTrigger asChild>
                      <Button variant='outline' className='h-10 justify-start text-left font-normal'>
                        <Calendar className='mr-2 h-4 w-4 text-slate-400' />
                        <span className='truncate text-sm'>
                          {dateRange.from && dateRange.to 
                            ? `${format(dateRange.from, 'dd MMM', { locale: currentLocale })} - ${format(dateRange.to, 'dd MMM', { locale: currentLocale })}`
                            : getUIText('selectDates', language)}
                        </span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className='max-w-md'>
                      <DialogHeader>
                        <DialogTitle>{getUIText('datePickerTitle', language)}</DialogTitle>
                      </DialogHeader>
                      <div className='flex justify-center py-4'>
                        <DayPicker
                          mode='range'
                          selected={dateRange}
                          onSelect={(range) => setDateRange(range || { from: null, to: null })}
                          locale={currentLocale}
                          disabled={{ before: new Date() }}
                          numberOfMonths={1}
                          classNames={{
                            day_selected: 'bg-teal-600 text-white hover:bg-teal-700',
                            day_today: 'bg-slate-100',
                            day_range_middle: 'bg-teal-100',
                          }}
                        />
                      </div>
                      <DialogFooter className='flex gap-2'>
                        <Button variant='outline' onClick={() => setDateRange({ from: null, to: null })} className='flex-1'>
                          {getUIText('clear', language)}
                        </Button>
                        <Button onClick={() => setDatePickerOpen(false)} className='flex-1 bg-teal-600 hover:bg-teal-700'>
                          {getUIText('apply', language)}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Category */}
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className='h-10'>
                      <SelectValue placeholder={getUIText('category', language)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{getUIText('allCategories', language)}</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.icon} {getCategoryName(cat.slug, language, cat.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* District */}
                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                    <SelectTrigger className='h-10'>
                      <SelectValue placeholder={getUIText('district', language)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{getUIText('allDistricts', language)}</SelectItem>
                      {districts.map(district => (
                        <SelectItem key={district} value={district}>{district}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Search Button */}
                  <Button 
                    onClick={handleSearch}
                    className='h-10 bg-teal-600 hover:bg-teal-700'
                  >
                    <Search className='h-4 w-4 mr-2' />
                    {language === 'ru' ? 'Найти' : 'Search'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className='py-12 sm:py-16 bg-white'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-10'>
            <h2 className='text-2xl sm:text-3xl font-bold text-slate-900 mb-3'>{getUIText('categories', language)}</h2>
            <p className='text-slate-600'>
              {language === 'ru' ? 'Выберите то, что вам нужно' : 'Choose what you need'}
            </p>
          </div>

          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6'>
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
                  className='group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-teal-500'
                  onClick={() => router.push(`/listings?category=${cat.slug}`)}
                >
                  <div className='relative h-32 sm:h-48 overflow-hidden'>
                    <img
                      src={images[idx]}
                      alt={cat.name}
                      className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                    />
                    <div className='absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent' />
                    <div className='absolute bottom-3 left-3 right-3'>
                      <div className='flex items-center gap-2 text-white'>
                        <Icon className='h-5 w-5' />
                        <h3 className='text-base sm:text-lg font-bold'>{getCategoryName(cat.slug, language, cat.name)}</h3>
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
      <section id='listings-section' className='py-12 sm:py-16 bg-slate-50'>
        <div className='container mx-auto px-4'>
          <div className='flex items-center justify-between mb-8'>
            <div>
              <h2 className='text-2xl sm:text-3xl font-bold text-slate-900 mb-1'>{getUIText('currentListings', language)}</h2>
              <p className='text-slate-600 text-sm'>{getUIText('found', language)}: {filteredListings.length} {getUIText('objects', language)}</p>
            </div>
          </div>

          {loading ? (
            <div className='text-center py-12'>
              <Loader2 className='h-10 w-10 animate-spin text-teal-600 mx-auto' />
              <p className='mt-4 text-slate-600'>{getUIText('loading', language)}...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className='text-center py-12'>
              <p className='text-slate-600'>{language === 'ru' ? 'Ничего не найдено' : 'No results found'}</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
              {filteredListings.map(listing => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className='group h-full flex flex-col overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-teal-400 bg-white'>
                    {/* Image */}
                    <div className='relative h-44 sm:h-48 overflow-hidden flex-shrink-0'>
                      <img
                        src={listing.images?.[0] || '/placeholder.jpg'}
                        alt={listing.title}
                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                      />
                      {listing.isFeatured && (
                        <div className='absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow'>
                          ⭐ {getUIText('featured', language)}
                        </div>
                      )}
                      {listing.rating > 0 && (
                        <div className='absolute top-2 right-2 bg-teal-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow'>
                          ⭐ {listing.rating}
                        </div>
                      )}
                    </div>
                    
                    {/* Content - flex-grow to push footer down */}
                    <div className='flex flex-col flex-grow p-4'>
                      <h3 className='font-semibold text-slate-900 line-clamp-1 text-base mb-1'>
                        {getListingText(listing, 'title', language)}
                      </h3>
                      <p className='text-slate-500 text-sm line-clamp-2 mb-3 flex-grow'>
                        {getListingText(listing, 'description', language)}
                      </p>
                      
                      {/* Location */}
                      <div className='flex items-center gap-1.5 text-sm text-slate-600 mb-2'>
                        <MapPin className='h-3.5 w-3.5' />
                        <span>{listing.district}</span>
                      </div>
                      
                      {/* Icons row - aligned */}
                      {(listing.bedrooms || listing.bathrooms || listing.area) && (
                        <div className='flex items-center gap-4 text-xs text-slate-500 mb-3'>
                          {listing.bedrooms > 0 && (
                            <span className='flex items-center gap-1'>
                              <BedDouble className='h-3.5 w-3.5' />
                              {listing.bedrooms}
                            </span>
                          )}
                          {listing.bathrooms > 0 && (
                            <span className='flex items-center gap-1'>
                              <Bath className='h-3.5 w-3.5' />
                              {listing.bathrooms}
                            </span>
                          )}
                          {listing.area > 0 && (
                            <span className='flex items-center gap-1'>
                              <Maximize className='h-3.5 w-3.5' />
                              {listing.area}м²
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Price */}
                      <div className='flex items-baseline justify-between mb-3'>
                        <span className='text-xl font-bold text-teal-600'>
                          {formatPrice(convertPrice(listing.currentPrice || listing.basePriceThb), currency)}
                        </span>
                        <span className='text-xs text-slate-500'>/{getUIText('pricePerDay', language)}</span>
                      </div>
                    </div>
                    
                    {/* Footer - mt-auto pushes to bottom */}
                    <div className='px-4 pb-4 mt-auto'>
                      <Button className='w-full bg-teal-600 hover:bg-teal-700 h-9 text-sm'>
                        {getUIText('bookNow', language)}
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-slate-900 text-white py-10 sm:py-12'>
        <div className='container mx-auto px-4'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8'>
            <div className='col-span-2 md:col-span-1'>
              <div className='flex flex-col leading-none mb-4'>
                <span className='text-xl font-black text-white tracking-tight'>Funny</span>
                <span className='text-xl font-black text-teal-400 tracking-tight ml-4 -mt-1'>Rent</span>
              </div>
              <p className='text-slate-400 text-sm'>{getUIText('footerDesc', language)}</p>
            </div>
            
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerCategories', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                <li>{getCategoryName('property', language)}</li>
                <li>{getCategoryName('vehicles', language)}</li>
                <li>{getCategoryName('tours', language)}</li>
                <li>{getCategoryName('yachts', language)}</li>
              </ul>
            </div>
            
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerCompany', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                <li>{getUIText('aboutUs', language)}</li>
                <li>{getUIText('contactUs', language)}</li>
              </ul>
            </div>
            
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerSupport', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                <li>{getUIText('helpCenter', language)}</li>
                <li>{getUIText('terms', language)}</li>
                <li>{getUIText('privacyPolicy', language)}</li>
              </ul>
            </div>
          </div>
          
          <div className='border-t border-slate-800 mt-8 pt-6 text-center text-sm text-slate-400'>
            <p>© 2025 FunnyRent. {getUIText('allRightsReserved', language)}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
