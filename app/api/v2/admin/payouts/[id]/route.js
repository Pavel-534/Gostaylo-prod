/**
 * PATCH /api/v2/admin/payouts/[id] — ручной статус выплаты (PAID / FAILED) без банковского API.
 * PAID: финальная проводка PARTNER_EARNINGS → PARTNER_PAYOUTS_SETTLED (см. LedgerService.postPartnerPayoutObligationSettled).
 * Body: `{ "status": "PAID"|"FAILED", "adminNote"?: string }` — если ключ **adminNote** передан (в т.ч. пустая строка),
 * для **PAID** пишется **metadata.admin_marked_paid_note**, для **FAILED** — **metadata.admin_marked_failed_note** и **rejection_reason** (при непустом тексте).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import LedgerService from '@/lib/services/ledger.service';
import { generatePayoutRequestDocuments } from '@/lib/services/payout-document.service.js';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { userId: access.profile?.id || null };
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing payout id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const nextStatus = String(body?.status || '').toUpperCase();
  if (!['PAID', 'FAILED'].includes(nextStatus)) {
    return NextResponse.json(
      { success: false, error: 'status must be PAID or FAILED' },
      { status: 400 },
    );
  }

  const hasAdminNoteKey = body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'adminNote');
  const adminNoteStored = hasAdminNoteKey
    ? String(body.adminNote ?? '')
        .trim()
        .slice(0, 2000)
    : null;

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('payouts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }
  if (!row?.id) {
    return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 });
  }

  const cur = String(row.status || '').toUpperCase();
  if (nextStatus === 'PAID') {
    if (!['PROCESSING', 'PENDING'].includes(cur)) {
      return NextResponse.json(
        { success: false, error: `Cannot mark PAID from status ${cur}` },
        { status: 409 },
      );
    }

    const ledger = await LedgerService.postPartnerPayoutObligationSettled(row);
    if (!ledger.success) {
      return NextResponse.json(
        { success: false, error: ledger.error || 'ledger_failed', ledger },
        { status: 500 },
      );
    }

    const prevMeta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('payouts')
      .update({
        status: 'PAID',
        processed_at: new Date().toISOString(),
        metadata: {
          ...prevMeta,
          admin_marked_paid_at: new Date().toISOString(),
          admin_marked_paid_by: auth.userId,
          ...(hasAdminNoteKey ? { admin_marked_paid_note: adminNoteStored } : {}),
          ledger_journal_id: ledger.journalId || prevMeta.ledger_journal_id || null,
        },
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
    }

    let documents = null;
    try {
      documents = await generatePayoutRequestDocuments(updated || row);
    } catch (docErr) {
      console.error('[admin/payouts PAID] PDF', id, docErr);
    }

    return NextResponse.json({
      success: true,
      data: { payout: updated, ledger, documents },
    });
  }

  /* FAILED */
  if (cur !== 'PROCESSING') {
    return NextResponse.json(
      { success: false, error: `Cannot mark FAILED from status ${cur}` },
      { status: 409 },
    );
  }

  const prevMeta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
  const { data: updated, error: upErr } = await supabaseAdmin
    .from('payouts')
    .update({
      status: 'FAILED',
      processed_at: new Date().toISOString(),
      rejection_reason:
        (hasAdminNoteKey ? adminNoteStored : null) || row.rejection_reason || 'Bank / manual failure',
      metadata: {
        ...prevMeta,
        admin_marked_failed_at: new Date().toISOString(),
        admin_marked_failed_by: auth.userId,
        ...(hasAdminNoteKey ? { admin_marked_failed_note: adminNoteStored } : {}),
      },
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { payout: updated } });
}
