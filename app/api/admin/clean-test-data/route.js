/**
 * POST /api/admin/clean-test-data
 * Stage 106.4 — удаление smoke / E2E / financial-test данных (только ADMIN).
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'
import {
  runFintechTestDataCleanup,
  sumFintechCleanupDeleted,
} from '@/lib/admin/fintech-test-data-cleanup.service.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'no_db' }, { status: 503 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.confirm !== true && body.confirmPhrase !== 'УДАЛИТЬ ТЕСТ') {
    return NextResponse.json(
      {
        success: false,
        error: 'confirmation_required',
        message: 'Подтвердите удаление: передайте confirm: true или confirmPhrase: «УДАЛИТЬ ТЕСТ»',
      },
      { status: 400 },
    )
  }

  const dryRun = body.dryRun === true
  const startedAt = new Date().toISOString()

  try {
    const report = await runFintechTestDataCleanup(supabaseAdmin, {
      dryRun,
      protectListingIds: Array.isArray(body.protectListingIds)
        ? body.protectListingIds.map(String)
        : undefined,
    })

    const total = dryRun
      ? report.totalWouldDelete ?? 0
      : report.totalDeleted ?? sumFintechCleanupDeleted(report.deleted)

    if (!dryRun) {
      const { error: logErr } = await supabaseAdmin.from('ops_job_runs').insert({
        job_name: 'admin-clean-test-data',
        status: 'success',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        stats: { totalDeleted: total, deleted: report.deleted, adminId: gate.profile?.id },
        error_message: null,
      })
      if (logErr && !String(logErr.message || '').includes('Could not find the table')) {
        console.warn('[clean-test-data] ops_job_runs:', logErr.message)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        total,
        message: dryRun
          ? `Будет удалено ~${total} сущностей (dry-run)`
          : `Тестовые данные удалены (${total} записей)`,
      },
    })
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[clean-test-data]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
