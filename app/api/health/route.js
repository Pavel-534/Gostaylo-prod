/**
 * Health Check Endpoint for Kubernetes / uptime probes
 * GET /api/health
 * Stage 202.6 — short CDN cache so probe storms do not burn serverless invocations.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gostaylo-frontend',
      uptime: process.uptime(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
      },
    },
  )
}
