/**
 * Admin — моментальный сброс geo-schema cache.
 *
 * Use-case: после применения миграции `20260201_global_pivot.sql`
 * schema-probe кеширует отсутствие колонок на 5 минут. Этот endpoint
 * позволяет сбросить кеш руками и сразу увидеть эффект.
 *
 * Защита: требует заголовок x-admin-token === ADMIN_REFRESH_TOKEN
 * (опциональная env; если не задана — endpoint работает без токена,
 * т.к. никаких секретов не раскрывает, только re-probe).
 *
 * @created 2026-02 Global DB Sprint — DB Prep
 */

import { NextResponse } from 'next/server'
import { invalidateGeoSchemaCache, getGeoSchemaState } from '@/lib/api/geo-schema-probe'
import { requireAccess } from '@/lib/security/access-guard'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const access = await requireAccess({ roles: ['ADMIN'] })
  if (access.error) return access.error

  invalidateGeoSchemaCache()
  const fresh = await getGeoSchemaState()

  return NextResponse.json({
    success: true,
    schema: fresh,
    timestamp: new Date().toISOString(),
  })
}

export async function GET(request) {
  return POST(request)
}
