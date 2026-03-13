/**
 * Database Migration: Add missing booking_status enum values
 * POST /api/admin/fix-enum
 * 
 * This fixes the 502 error caused by missing CHECKED_IN and PAID_ESCROW enum values
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  try {
    // Verify admin access
    const body = await request.json().catch(() => ({}));
    const adminSecret = body.secret || request.headers.get('x-admin-secret');
    
    if (adminSecret !== 'gostaylo-fix-2026') {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized. Provide secret in body or header.' 
      }, { status: 401 });
    }

    // SQL to add missing enum values
    const sql = `
      DO $$
      BEGIN
        -- Add CHECKED_IN if not exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumtypid = 'booking_status'::regtype AND enumlabel = 'CHECKED_IN'
        ) THEN
          ALTER TYPE booking_status ADD VALUE 'CHECKED_IN';
        END IF;
        
        -- Add PAID_ESCROW if not exists  
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumtypid = 'booking_status'::regtype AND enumlabel = 'PAID_ESCROW'
        ) THEN
          ALTER TYPE booking_status ADD VALUE 'PAID_ESCROW';
        END IF;
      END $$;
    `;

    // Try to execute via Supabase RPC (if available)
    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql_text: sql })
    });

    if (rpcResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Enum values added successfully via RPC',
        method: 'rpc'
      });
    }

    // RPC not available - return manual instructions
    return NextResponse.json({
      success: false,
      message: 'Manual SQL execution required',
      instructions: {
        step1: 'Go to Supabase SQL Editor',
        url: 'https://supabase.com/dashboard/project/vtzzcdsjwudkaloxhvnw/sql/new',
        step2: 'Copy and paste this SQL:',
        sql: `
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'CHECKED_IN';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'PAID_ESCROW';
        `.trim(),
        step3: 'Click "Run" to execute',
        step4: 'After success, restart the frontend service'
      }
    });

  } catch (error) {
    console.error('[FIX-ENUM ERROR]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  // Check current enum values
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        sql_text: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'booking_status'::regtype ORDER BY enumsortorder;`
      })
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        currentValues: data,
        requiredValues: ['PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'COMPLETED', 'REFUNDED', 'CHECKED_IN', 'PAID_ESCROW'],
        note: 'POST to this endpoint with secret to add missing values'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Cannot query enum values directly. Use Supabase SQL Editor.',
      fixUrl: 'https://supabase.com/dashboard/project/vtzzcdsjwudkaloxhvnw/sql/new',
      sqlToRun: `ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'CHECKED_IN';\nALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'PAID_ESCROW';`
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      manualFix: {
        url: 'https://supabase.com/dashboard/project/vtzzcdsjwudkaloxhvnw/sql/new',
        sql: `ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'CHECKED_IN';\nALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'PAID_ESCROW';`
      }
    });
  }
}
