/**
 * Gostaylo - Renter Profile Page (Phase 2)
 * 
 * Features:
 * - User info with profile completion progress
 * - "Become a Partner" card with controlled application
 * - Telegram connection status
 * - "Welcome Partner" celebration modal
 * - Quick actions & navigation
 * 
 * @version 2.0
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { 
  User, Mail, Phone, Calendar, MapPin,
  Home, Heart, Settings, LogOut,
  Send, Shield, TrendingUp, Clock, Zap,
  CheckCircle, XCircle, Loader2, AlertCircle,
  Sparkles, PartyPopper, Trophy
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// Profile completion calculation
function calculateProfileCompletion(user) {
  if (!user) return 0
  
  let score = 0
  const maxScore = 100
  
  // Basic info (40%)
  if (user.first_name || user.name) score += 15
  if (user.email) score += 10
  if (user.phone) score += 15
  
  // Advanced (30%)
  if (user.telegram_id || user.telegram_username) score += 20
  if (user.avatar) score += 10
  
  // Engagement (30%)
  // Will be calculated based on bookings, reviews etc in future
  score += 30
  
  return Math.min(score, maxScore)
}

// Partner Application Form Modal
function PartnerApplicationModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    phone: '',
    experience: '',
    socialLink: '',
    portfolio: ''
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900">Partner Application</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          
          <p className="text-slate-600 mb-6">
            Tell us about your hosting experience and we'll review your application within 24 hours.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+66 XXX XXX XXX"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hosting Experience *
              </label>
              <textarea
                required
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                placeholder="e.g., 3 years of hosting, 5 properties on Airbnb..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Social Media / Telegram
              </label>
              <input
                type="text"
                value={formData.socialLink}
                onChange={(e) => setFormData({ ...formData, socialLink: e.target.value })}
                placeholder="@your_telegram or social link"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Portfolio / Listings
              </label>
              <input
                type="url"
                value={formData.portfolio}
                onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                placeholder="https://airbnb.com/users/..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-teal-600 hover:bg-teal-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Welcome Partner Celebration Modal
function WelcomePartnerModal({ isOpen, onClose, userName }) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 rounded-2xl max-w-md w-full p-8 text-white text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti effect */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="h-10 w-10" />
          </div>
          
          <h2 className="text-3xl font-bold mb-2">Congratulations!</h2>
          <p className="text-lg mb-4">{userName || 'Partner'}</p>
          
          <div className="bg-white/20 rounded-lg p-4 mb-6">
            <Trophy className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">
              You're now a Gostaylo Partner! Start listing your properties and earn with 0% commission.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button
              asChild
              className="w-full bg-white text-teal-600 hover:bg-white/90"
            >
              <Link href="/partner/dashboard">
                Go to Partner Dashboard
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RenterProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applicationStatus, setApplicationStatus] = useState(null)
  const [loadingApplication, setLoadingApplication] = useState(true)
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [linkingTelegram, setLinkingTelegram] = useState(false)
  const [telegramCode, setTelegramCode] = useState(null)
  
  // Modal states
  const [showApplicationModal, setShowApplicationModal] = useState(false)
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  
  // Get user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        setTelegramLinked(!!(parsed.telegram_id || parsed.telegram_username))
        
        // Check if just became partner (show welcome once)
        const hasSeenWelcome = localStorage.getItem(`welcome_partner_${parsed.id}`)
        if (parsed.role === 'PARTNER' && !hasSeenWelcome) {
          setShowWelcomeModal(true)
          localStorage.setItem(`welcome_partner_${parsed.id}`, 'true')
        }
      } catch (e) {
        console.error('[PROFILE] Failed to parse user', e)
      }
    }
    setLoading(false)
  }, [])
  
  // Fetch application status
  useEffect(() => {
    if (user && user.role !== 'PARTNER') {
      fetchApplicationStatus()
    } else {
      setLoadingApplication(false)
    }
  }, [user])
  
  async function fetchApplicationStatus() {
    try {
      const res = await fetch('/api/v2/partner/application-status', {
        credentials: 'include'
      })
      const data = await res.json()
      
      // API returns: { success, hasApplication, status, rejectionReason, appliedAt, reviewedAt }
      if (data.success && data.hasApplication) {
        setApplicationStatus({
          status: data.status,
          rejection_reason: data.rejectionReason,
          created_at: data.appliedAt,
          reviewed_at: data.reviewedAt
        })
      }
    } catch (error) {
      console.error('[PROFILE] Failed to fetch application status', error)
    } finally {
      setLoadingApplication(false)
    }
  }
  
  // Handle telegram link
  async function handleTelegramLink() {
    setLinkingTelegram(true)
    try {
      const res = await fetch('/api/v2/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setTelegramCode(data.code)
        toast.success('Link code generated! Send it to our bot.')
      } else {
        toast.error(data.error || 'Failed to generate code')
      }
    } catch (error) {
      toast.error('Failed to generate telegram link')
    } finally {
      setLinkingTelegram(false)
    }
  }
  
  // Handle partner application submission
  async function handleApplicationSubmit(formData) {
    setSubmittingApplication(true)
    try {
      const res = await fetch('/api/v2/partner/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: formData.phone,
          experience: formData.experience,
          socialLink: formData.socialLink,
          portfolio: formData.portfolio
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success('Application submitted! We\'ll review it within 24h.')
        setShowApplicationModal(false)
        fetchApplicationStatus() // Refresh status
      } else {
        toast.error(data.error || 'Failed to submit application')
      }
    } catch (error) {
      console.error('[APPLICATION] Submit error', error)
      toast.error('Failed to submit application')
    } finally {
      setSubmittingApplication(false)
    }
  }
  
  // Handle logout
  function handleLogout() {
    localStorage.removeItem('gostaylo_user')
    router.push('/')
  }
  
  // Profile completion
  const profileCompletion = useMemo(() => calculateProfileCompletion(user), [user])
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }
  
  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">Please log in to view your profile</p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/profile?login=true">Log In</Link>
        </Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header with User Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <Avatar className="w-24 h-24">
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-teal-600 text-white text-3xl font-bold">
                {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            {/* User Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {user.name || user.first_name || 'Guest User'}
                </h1>
                <Badge className={
                  user.role === 'PARTNER' 
                    ? 'bg-teal-100 text-teal-800 border-teal-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }>
                  {user.role}
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
                {user.phone && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Phone className="h-4 w-4" />
                    {user.phone}
                  </div>
                )}
                {user.created_at && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Calendar className="h-4 w-4" />
                    Member since {format(new Date(user.created_at), 'MMM yyyy', { locale: ru })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Profile Completion */}
          <Separator className="my-6" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Profile Completion</span>
              <span className="text-sm font-semibold text-teal-600">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2" />
            <p className="text-xs text-slate-500 mt-2">
              {profileCompletion < 100 
                ? 'Complete your profile to unlock all features!'
                : 'Your profile is complete! 🎉'}
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Become a Partner Card (Only for non-partners) */}
      {user.role !== 'PARTNER' && (
        <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-900">
              <Sparkles className="h-6 w-6" />
              Start Earning with Gostaylo
            </CardTitle>
            <CardDescription className="text-teal-700">
              List your property and become a partner today!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-teal-100">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">0% Commission</p>
                  <p className="text-xs text-slate-600">Keep all earnings</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-teal-100">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">24/7 Support</p>
                  <p className="text-xs text-slate-600">Always here for you</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-teal-100">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Fast Payouts</p>
                  <p className="text-xs text-slate-600">Quick payments</p>
                </div>
              </div>
            </div>
            
            {/* Application Status or CTA */}
            {loadingApplication ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : applicationStatus ? (
              <div className={`p-4 rounded-lg border-2 ${
                applicationStatus.status === 'PENDING'
                  ? 'bg-amber-50 border-amber-200'
                  : applicationStatus.status === 'APPROVED'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {applicationStatus.status === 'PENDING' && (
                      <>
                        <Clock className="h-6 w-6 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-900">Application Under Review</p>
                          <p className="text-sm text-amber-700">We'll respond within 24 hours</p>
                        </div>
                      </>
                    )}
                    {applicationStatus.status === 'APPROVED' && (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-900">Approved!</p>
                          <p className="text-sm text-green-700">Refresh to access Partner Portal</p>
                        </div>
                      </>
                    )}
                    {applicationStatus.status === 'REJECTED' && (
                      <>
                        <XCircle className="h-6 w-6 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-900">Application Declined</p>
                          {applicationStatus.rejection_reason && (
                            <p className="text-sm text-red-700">{applicationStatus.rejection_reason}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {applicationStatus.status === 'APPROVED' && (
                    <Button onClick={() => window.location.reload()} className="bg-green-600 hover:bg-green-700">
                      Refresh
                    </Button>
                  )}
                  
                  {applicationStatus.status === 'REJECTED' && (
                    <Button onClick={() => setShowApplicationModal(true)} variant="outline">
                      Reapply
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setShowApplicationModal(true)}
                className="w-full bg-teal-600 hover:bg-teal-700 text-lg py-6"
              >
                <Send className="h-5 w-5 mr-2" />
                Apply to Become a Partner
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Connect Telegram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Telegram Notifications</CardTitle>
          <CardDescription>
            Get instant updates about your bookings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {telegramLinked ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Telegram Connected!</p>
                <p className="text-sm text-green-700">
                  {user.telegram_username ? `@${user.telegram_username.replace('@', '')}` : 'Linked'}
                </p>
              </div>
            </div>
          ) : telegramCode ? (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 mb-2">Send this code to our bot:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white border border-blue-300 rounded font-mono text-lg text-center">
                    /link {telegramCode}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`/link ${telegramCode}`)
                      toast.success('Code copied!')
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open('https://t.me/GostayloBot', '_blank')}
              >
                Open Telegram Bot
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleTelegramLink}
              disabled={linkingTelegram}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {linkingTelegram ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Connect Telegram
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/renter/bookings">
                <Home className="h-6 w-6 mb-2" />
                <span className="text-sm">My Bookings</span>
              </Link>
            </Button>
            
            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/favorites">
                <Heart className="h-6 w-6 mb-2" />
                <span className="text-sm">Favorites</span>
              </Link>
            </Button>
            
            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/renter/profile">
                <Settings className="h-6 w-6 mb-2" />
                <span className="text-sm">Settings</span>
              </Link>
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex flex-col h-auto py-4 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-6 w-6 mb-2" />
              <span className="text-sm">Logout</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Modals */}
      <PartnerApplicationModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        onSubmit={handleApplicationSubmit}
        isSubmitting={submittingApplication}
      />
      
      <WelcomePartnerModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        userName={user.name || user.first_name}
      />
    </div>
  )
}
