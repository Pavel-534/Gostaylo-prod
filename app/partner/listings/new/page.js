'use client'

/**
 * Gostaylo Premium Multi-step Listing Wizard v2
 * 
 * Features:
 * - 5-step stepper UI with progress bar
 * - Real-time live preview card
 * - Category-specific dynamic fields
 * - Seasonal pricing integration
 * - Save draft functionality
 * - Professional Airbnb-inspired UX
 * 
 * @version 2.0
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft, ArrowRight, Save, CheckCircle2, 
  Home, Bike, Anchor, Map as MapIcon, DollarSign, 
  ImageIcon, Building, Users, Bed, Bath, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'

const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
]

const AMENITIES = [
  'Wi-Fi', 'Pool', 'Parking', 'AC', 'Kitchen', 'Laundry',
  'Security', 'Garden', 'Terrace', 'BBQ', 'Gym', 'Sauna'
]

const STEPS = [
  { id: 1, label: 'Basics', icon: Home },
  { id: 2, label: 'Location', icon: MapIcon },
  { id: 3, label: 'Specs', icon: Building },
  { id: 4, label: 'Pricing', icon: DollarSign },
  { id: 5, label: 'Gallery', icon: ImageIcon }
]

export default function PremiumListingWizard() {
  const router = useRouter()
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [categories, setCategories] = useState([])
  
  // Form data
  const [formData, setFormData] = useState({
    categoryId: '',
    categoryName: '',
    title: '',
    description: '',
    district: '',
    latitude: null,
    longitude: null,
    basePriceThb: '',
    commissionRate: 15,
    minBookingDays: 1,
    maxBookingDays: 90,
    images: [],
    coverImage: '',
    metadata: {
      bedrooms: 0,
      bathrooms: 0,
      max_guests: 2,
      area: 0,
      amenities: [],
      property_type: 'Villa',
      // Yacht-specific
      passengers: 0,
      engine: '',
      // Tour-specific
      duration: '',
      includes: []
    },
    seasonalPricing: []
  })
  
  // Load categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/v2/categories')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data || [])
        }
      } catch (error) {
        console.error('Failed to load categories:', error)
      }
    }
    loadCategories()
  }, [])
  
  // Progress calculation
  const progress = useMemo(() => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100
  }, [currentStep])
  
  // Update form field
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  // Update metadata field
  const updateMetadata = (field, value) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value }
    }))
  }
  
  // Validation for each step
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return formData.categoryId && formData.title.length >= 10 && formData.description.length >= 20
      case 2:
        return formData.district
      case 3:
        return true // Always allow (specs are optional)
      case 4:
        return formData.basePriceThb > 0
      case 5:
        return formData.images.length >= 1
      default:
        return false
    }
  }, [currentStep, formData])
  
  // Navigation
  const goNext = () => {
    if (canProceed && currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1)
    }
  }
  
  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }
  
  // Save draft
  const saveDraft = async () => {
    setSavingDraft(true)
    try {
      const userId = localStorage.getItem('gostaylo_user_id')
      if (!userId) {
        toast.error('Please log in to save')
        return
      }
      
      const payload = {
        ...formData,
        owner_id: userId,
        status: 'draft',
        available: false
      }
      
      const res = await fetch('/api/v2/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      if (data.success) {
        toast.success('Draft saved!')
        router.push('/partner/listings')
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setSavingDraft(false)
    }
  }
  
  // Final submit
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('gostaylo_user_id')
      if (!userId) {
        toast.error('Please log in')
        return
      }
      
      const payload = {
        ...formData,
        owner_id: userId,
        status: 'active',
        available: true,
        base_price_thb: parseFloat(formData.basePriceThb),
        commission_rate: parseFloat(formData.commissionRate),
        min_booking_days: parseInt(formData.minBookingDays) || 1,
        max_booking_days: parseInt(formData.maxBookingDays) || 90
      }
      
      const res = await fetch('/api/v2/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      if (data.success) {
        toast.success('Listing published!')
        router.push('/partner/listings')
      } else {
        toast.error(data.error || 'Failed to publish')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }
  
  // Dynamic fields based on category
  const renderSpecs = () => {
    const categoryName = formData.categoryName?.toLowerCase() || ''
    
    if (categoryName.includes('villa') || categoryName.includes('property')) {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bedrooms</Label>
              <Input
                type="number"
                min="0"
                value={formData.metadata.bedrooms}
                onChange={(e) => updateMetadata('bedrooms', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input
                type="number"
                min="0"
                value={formData.metadata.bathrooms}
                onChange={(e) => updateMetadata('bathrooms', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Guests</Label>
              <Input
                type="number"
                min="1"
                value={formData.metadata.max_guests}
                onChange={(e) => updateMetadata('max_guests', parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Area (m²)</Label>
              <Input
                type="number"
                min="0"
                value={formData.metadata.area}
                onChange={(e) => updateMetadata('area', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>
        </>
      )
    } else if (categoryName.includes('yacht') || categoryName.includes('boat')) {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Passengers</Label>
              <Input
                type="number"
                min="1"
                value={formData.metadata.passengers}
                onChange={(e) => updateMetadata('passengers', parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Engine Type</Label>
              <Input
                type="text"
                placeholder="e.g., 2x 300HP"
                value={formData.metadata.engine}
                onChange={(e) => updateMetadata('engine', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </>
      )
    } else if (categoryName.includes('tour')) {
      return (
        <>
          <div>
            <Label>Duration</Label>
            <Input
              type="text"
              placeholder="e.g., 4 hours"
              value={formData.metadata.duration}
              onChange={(e) => updateMetadata('duration', e.target.value)}
              className="mt-1"
            />
          </div>
        </>
      )
    }
    
    return (
      <div className="text-center py-8 text-slate-500">
        <Building className="h-12 w-12 mx-auto mb-2 text-slate-300" />
        <p>Select a category to see relevant fields</p>
      </div>
    )
  }
  
  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Tell us about your listing</h2>
              <p className="text-slate-600">Start with the basics that guests will see first.</p>
            </div>
            
            <div>
              <Label className="text-base font-medium">Category *</Label>
              <Select 
                value={formData.categoryId} 
                onValueChange={(value) => {
                  const cat = categories.find(c => c.id === value)
                  updateField('categoryId', value)
                  updateField('categoryName', cat?.name || '')
                }}
              >
                <SelectTrigger className="mt-2 h-12">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-base font-medium">Title *</Label>
              <Input
                type="text"
                placeholder="e.g., Luxury Sea View Villa in Rawai"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="mt-2 h-12"
                maxLength={100}
              />
              <p className="text-xs text-slate-500 mt-1">{formData.title.length}/100 characters</p>
            </div>
            
            <div>
              <Label className="text-base font-medium">Description *</Label>
              <Textarea
                placeholder="Describe your listing in detail..."
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="mt-2 min-h-[120px]"
                maxLength={2000}
              />
              <p className="text-xs text-slate-500 mt-1">{formData.description.length}/2000 characters</p>
            </div>
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Where is your listing?</h2>
              <p className="text-slate-600">Help guests find you easily.</p>
            </div>
            
            <div>
              <Label className="text-base font-medium">District *</Label>
              <Select value={formData.district} onValueChange={(value) => updateField('district', value)}>
                <SelectTrigger className="mt-2 h-12">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map(district => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-base font-medium">Map Location (Optional)</Label>
              <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-8 text-center bg-slate-50">
                <MapIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500 mb-2">Click to pin your exact location</p>
                <p className="text-xs text-slate-400">Latitude: {formData.latitude || 'Not set'}, Longitude: {formData.longitude || 'Not set'}</p>
                <Button variant="outline" className="mt-3" disabled>
                  Open Map Picker (Coming Soon)
                </Button>
              </div>
            </div>
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Listing specifications</h2>
              <p className="text-slate-600">Add details specific to your {formData.categoryName}.</p>
            </div>
            
            {renderSpecs()}
            
            <div>
              <Label className="text-base font-medium">Amenities</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {AMENITIES.map(amenity => {
                  const selected = formData.metadata.amenities?.includes(amenity)
                  return (
                    <Button
                      key={amenity}
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const current = formData.metadata.amenities || []
                        const updated = selected 
                          ? current.filter(a => a !== amenity)
                          : [...current, amenity]
                        updateMetadata('amenities', updated)
                      }}
                      className={selected ? 'bg-teal-600 hover:bg-teal-700' : ''}
                    >
                      {amenity}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Pricing & booking rules</h2>
              <p className="text-slate-600">Set your rates and availability.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-base font-medium">Base Price (THB/night) *</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 5000"
                  value={formData.basePriceThb}
                  onChange={(e) => updateField('basePriceThb', e.target.value)}
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label className="text-base font-medium">Commission Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commissionRate}
                  onChange={(e) => updateField('commissionRate', e.target.value)}
                  className="mt-2 h-12"
                  disabled
                />
                <p className="text-xs text-slate-500 mt-1">Standard rate: 15%</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-base font-medium">Min Stay (nights)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.minBookingDays}
                  onChange={(e) => updateField('minBookingDays', e.target.value)}
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label className="text-base font-medium">Max Stay (nights)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.maxBookingDays}
                  onChange={(e) => updateField('maxBookingDays', e.target.value)}
                  className="mt-2 h-12"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-base font-medium">Seasonal Pricing (Optional)</Label>
              <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50">
                <DollarSign className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500 mb-2">Configure high/low season prices</p>
                <Button variant="outline" size="sm" disabled>
                  Add Seasonal Pricing
                </Button>
              </div>
            </div>
          </div>
        )
      
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Add photos</h2>
              <p className="text-slate-600">Showcase your listing with beautiful images.</p>
            </div>
            
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-teal-500 transition-colors cursor-pointer">
              <ImageIcon className="h-16 w-16 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium mb-2">Drag & drop images here</h3>
              <p className="text-slate-500 mb-4">or click to browse (max 20 images)</p>
              <Button variant="outline">Select Files</Button>
            </div>
            
            {formData.images.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img src={img} alt={`Upload ${idx + 1}`} className="object-cover w-full h-full" />
                    {idx === 0 && (
                      <Badge className="absolute top-2 left-2 bg-teal-600">Cover</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Progress */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/partner/listings')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Exit
            </Button>
            
            <h1 className="text-xl font-semibold">Create New Listing</h1>
            
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={savingDraft}
              className="gap-2"
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="pb-4">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-3">
              {STEPS.map((step) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isComplete = currentStep > step.id
                
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isComplete 
                        ? 'bg-teal-600 border-teal-600 text-white' 
                        : isActive 
                        ? 'border-teal-600 text-teal-600 bg-white' 
                        : 'border-slate-300 text-slate-400 bg-white'
                    }`}>
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${isActive ? 'text-teal-600' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Wizard Form */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200">
              <CardContent className="p-8">
                {renderStepContent()}
                
                <Separator className="my-8" />
                
                {/* Navigation Buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 1}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  
                  {currentStep < STEPS.length ? (
                    <Button
                      onClick={goNext}
                      disabled={!canProceed}
                      className="bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={!canProceed || loading}
                      className="bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Publish Listing
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* RIGHT: Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <h3 className="text-lg font-semibold mb-4 text-slate-700">Live Preview</h3>
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-4">
                  <GostayloListingCard
                    listing={{
                      id: 'preview',
                      title: formData.title || 'Your listing title',
                      district: formData.district || 'District',
                      basePriceThb: parseFloat(formData.basePriceThb) || 0,
                      base_price_thb: parseFloat(formData.basePriceThb) || 0,
                      coverImage: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      cover_image: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      images: formData.images.length > 0 ? formData.images : ['https://placehold.co/600x400/e2e8f0/64748b?text=No+Image'],
                      rating: 0,
                      reviewsCount: 0,
                      reviews_count: 0,
                      metadata: formData.metadata,
                      isFeatured: false,
                      is_featured: false
                    }}
                    currency="THB"
                    language="en"
                    exchangeRates={{ THB: 1 }}
                    onFavorite={() => {}}
                    isFavorited={false}
                  />
                  
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <p className="font-medium mb-1">This is how guests will see your listing</p>
                    <p>Continue filling the form to see updates in real-time.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
