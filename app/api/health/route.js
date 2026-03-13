/**
 * Health Check Endpoint for Kubernetes
 * GET /api/health
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gostaylo-frontend',
    uptime: process.uptime()
  });
}
