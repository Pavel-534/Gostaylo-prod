/**
 * FunnyRent 2.1 - Legacy API Redirect
 * All old /api/* routes redirect to v2 or return mock data
 * This file can be removed once all frontend is migrated to v2
 */

import { NextResponse } from 'next/server';

// Mock data for legacy endpoints that haven't been migrated yet
const MOCK_DATA = {
  blacklist: { wallets: [], phones: [] },
  promoCodes: [
    { id: '1', code: 'SAVE100', type: 'FIXED', value: 100, isActive: true, usedCount: 5, usageLimit: 100, expiryDate: '2025-12-31' },
    { id: '2', code: 'WELCOME10', type: 'PERCENT', value: 10, isActive: true, usedCount: 12, usageLimit: 500, expiryDate: '2025-12-31' }
  ],
  pendingVerifications: [],
  pendingListings: [],
  payoutRequests: [],
  conversations: [],
  messages: [],
  referrals: [],
  reviews: []
};

function handleLegacyRoute(path, method, body = null) {
  // Admin routes
  if (path === '/api/admin/blacklist') {
    return { success: true, data: MOCK_DATA.blacklist };
  }
  if (path === '/api/admin/promo-codes') {
    if (method === 'POST') {
      return { success: true, data: { id: Date.now(), ...body } };
    }
    return { success: true, data: MOCK_DATA.promoCodes };
  }
  if (path === '/api/admin/pending-verifications') {
    return { success: true, data: MOCK_DATA.pendingVerifications };
  }
  if (path === '/api/admin/pending-listings') {
    return { success: true, data: MOCK_DATA.pendingListings };
  }
  if (path.includes('/api/admin/payout-requests')) {
    return { success: true, data: MOCK_DATA.payoutRequests };
  }
  if (path === '/api/admin/settings') {
    return { 
      success: true, 
      data: { 
        defaultCommissionRate: 15, 
        maintenanceMode: false, 
        heroTitle: 'Luxury Rentals in Phuket',
        heroSubtitle: 'Villas, Bikes, Yachts & Tours'
      } 
    };
  }
  if (path === '/api/admin/users') {
    return { success: true, data: [] };
  }
  if (path === '/api/admin/categories') {
    // Redirect to v2
    return 'REDIRECT:/api/v2/categories?all=true';
  }
  if (path.includes('/api/admin/blacklist/wallet') || path.includes('/api/admin/blacklist/phone')) {
    return { success: true, data: { id: Date.now() } };
  }
  
  // Partner routes
  if (path.includes('/api/partner/stats')) {
    return 'REDIRECT:/api/v2/partner/stats';
  }
  if (path.includes('/api/partner/listings')) {
    return 'REDIRECT:/api/v2/partner/listings';
  }
  if (path.includes('/api/partner/bookings')) {
    return 'REDIRECT:/api/v2/bookings';
  }
  if (path.includes('/api/partner/balance')) {
    return { 
      success: true, 
      data: { 
        totalEarnings: 125000, 
        availableBalance: 25000, 
        escrowBalance: 50000, 
        pendingPayouts: 0 
      } 
    };
  }
  if (path.includes('/api/partner/payouts')) {
    if (method === 'POST') {
      return { success: true, data: { id: Date.now(), status: 'PENDING' } };
    }
    return { success: true, data: [] };
  }
  if (path.includes('/api/partner/referrals')) {
    return { success: true, data: MOCK_DATA.referrals };
  }
  if (path.includes('/api/partner/reviews')) {
    return { success: true, data: MOCK_DATA.reviews };
  }
  
  // Profile routes
  if (path === '/api/profile') {
    return 'REDIRECT:/api/v2/profile';
  }
  if (path === '/api/profile/notifications') {
    return { success: true, data: { email: true, telegram: false } };
  }
  
  // Categories
  if (path === '/api/categories') {
    return 'REDIRECT:/api/v2/categories';
  }
  
  // Messages & Conversations
  if (path.includes('/api/conversations')) {
    return { success: true, data: MOCK_DATA.conversations };
  }
  if (path === '/api/messages') {
    if (method === 'POST') {
      return { success: true, data: { id: Date.now(), ...body } };
    }
    return { success: true, data: MOCK_DATA.messages };
  }
  
  // Promo codes validation
  if (path === '/api/promo-codes/validate') {
    return 'REDIRECT:/api/v2/promo-codes/validate';
  }
  
  // Reviews
  if (path === '/api/reviews') {
    if (method === 'POST') {
      return { success: true, data: { id: Date.now(), ...body } };
    }
    return { success: true, data: MOCK_DATA.reviews };
  }
  
  // Telegram
  if (path === '/api/telegram/link-code') {
    return { success: true, data: { code: 'FR_' + Math.random().toString(36).substr(2, 8).toUpperCase() } };
  }
  
  // Webhooks
  if (path.includes('/api/webhooks/crypto/confirm')) {
    return { success: true, data: { verified: true, amount: body?.amount || 0 } };
  }
  
  // Default - not found
  return null;
}

export async function GET(request, { params }) {
  const path = '/api/' + (params.path?.join('/') || '');
  const result = handleLegacyRoute(path, 'GET');
  
  if (result === null) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  
  if (typeof result === 'string' && result.startsWith('REDIRECT:')) {
    const redirectPath = result.replace('REDIRECT:', '');
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }
  
  return NextResponse.json(result);
}

export async function POST(request, { params }) {
  const path = '/api/' + (params.path?.join('/') || '');
  let body = null;
  
  try {
    body = await request.json();
  } catch (e) {
    // No body
  }
  
  const result = handleLegacyRoute(path, 'POST', body);
  
  if (result === null) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  
  if (typeof result === 'string' && result.startsWith('REDIRECT:')) {
    const redirectPath = result.replace('REDIRECT:', '');
    // For POST redirects, we need to actually call the target
    const targetUrl = new URL(redirectPath, request.url);
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res;
  }
  
  return NextResponse.json(result);
}

export async function PUT(request, { params }) {
  const path = '/api/' + (params.path?.join('/') || '');
  let body = null;
  
  try {
    body = await request.json();
  } catch (e) {
    // No body
  }
  
  const result = handleLegacyRoute(path, 'PUT', body);
  
  if (result === null) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  
  return NextResponse.json(result);
}

export async function DELETE(request, { params }) {
  const path = '/api/' + (params.path?.join('/') || '');
  const result = handleLegacyRoute(path, 'DELETE');
  
  if (result === null) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  
  return NextResponse.json({ success: true });
}
