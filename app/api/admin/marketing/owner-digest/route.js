import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import buildOwnerMarketingDigestReport from '@/lib/analytics/reports/owner-marketing-digest.report.js';
import {
  loadOwnerDigestSettings,
  saveOwnerDigestSettings,
  sendOwnerMarketingDigest,
} from '@/lib/services/marketing/owner-marketing-digest.service.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/marketing/owner-digest — настройки + превью дайджеста
 * PUT — сохранить настройки { enabled, emailEnabled, telegramEnabled, recipientEmails }
 * POST — { action: 'send_test' } отправить сейчас (без dedup week)
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const [settings, preview] = await Promise.all([
      loadOwnerDigestSettings(),
      buildOwnerMarketingDigestReport({ skipCache: true }),
    ]);
    return NextResponse.json({ success: true, settings, preview });
  } catch (error) {
    console.error('[admin/marketing/owner-digest GET]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'OWNER_DIGEST_READ_FAILED' },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const body = await request.json();
    const settings = await saveOwnerDigestSettings({
      enabled: body.enabled,
      emailEnabled: body.emailEnabled,
      telegramEnabled: body.telegramEnabled,
      recipientEmails: body.recipientEmails,
    });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[admin/marketing/owner-digest PUT]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'OWNER_DIGEST_SAVE_FAILED' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'send_test');

    if (action === 'send_test' || action === 'send_now') {
      const result = await sendOwnerMarketingDigest({
        force: true,
        skipWeeklyDedup: action === 'send_test',
      });
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ success: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
  } catch (error) {
    console.error('[admin/marketing/owner-digest POST]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'OWNER_DIGEST_SEND_FAILED' },
      { status: 500 },
    );
  }
}
