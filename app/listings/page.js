'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Home, Bike, Map, Anchor, Search, ArrowLeft, Star, MapPin, Filter, Grid, List, Palmtree, Bed, Bath, Loader2 } from 'lucide-react'
import { fetchListings, fetchCategories, fetchExchangeRates } from '@/lib/client-data'
import { formatPrice } from '@/lib/currency'
import { getUIText, getCategoryName, getListingText } from '@/lib/translations'

function ListingsContent() {
  const searchParams = useSearchParams()
  const categorySlug = searchParams.get('category') || 'all'
  
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(categorySlug)
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1, USD: 35.5, RUB: 0.37 })

  const districts = ['Patong', 'Kata', 'Karon', 'Kamala', 'Rawai', 'Phuket Town', 'Bang Tao', 'Chalong']

  const categoryIcons = {
    property: Home,
    vehicles: Bike,
    tours: Map,
    yachts: Anchor,
  }

  useEffect(() => {
    // Detect language from localStorage or browser
    const storedLang = localStorage.getItem('gostaylo_language')
    if (storedLang) {
      setLanguage(storedLang)
    } else {
      const browserLang = navigator.language.split('-')[0]
      const supported = ['ru', 'en', 'zh', 'th']
      setLanguage(supported.includes(browserLang) ? browserLang : 'en')
    }
    
    const storedCurrency = localStorage.getItem('gostaylo_currency')
    if (storedCurrency) setCurrency(storedCurrency)
    
    loadInitialData()
  }, [])

  // Listen for currency changes from header
  useEffect(() => {
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  useEffect(() => {
    loadListings()
  }, [selectedCategory, selectedDistrict])

  async function loadInitialData() {
    try {
      const [listingsData, categoriesData, rates] = await Promise.all([
        fetchListings({ category: categorySlug !== 'all' ? categorySlug : undefined }),
        fetchCategories(),
        fetchExchangeRates()
      ])
      setListings(listingsData)
      setCategories(categoriesData)
      setExchangeRates(rates)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setLoading(false)
    }
  }

  async function loadListings() {
    try {
      const data = await fetchListings({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        district: selectedDistrict !== 'all' ? selectedDistrict : undefined
      })
      
      // Sort listings
      let sorted = [...data]
      if (sortBy === 'price_asc') {
        sorted.sort((a, b) => (a.basePriceThb || 0) - (b.basePriceThb || 0))
      } else if (sortBy === 'price_desc') {
        sorted.sort((a, b) => (b.basePriceThb || 0) - (a.basePriceThb || 0))
      } else if (sortBy === 'rating') {
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
      }
      
      setListings(sorted)
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
  }

  function convertPrice(priceThb) {
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency] || 1
    return priceThb / rate
  }

  const filteredListings = listings.filter(listing => {
    if (!searchQuery) return true
    const title = listing.title?.toLowerCase() || ''
    const desc = listing.description?.toLowerCase() || ''
    return title.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase())
  })

  const getCategoryTitle = () => {
    if (selectedCategory === 'all') {
      return getUIText('allCategories', language)
    }
    const cat = categories.find(c => c.slug === selectedCategory)
    return cat ? getCategoryName(cat.slug, language, cat.name) : selectedCategory
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{getUIText('loading', language)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{getUIText('backToHome', language)}</span>
              </Button>
            </Link>
            
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">Gostaylo</span>
            </Link>
            
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative py-12 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Palmtree className="w-8 h-8 text-teal-400" />
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30">
              {filteredListings.length} {getUIText('objects', language)}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{getCategoryTitle()}</h1>
          <p className="text-slate-300 text-lg">
            {language === 'ru' ? 'Найдите идеальный вариант для вашего отдыха' :
             language === 'zh' ? '找到您完美的度假选择' :
             language === 'th' ? 'ค้นหาตัวเลือกที่สมบูรณ์แบบสำหรับวันหยุดของคุณ' :
             'Find the perfect option for your vacation'}
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-6 bg-white border-b border-slate-200 sticky top-[57px] z-40">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={getUIText('search', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={getUIText('allCategories', language)} />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">{getUIText('allCategories', language)}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {getCategoryName(cat.slug, language, cat.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* District Filter */}
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={getUIText('district', language)} />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">{getUIText('allDistricts', language)}</SelectItem>
                {districts.map((district) => (
                  <SelectItem key={district} value={district}>{district}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="newest">
                  {language === 'ru' ? 'Новые' : language === 'zh' ? '最新' : language === 'th' ? 'ใหม่ล่าสุด' : 'Newest'}
                </SelectItem>
                <SelectItem value="price_asc">
                  {language === 'ru' ? 'Цена ↑' : language === 'zh' ? '价格 ↑' : language === 'th' ? 'ราคา ↑' : 'Price ↑'}
                </SelectItem>
                <SelectItem value="price_desc">
                  {language === 'ru' ? 'Цена ↓' : language === 'zh' ? '价格 ↓' : language === 'th' ? 'ราคา ↓' : 'Price ↓'}
                </SelectItem>
                <SelectItem value="rating">
                  {language === 'ru' ? 'Рейтинг' : language === 'zh' ? '评分' : language === 'th' ? 'คะแนน' : 'Rating'}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex gap-1 ml-auto">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-teal-600 hover:bg-teal-700' : ''}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-teal-600 hover:bg-teal-700' : ''}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Listings Grid - SAME AS HOMEPAGE */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {filteredListings.length === 0 ? (
            <div className="text-center py-16">
              <Palmtree className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                {getUIText('noResults', language)}
              </h3>
              <p className="text-slate-500">
                {language === 'ru' ? 'Попробуйте изменить фильтры' :
                 language === 'zh' ? '尝试更改过滤器' :
                 language === 'th' ? 'ลองเปลี่ยนตัวกรอง' : 'Try changing the filters'}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
            }>
              {filteredListings.map((listing) => {
                const Icon = categoryIcons[listing.category?.slug] || Home
                
                return (
                  <Link key={listing.id} href={`/listings/${listing.id}`}>
                    <Card className={`group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer h-full ${listing.isFeatured ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-200' : ''}`}>
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={listing.images?.[0] || listing.coverImage || 'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg'}
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
                      <CardHeader className="pb-2">
                        <CardTitle className="line-clamp-1 text-lg">
                          {getListingText(listing, 'title', language)}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {getListingText(listing, 'description', language)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="h-4 w-4" />
                            <span>{listing.district || 'Phuket'}</span>
                          </div>
                          {/* Bedrooms/Bathrooms */}
                          {(listing.bedrooms || listing.bathrooms) && (
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {listing.bedrooms && (
                                <span className="flex items-center gap-1">
                                  <Bed className="w-3 h-3" />
                                  {listing.bedrooms} {getUIText('bedrooms', language)}
                                </span>
                              )}
                              {listing.bathrooms && (
                                <span className="flex items-center gap-1">
                                  <Bath className="w-3 h-3" />
                                  {listing.bathrooms} {getUIText('bathrooms', language)}
                                </span>
                              )}
                            </div>
                          )}
                          {listing.reviewsCount > 0 && (
                            <div className="text-xs text-slate-500">
                              {listing.reviewsCount} {getUIText('reviews', language)}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-2xl font-bold text-teal-600">
                              {formatPrice(convertPrice(listing.basePriceThb || 0), currency)}
                            </span>
                            <span className="text-sm text-slate-500">/{getUIText('pricePerDay', language)}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button className="w-full bg-teal-600 hover:bg-teal-700">
                          {getUIText('bookNow', language)}
                        </Button>
                      </CardFooter>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer - Localized */}
      <footer className="bg-slate-900 text-white py-12 mt-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Logo */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">FR</span>
                </div>
                <span className="font-bold text-xl">Gostaylo</span>
              </div>
              <p className="text-slate-400 text-sm">
                {getUIText('footerDesc', language)}
              </p>
            </div>
            
            {/* Categories */}
            <div>
              <h4 className="font-semibold mb-4">{getUIText('footerCategories', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link href={`/listings?category=${cat.slug}`} className="hover:text-teal-400 transition">
                      {getCategoryName(cat.slug, language, cat.name)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4">{getUIText('footerCompany', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-teal-400 transition">{getUIText('aboutUs', language)}</Link></li>
                <li><Link href="#" className="hover:text-teal-400 transition">{getUIText('careers', language)}</Link></li>
                <li><Link href="#" className="hover:text-teal-400 transition">{getUIText('blog', language)}</Link></li>
              </ul>
            </div>
            
            {/* Support */}
            <div>
              <h4 className="font-semibold mb-4">{getUIText('footerSupport', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-teal-400 transition">{getUIText('helpCenter', language)}</Link></li>
                <li><Link href="#" className="hover:text-teal-400 transition">{getUIText('safetyInfo', language)}</Link></li>
                <li><Link href="#" className="hover:text-teal-400 transition">{getUIText('contactUs', language)}</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-sm text-slate-400">
            <p>© 2025 Gostaylo. {getUIText('allRightsReserved', language)}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Loading fallback
function ListingsLoading() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
    </div>
  )
}

// Main export with Suspense boundary
export default function ListingsPage() {
  return (
    <Suspense fallback={<ListingsLoading />}>
      <ListingsContent />
    </Suspense>
  )
}
