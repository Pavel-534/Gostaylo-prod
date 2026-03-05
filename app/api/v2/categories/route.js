/**
 * FunnyRent 2.1 - Categories API (v2)
 * GET /api/v2/categories - Get all active categories
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('all') === 'true';
    
    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .order('order', { ascending: true });
    
    // Only active categories for public API
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    
    const { data: categories, error } = await query;
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Transform for frontend compatibility
    const transformed = categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      order: c.order,
      isActive: c.is_active
    }));
    
    return NextResponse.json({ success: true, data: transformed });
    
  } catch (error) {
    console.error('[CATEGORIES GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const { name, slug, icon, description, order } = body;
    
    if (!name || !slug) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: name, slug' 
      }, { status: 400 });
    }
    
    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name,
        slug,
        icon,
        description,
        order: order || 0,
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log(`[ADMIN] Category created: ${name}`);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        isActive: category.is_active
      }
    });
    
  } catch (error) {
    console.error('[CATEGORIES POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
