/**
 * FunnyRent 2.1 - Districts API (v2)
 * GET /api/v2/districts - Get Phuket districts
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Phuket districts (static data)
const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
];

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    data: DISTRICTS 
  });
}
