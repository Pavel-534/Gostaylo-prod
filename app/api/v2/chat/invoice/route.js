/**
 * Gostaylo - Chat Invoice API
 * POST /api/v2/chat/invoice
 * 
 * Creates an invoice message in chat
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      conversationId, 
      senderId,
      senderName,
      amount, 
      currency = 'THB',
      paymentMethod = 'CRYPTO',
      description,
      bookingId,
      listingId,
      listingTitle,
      checkIn,
      checkOut
    } = body;

    if (!conversationId || !amount || !senderId) {
      return NextResponse.json(
        { success: false, error: 'conversationId, senderId and amount are required' },
        { status: 400 }
      );
    }

    // Generate invoice ID
    const invoiceId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Calculate USDT amount if THB
    const usdtAmount = currency === 'THB' 
      ? Math.round((parseFloat(amount) / 35.5) * 100) / 100 
      : parseFloat(amount);

    // Create invoice object
    const invoice = {
      id: invoiceId,
      amount: parseFloat(amount),
      amount_usdt: usdtAmount,
      amount_thb: currency === 'THB' ? parseFloat(amount) : Math.round(parseFloat(amount) * 35.5),
      currency,
      payment_method: paymentMethod,
      status: 'PENDING',
      description,
      booking_id: bookingId,
      listing: {
        id: listingId,
        title: listingTitle
      },
      check_in: checkIn,
      check_out: checkOut,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    const line = `💳 Invoice: ${currency === 'THB' ? '฿' : '$'}${parseFloat(amount).toLocaleString()} ${currency}`

    const { error: invTableError } = await supabaseAdmin.from('invoices').insert({
      id: invoiceId,
      conversation_id: conversationId,
      booking_id: bookingId || null,
      amount: parseFloat(amount),
      status: 'pending',
      metadata: {
        currency,
        payment_method: paymentMethod,
        description: description || null,
        listing: invoice.listing,
        check_in: checkIn,
        check_out: checkOut,
      },
    })
    if (invTableError) {
      console.warn('[INVOICE] invoices table:', invTableError.message)
    }

    const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: 'PARTNER',
        sender_name: senderName || 'Partner',
        message: line,
        content: line,
        type: 'invoice',
        metadata: {
          invoice,
          invoice_id: invoiceId,
        },
      })
      .select()
      .single();

    if (messageError) {
      console.error('[INVOICE CREATE ERROR]', messageError);
      return NextResponse.json(
        { success: false, error: messageError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message,
      invoice
    });

  } catch (error) {
    console.error('[INVOICE API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Get invoice by ID
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get('id');
  const conversationId = searchParams.get('conversationId');

  if (!invoiceId && !conversationId) {
    return NextResponse.json(
      { success: false, error: 'invoiceId or conversationId required' },
      { status: 400 }
    );
  }

  try {
    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .or('type.eq.invoice,type.eq.INVOICE');

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Extract invoices from messages
    const invoices = (data || []).map(m => ({
      messageId: m.id,
      ...m.metadata?.invoice,
      createdAt: m.created_at
    }));

    return NextResponse.json({
      success: true,
      invoices
    });

  } catch (error) {
    console.error('[GET INVOICES ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
