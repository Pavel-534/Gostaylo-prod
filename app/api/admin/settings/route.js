/**
 * Admin Settings API
 * GET - Fetch system settings
 * PUT - Update system settings
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

// Mock settings for when Supabase is not configured
let mockSettings = {
  defaultCommissionRate: 15,
  maintenanceMode: false,
  heroTitle: 'Luxury Rentals in Phuket',
  heroSubtitle: 'Villas, Bikes, Yachts & Tours',
  serviceFeePercent: 5,
  sitePhone: '',
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
    const settings = {
      defaultCommissionRate: data.value?.defaultCommissionRate || 15,
      maintenanceMode: data.value?.maintenanceMode || false,
      heroTitle: data.value?.heroTitle || '',
      heroSubtitle: data.value?.heroSubtitle || '',
      serviceFeePercent: data.value?.serviceFeePercent || 5,
      sitePhone: typeof data.value?.sitePhone === 'string' ? data.value.sitePhone : '',
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
    const { defaultCommissionRate, maintenanceMode, heroTitle, heroSubtitle, sitePhone } = body
    
    const supabase = getSupabaseClient()
    
    // If Supabase is not configured, update mock settings
    if (!supabase) {
      console.log('[SETTINGS] Supabase not configured, updating mock settings')
      mockSettings = {
        ...mockSettings,
        defaultCommissionRate: parseFloat(defaultCommissionRate) || 15,
        maintenanceMode: !!maintenanceMode,
        heroTitle: heroTitle || '',
        heroSubtitle: heroSubtitle || '',
        sitePhone: typeof sitePhone === 'string' ? sitePhone.trim() : '',
      }
      return NextResponse.json({ success: true, data: mockSettings })
    }

    // First check if the row exists
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id, value')
      .eq('key', 'general')
      .single()

    const newValue = {
      ...(existing?.value || {}),
      defaultCommissionRate: parseFloat(defaultCommissionRate) || 15,
      maintenanceMode: !!maintenanceMode,
      heroTitle: heroTitle || '',
      heroSubtitle: heroSubtitle || '',
      sitePhone: typeof sitePhone === 'string' ? sitePhone.trim() : '',
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
