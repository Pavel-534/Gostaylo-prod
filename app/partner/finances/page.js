'use client'

/**
 * Gostaylo Partner Finances v2 - Real-time Revenue Dashboard
 * 
 * Features:
 * - TanStack Query for reactive data
 * - Real commission calculations (15% platform fee)
 * - Transaction breakdown by booking status
 * - Downloadable financial reports
 * 
 * @version 2.0
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  DollarSign, TrendingUp, Wallet, Download, 
  Calendar, Building2, Loader2, ArrowUpRight, Clock 
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { format } from 'date-fns'
import { toast } from 'sonner'

// Fetch partner bookings with financial data
async function fetchPartnerFinances(partnerId) {
  if (!partnerId) throw new Error('No partner ID')
  
  const res = await fetch(`/api/v2/partner/bookings?partnerId=${partnerId}`, {
    cache: 'no-store'
  })
  
  if (!res.ok) throw new Error('Failed to fetch finances')
  
  const data = await res.json()
  return data.data || []
}

// Financial calculations
function calculateFinances(bookings) {
  const GOSTAYLO_FEE_RATE = 0.15 // 15%
  
  let totalGrossRevenue = 0
  let totalGostayloFee = 0
  let totalNetEarnings = 0
  let pendingRevenue = 0
  let completedRevenue = 0
  
  bookings.forEach(booking => {
    const gross = parseFloat(booking.total_price_thb) || 0
    const fee = gross * GOSTAYLO_FEE_RATE
    const net = gross - fee
    
    totalGrossRevenue += gross
    totalGostayloFee += fee
    totalNetEarnings += net
    
    if (booking.status === 'COMPLETED') {
      completedRevenue += net
    } else if (['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(booking.status)) {
      pendingRevenue += net
    }
  })
  
  return {
    totalGrossRevenue,
    totalGostayloFee,
    totalNetEarnings,
    completedRevenue,
    pendingRevenue,
    transactionCount: bookings.length
  }
}

// Status badge colors
const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAID: 'bg-green-100 text-green-800 border-green-200',
  PAID_ESCROW: 'bg-teal-100 text-teal-800 border-teal-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  REFUNDED: 'bg-slate-100 text-slate-800 border-slate-200'
}

function StatCard({ icon: Icon, title, value, subtitle, trend, loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 animate-pulse rounded" />
        ) : (
          <>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>{trend}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function PartnerFinancesV2() {
  const [partnerId, setPartnerId] = useState(null)
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates] = useState({ THB: 1 })

  // Get partner ID from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setPartnerId(user.id)
      } catch (e) {
        console.error('[FINANCES] Failed to parse user', e)
      }
    }
  }, [])

  // Fetch bookings with TanStack Query
  const { 
    data: bookings = [], 
    isLoading, 
    isError, 
    error,
    refetch
  } = useQuery({
    queryKey: ['partner-finances', partnerId],
    queryFn: () => fetchPartnerFinances(partnerId),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000 // Auto-refresh every minute
  })

  // Calculate financial stats
  const finances = calculateFinances(bookings)

  // Export to CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) {
      toast.error('No transactions to export')
      return
    }

    const csvRows = [
      ['Date', 'Booking ID', 'Listing', 'Guest', 'Status', 'Gross Revenue', 'GoStaylo Fee (15%)', 'Net Earnings'].join(','),
      ...bookings.map(b => {
        const gross = parseFloat(b.total_price_thb) || 0
        const fee = gross * 0.15
        const net = gross - fee
        return [
          format(new Date(b.created_at), 'yyyy-MM-dd'),
          b.id,
          `"${b.listing?.title || 'N/A'}"`,
          `"${b.guest_name || 'N/A'}"`,
          b.status,
          gross.toFixed(2),
          fee.toFixed(2),
          net.toFixed(2)
        ].join(',')
      })
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gostaylo-finances-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Financial report downloaded')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Finances & Payouts</h1>
          <p className="text-slate-600 mt-1">Real-time revenue tracking and transaction history</p>
        </div>
        <Button 
          onClick={handleExportCSV}
          variant="outline"
          disabled={bookings.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Financial Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          title="Total Gross Revenue"
          value={formatPrice(finances.totalGrossRevenue, currency, exchangeRates)}
          subtitle="Before platform fees"
          loading={isLoading}
        />
        
        <StatCard
          icon={Building2}
          title="GoStaylo Fee (15%)"
          value={formatPrice(finances.totalGostayloFee, currency, exchangeRates)}
          subtitle="Platform commission"
          loading={isLoading}
        />
        
        <StatCard
          icon={Wallet}
          title="Net Earnings (85%)"
          value={formatPrice(finances.totalNetEarnings, currency, exchangeRates)}
          subtitle="Your share"
          loading={isLoading}
        />
        
        <StatCard
          icon={TrendingUp}
          title="Transactions"
          value={finances.transactionCount}
          subtitle={`${bookings.filter(b => b.status === 'COMPLETED').length} completed`}
          loading={isLoading}
        />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Completed Revenue
            </CardTitle>
            <CardDescription>Funds from completed stays</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatPrice(finances.completedRevenue, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Pending Revenue
            </CardTitle>
            <CardDescription>Upcoming or in-progress bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {formatPrice(finances.pendingRevenue, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Detailed breakdown of all bookings with commission calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-red-600">
              <p className="mb-2">Failed to load transactions</p>
              <p className="text-sm text-slate-500">{error?.message}</p>
              <Button onClick={() => refetch()} variant="outline" className="mt-4">
                Retry
              </Button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No transactions yet</h3>
              <p>Your booking revenue will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const gross = parseFloat(booking.total_price_thb) || 0
                const fee = gross * 0.15
                const net = gross - fee
                
                return (
                  <div 
                    key={booking.id} 
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors gap-4"
                  >
                    {/* Left: Booking Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">
                          {booking.listing?.title || 'Listing'}
                        </h4>
                        <Badge className={`text-xs ${STATUS_COLORS[booking.status] || 'bg-slate-100'}`}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        Guest: {booking.guest_name || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {booking.check_in && format(new Date(booking.check_in), 'MMM d')} → {booking.check_out && format(new Date(booking.check_out), 'MMM d, yyyy')}
                      </p>
                    </div>

                    {/* Right: Financial Breakdown */}
                    <div className="flex flex-col md:items-end gap-1">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Gross:</span>
                          <span className="font-medium text-slate-900 ml-2">
                            {formatPrice(gross, currency, exchangeRates)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Fee:</span>
                          <span className="font-medium text-red-600 ml-2">
                            -{formatPrice(fee, currency, exchangeRates)}
                          </span>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        {formatPrice(net, currency, exchangeRates)}
                      </div>
                      <p className="text-xs text-slate-500">Your net earnings</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Footer */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">How Payouts Work</h4>
              <p className="text-sm text-blue-700">
                GoStaylo retains a 15% platform fee from each booking. Your net earnings (85%) are automatically calculated and will be available for withdrawal once bookings are completed. Payouts are processed within 2-3 business days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
