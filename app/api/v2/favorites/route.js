/**
 * Gostaylo - Favorites API
 * GET - Fetch user's favorite listings
 * POST - Add listing to favorites
 * DELETE - Remove listing from favorites
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

async function getUserFromSession() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

// GET - Fetch user's favorites
export async function GET() {
  try {
    const user = await getUserFromSession();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Fetch favorites with listing details
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        id,
        listing_id,
        created_at,
        listings (
          id,
          title,
          base_price_thb,
          images,
          cover_image,
          district,
          rating,
          category_id,
          status
        )
      `)
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[FAVORITES API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      favorites: favorites || []
    });
    
  } catch (error) {
    console.error('[FAVORITES API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add to favorites
export async function POST(request) {
  try {
    const user = await getUserFromSession();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { listingId } = await request.json();
    
    if (!listingId) {
      return NextResponse.json({ error: 'listingId required' }, { status: 400 });
    }
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Insert favorite
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: user.userId,
        listing_id: listingId
      })
      .select()
      .single();
    
    if (error) {
      // Check if already exists (unique constraint violation)
      if (error.code === '23505') {
        return NextResponse.json({ 
          success: true, 
          message: 'Already in favorites',
          favorite: data
        });
      }
      
      console.error('[FAVORITES API] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Added to favorites',
      favorite: data
    });
    
  } catch (error) {
    console.error('[FAVORITES API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove from favorites
export async function DELETE(request) {
  try {
    const user = await getUserFromSession();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { listingId } = await request.json();
    
    if (!listingId) {
      return NextResponse.json({ error: 'listingId required' }, { status: 400 });
    }
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Delete favorite
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.userId)
      .eq('listing_id', listingId);
    
    if (error) {
      console.error('[FAVORITES API] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    });
    
  } catch (error) {
    console.error('[FAVORITES API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
