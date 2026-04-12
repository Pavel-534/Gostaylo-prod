/**
 * Admin Settings API
 * GET - Fetch system settings
 * PUT - Update system settings
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { platformDefaultChatInvoiceRateMultiplier } from '@/lib/services/currency-last-resort'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

// Mock settings for when Supabase is not configured
const defaultChatSafety = {
  autoShadowbanEnabled: false,
  strikeThreshold: 5,
  estimatedBookingValueThb: 8000,
}

let mockSettings = {
  defaultCommissionRate: 15,
  chatInvoiceRateMultiplier: platformDefaultChatInvoiceRateMultiplier(),
  maintenanceMode: false,
  heroTitle: 'Luxury Rentals in Phuket',
  heroSubtitle: 'Villas, Bikes, Yachts & Tours',
  serviceFeePercent: 5,
  sitePhone: '',
  chatSafety: { ...defaultChatSafety },
}

// Helper to get supabase client (returns null if not configured)
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // If Supabase is not configured, return mock settings
    if (!supabaseUrl || !serviceKey) {
      console.log('[SETTINGS] Supabase not configured, using mock settings')
      return NextResponse.json({ data: mockSettings })
    }
    
    // Use direct REST API to bypass SDK caching
    const res = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?key=eq.general&select=*`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      }
    )
    
    const settingsData = await res.json()
    
    if (!settingsData || settingsData.length === 0) {
      console.error('No settings found in database')
      return NextResponse.json({ data: mockSettings })
    }

    const data = settingsData[0]
    
    // Map from DB format to frontend format
    const rawComm = parseFloat(data.value?.defaultCommissionRate)
    const rawChatMult = parseFloat(data.value?.chatInvoiceRateMultiplier)
    const rawCs = data.value?.chatSafety
    const chatSafety = {
      autoShadowbanEnabled: rawCs?.autoShadowbanEnabled === true,
      strikeThreshold: (() => {
        const n = parseInt(String(rawCs?.strikeThreshold ?? ''), 10)
        return Number.isFinite(n) && n >= 1 && n <= 999 ? n : defaultChatSafety.strikeThreshold
      })(),
      estimatedBookingValueThb: (() => {
        const n = parseFloat(String(rawCs?.estimatedBookingValueThb ?? ''))
        return Number.isFinite(n) && n >= 0 ? n : defaultChatSafety.estimatedBookingValueThb
      })(),
    }

    const settings = {
      defaultCommissionRate: Number.isFinite(rawComm) && rawComm >= 0
        ? rawComm
        : await resolveDefaultCommissionPercent(),
      chatInvoiceRateMultiplier:
        Number.isFinite(rawChatMult) && rawChatMult >= 1 && rawChatMult <= 1.5
          ? rawChatMult
          : platformDefaultChatInvoiceRateMultiplier(),
      maintenanceMode: data.value?.maintenanceMode || false,
      heroTitle: data.value?.heroTitle || '',
      heroSubtitle: data.value?.heroSubtitle || '',
      serviceFeePercent: data.value?.serviceFeePercent || 5,
      sitePhone: typeof data.value?.sitePhone === 'string' ? data.value.sitePhone : '',
      chatSafety,
    }

    return NextResponse.json({ data: settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const {
      defaultCommissionRate,
      chatInvoiceRateMultiplier,
      maintenanceMode,
      heroTitle,
      heroSubtitle,
      sitePhone,
      chatSafety: chatSafetyBody,
    } = body
    
    const supabase = getSupabaseClient()
    
    // If Supabase is not configured, update mock settings
    if (!supabase) {
      console.log('[SETTINGS] Supabase not configured, updating mock settings')
      const parsedMock = parseFloat(defaultCommissionRate)
      const parsedMockChat =
        chatInvoiceRateMultiplier != null && chatInvoiceRateMultiplier !== ''
          ? parseFloat(chatInvoiceRateMultiplier)
          : NaN
      const prevChat = parseFloat(mockSettings.chatInvoiceRateMultiplier)
      const nextChatMult =
        Number.isFinite(parsedMockChat) && parsedMockChat >= 1 && parsedMockChat <= 1.5
          ? parsedMockChat
          : Number.isFinite(prevChat) && prevChat >= 1 && prevChat <= 1.5
            ? prevChat
            : platformDefaultChatInvoiceRateMultiplier()
      const nextChatSafety = {
        ...mockSettings.chatSafety,
        ...(chatSafetyBody && typeof chatSafetyBody === 'object' ? chatSafetyBody : {}),
      }
      nextChatSafety.autoShadowbanEnabled = nextChatSafety.autoShadowbanEnabled === true
      const st = parseInt(String(nextChatSafety.strikeThreshold ?? ''), 10)
      nextChatSafety.strikeThreshold =
        Number.isFinite(st) && st >= 1 && st <= 999 ? st : defaultChatSafety.strikeThreshold
      const est = parseFloat(String(nextChatSafety.estimatedBookingValueThb ?? ''))
      nextChatSafety.estimatedBookingValueThb =
        Number.isFinite(est) && est >= 0 ? est : defaultChatSafety.estimatedBookingValueThb

      mockSettings = {
        ...mockSettings,
        defaultCommissionRate: Number.isFinite(parsedMock) && parsedMock >= 0
          ? parsedMock
          : await resolveDefaultCommissionPercent(),
        chatInvoiceRateMultiplier: nextChatMult,
        maintenanceMode: !!maintenanceMode,
        heroTitle: heroTitle || '',
        heroSubtitle: heroSubtitle || '',
        sitePhone: typeof sitePhone === 'string' ? sitePhone.trim() : '',
        chatSafety: nextChatSafety,
      }
      return NextResponse.json({ success: true, data: mockSettings })
    }

    // First check if the row exists
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id, value')
      .eq('key', 'general')
      .single()

    const parsedPut = parseFloat(defaultCommissionRate)
    const resolvedComm = Number.isFinite(parsedPut) && parsedPut >= 0
      ? parsedPut
      : await resolveDefaultCommissionPercent()
    const parsedChat =
      chatInvoiceRateMultiplier != null && chatInvoiceRateMultiplier !== ''
        ? parseFloat(chatInvoiceRateMultiplier)
        : NaN
    const existingChat = parseFloat(existing?.value?.chatInvoiceRateMultiplier)
    const resolvedChatMult =
      Number.isFinite(parsedChat) && parsedChat >= 1 && parsedChat <= 1.5
        ? parsedChat
        : Number.isFinite(existingChat) && existingChat >= 1 && existingChat <= 1.5
          ? existingChat
          : platformDefaultChatInvoiceRateMultiplier()
    const prevCs = existing?.value?.chatSafety || {}
    const mergedCs = {
      ...defaultChatSafety,
      ...prevCs,
      ...(chatSafetyBody && typeof chatSafetyBody === 'object' ? chatSafetyBody : {}),
    }
    mergedCs.autoShadowbanEnabled = mergedCs.autoShadowbanEnabled === true
    const stPut = parseInt(String(mergedCs.strikeThreshold ?? ''), 10)
    mergedCs.strikeThreshold =
      Number.isFinite(stPut) && stPut >= 1 && stPut <= 999 ? stPut : defaultChatSafety.strikeThreshold
    const estPut = parseFloat(String(mergedCs.estimatedBookingValueThb ?? ''))
    mergedCs.estimatedBookingValueThb =
      Number.isFinite(estPut) && estPut >= 0 ? estPut : defaultChatSafety.estimatedBookingValueThb

    const newValue = {
      ...(existing?.value || {}),
      defaultCommissionRate: resolvedComm,
      chatInvoiceRateMultiplier: resolvedChatMult,
      maintenanceMode: !!maintenanceMode,
      heroTitle: heroTitle || '',
      heroSubtitle: heroSubtitle || '',
      sitePhone: typeof sitePhone === 'string' ? sitePhone.trim() : '',
      chatSafety: mergedCs,
    }

    let result
    if (existing) {
      // Update existing row
      result = await supabase
        .from('system_settings')
        .update({ 
          value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'general')
    } else {
      // Insert new row
      result = await supabase
        .from('system_settings')
        .insert({
          id: `setting-${Date.now()}`,
          key: 'general',
          value: newValue,
          updated_at: new Date().toISOString()
        })
    }

    if (result.error) {
      console.error('Failed to save settings:', result.error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      data: newValue
    })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
