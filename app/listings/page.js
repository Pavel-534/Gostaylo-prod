'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Home, Bike, Map, Anchor, Search, ArrowLeft, Star, MapPin, Filter, Grid, List, Palmtree } from 'lucide-react'
import { fetchListings, fetchCategories } from '@/lib/client-data'
import { formatPrice } from '@/lib/currency'
import { getUIText, getCategoryName } from '@/lib/translations'

export default function ListingsPage() {
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

  const districts = ['Patong', 'Kata', 'Karon', 'Kamala', 'Rawai', 'Phuket Town', 'Bang Tao', 'Chalong']

  const categoryIcons = {
    property: Home,
    vehicles: Bike,
    tours: Map,
    yachts: Anchor,
  }

  useEffect(() => {
    // Detect language from browser or localStorage
    const storedLang = localStorage.getItem('funnyrent_language')
    if (storedLang) {
      setLanguage(storedLang)
    } else {
      const browserLang = navigator.language.split('-')[0]
      const supported = ['ru', 'en', 'zh', 'th']
      setLanguage(supported.includes(browserLang) ? browserLang : 'en')
    }
    
    const storedCurrency = localStorage.getItem('funnyrent_currency')
    if (storedCurrency) setCurrency(storedCurrency)
    
    loadData()
  }, [])

  useEffect(() => {
    loadListings()
  }, [selectedCategory, selectedDistrict, sortBy])

  async function loadData() {
    try {
      const [listingsData, categoriesData] = await Promise.all([
        fetchListings({ category: categorySlug !== 'all' ? categorySlug : undefined }),
        fetchCategories()
      ])
      setListings(listingsData)
      setCategories(categoriesData)
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
        sorted.sort((a, b) => a.base_price_thb - b.base_price_thb)
      } else if (sortBy === 'price_desc') {
        sorted.sort((a, b) => b.base_price_thb - a.base_price_thb)
      } else if (sortBy === 'rating') {
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
      }
      
      setListings(sorted)
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
  }

  const filteredListings = listings.filter(listing => {
    if (!searchQuery) return true
    const title = listing.title?.toLowerCase() || ''
    const desc = listing.description?.toLowerCase() || ''
    return title.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase())
  })

  const getCategoryTitle = () => {
    if (selectedCategory === 'all') {
      return language === 'ru' ? 'Все объявления' :
             language === 'zh' ? '所有列表' :
             language === 'th' ? 'รายการทั้งหมด' : 'All Listings'
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
            
            <Link href="/" className="flex flex-col leading-none">
              <span className="text-lg font-black text-slate-900 tracking-tight">Funny</span>
              <span className="text-lg font-black text-teal-500 tracking-tight ml-3 -mt-1">Rent</span>
            </Link>
            
            <div className="w-20" /> {/* Spacer for centering */}
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

      {/* Listings Grid */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {filteredListings.length === 0 ? (
            <div className="text-center py-16">
              <Palmtree className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                {language === 'ru' ? 'Ничего не найдено' :
                 language === 'zh' ? '未找到任何内容' :
                 language === 'th' ? 'ไม่พบสิ่งใด' : 'Nothing found'}
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
                const title = listing.metadata?.title?.[language] || listing.title
                
                return viewMode === 'grid' ? (
                  <Link key={listing.id} href={`/listings/${listing.id}`}>
                    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-teal-500 h-full">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={listing.cover_image || listing.images?.[0] || 'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg'}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                        <Badge className="absolute top-3 left-3 bg-teal-500">
                          <Icon className="w-3 h-3 mr-1" />
                          {getCategoryName(listing.category?.slug, language, listing.category?.name)}
                        </Badge>
                        {listing.is_featured && (
                          <Badge className="absolute top-3 right-3 bg-amber-500">
                            <Star className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-slate-900 mb-1 line-clamp-1">{title}</h4>
                        <div className="flex items-center text-sm text-slate-500 mb-3">
                          <MapPin className="w-3 h-3 mr-1" />
                          {listing.district || 'Phuket'}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-bold text-teal-600">
                            {formatPrice(listing.base_price_thb, currency)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {language === 'ru' ? '/ночь' : '/night'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : (
                  <Link key={listing.id} href={`/listings/${listing.id}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-teal-500">
                      <div className="flex">
                        <div className="relative w-48 h-36 flex-shrink-0 overflow-hidden">
                          <img
                            src={listing.cover_image || listing.images?.[0] || 'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg'}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                        <CardContent className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-teal-500">
                                <Icon className="w-3 h-3 mr-1" />
                                {getCategoryName(listing.category?.slug, language, listing.category?.name)}
                              </Badge>
                              {listing.is_featured && (
                                <Badge className="bg-amber-500">Featured</Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
                            <div className="flex items-center text-sm text-slate-500">
                              <MapPin className="w-3 h-3 mr-1" />
                              {listing.district || 'Phuket'}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xl font-bold text-teal-600">
                              {formatPrice(listing.base_price_thb, currency)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {language === 'ru' ? '/ночь' : '/night'}
                            </span>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">FR</span>
            </div>
            <span className="font-semibold">FunnyRent 2.1</span>
          </div>
          <p className="text-sm text-slate-400">© 2025 FunnyRent. {getUIText('allRightsReserved', language)}</p>
        </div>
      </footer>
    </div>
  )
}
