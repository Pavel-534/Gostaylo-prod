'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Edit, Trash2, MoreVertical, Grid, List, ExternalLink } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function PartnerListings() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    loadListings()
  }, [])

  async function loadListings() {
    try {
      // Get current user
      const storedUser = localStorage.getItem('funnyrent_user')
      const user = storedUser ? JSON.parse(storedUser) : null
      
      if (!user || !user.id) {
        setLoading(false)
        return
      }
      
      // Load directly from Supabase to avoid K8s ingress issues
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${user.id}&order=created_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      const data = await res.json()
      setListings(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listings:', error)
      setLoading(false)
    }
  }

  async function deleteListing(id) {
    try {
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
      const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'
      
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      })
      setListings(listings.filter(l => l.id !== id))
      setDeleteId(null)
    } catch (error) {
      console.error('Failed to delete listing:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    DRAFT: 'bg-slate-100 text-slate-600 border border-dashed border-slate-400',
    INACTIVE: 'bg-slate-100 text-slate-700',
    BOOKED: 'bg-blue-100 text-blue-700',
  }

  const statusLabels = {
    ACTIVE: 'Активный',
    PENDING: 'На модерации',
    DRAFT: 'Черновик',
    INACTIVE: 'Неактивный',
    BOOKED: 'Забронирован',
  }
  
  // Helper to get effective status (check metadata.is_draft)
  function getEffectiveStatus(listing) {
    if (listing.metadata?.is_draft) return 'DRAFT'
    return listing.status
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">Мои листинги</h1>
          <p className="text-sm lg:text-base text-slate-600 mt-1">
            Управляйте своими предложениями
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/partner/listings/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Добавить</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats - Stack on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{listings.length}</div>
            <p className="text-xs lg:text-sm text-slate-600">Всего</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-green-600">
              {listings.filter(l => l.status === 'ACTIVE').length}
            </div>
            <p className="text-xs lg:text-sm text-slate-600">Активных</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-slate-900">
              {listings.reduce((sum, l) => sum + l.views, 0)}
            </div>
            <p className="text-xs lg:text-sm text-slate-600">Просмотров</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-slate-900">
              {listings.reduce((sum, l) => sum + l.bookingsCount, 0)}
            </div>
            <p className="text-xs lg:text-sm text-slate-600">Бронирований</p>
          </CardContent>
        </Card>
      </div>

      {/* Listings Grid/List */}
      {listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              У вас пока нет листингов
            </h3>
            <p className="text-slate-600 mb-6 text-center max-w-md">
              Начните зарабатывать, добавив своё первое предложение
            </p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/partner/listings/new">
                <Plus className="h-4 w-4 mr-2" />
                Добавить первый листинг
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => {
            const effectiveStatus = getEffectiveStatus(listing)
            return (
            <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-48">
                <img
                  src={listing.images?.[0] || listing.cover_image || '/placeholder.jpg'}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
                <Badge className={`absolute top-3 right-3 ${statusColors[effectiveStatus]}`}>
                  {statusLabels[effectiveStatus]}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-1">{listing.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {listing.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Цена</span>
                  <span className="font-semibold text-slate-900">
                    {formatPrice(listing.base_price_thb, 'THB')}/день
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Комиссия</span>
                  <span className="text-red-600">{listing.commission_rate}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Eye className="h-3 w-3" />
                    {listing.views || 0}
                  </span>
                  <span className="text-slate-600">
                    {listing.bookingsCount || 0} бронирований
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1" 
                  asChild
                  data-testid={`view-listing-${listing.id}`}
                >
                  <Link href={`/listings/${listing.id}`} target="_blank">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    На сайте
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/partner/listings/${listing.id}`}>
                    <Edit className="h-3 w-3 mr-1" />
                    Редактировать
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDeleteId(listing.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          )})}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {listings.map((listing) => {
                const effectiveStatus = getEffectiveStatus(listing)
                return (
                <div key={listing.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <img
                      src={listing.images?.[0] || listing.cover_image || '/placeholder.jpg'}
                      alt={listing.title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">{listing.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{listing.district}</p>
                        </div>
                        <Badge className={statusColors[effectiveStatus]}>
                          {statusLabels[effectiveStatus]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 mt-3 text-sm">
                        <span className="text-slate-600">
                          {formatPrice(listing.base_price_thb, 'THB')}/день
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <Eye className="h-3 w-3" />
                          {listing.views || 0}
                        </span>
                        <span className="text-slate-600">
                          {listing.bookingsCount || 0} бронирований
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                        data-testid={`view-listing-list-${listing.id}`}
                      >
                        <Link href={`/listings/${listing.id}`} target="_blank">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          На сайте
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/partner/listings/${listing.id}/edit`}>
                          <Edit className="h-3 w-3 mr-1" />
                          Редактировать
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(listing.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить листинг?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Листинг будет удалён безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteListing(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}