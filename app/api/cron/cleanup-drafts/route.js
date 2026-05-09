/**
 * GoStayLo - Draft Cleanup Cron Job
 * 
 * PURPOSE:
 * Clean up abandoned drafts older than 30 days.
 * A draft is: status='INACTIVE' AND metadata->is_draft=true
 * 
 * ACTIONS:
 * 1. Find drafts not modified in 30+ days
 * 2. Delete associated images from Storage
 * 3. Delete the listing record
 * 
 * SCHEDULE: Run daily via Vercel Cron or external service
 * 
 * Security: Requires CRON_SECRET header for manual triggers
 */

import { NextResponse } from 'next/server';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';
import { supabaseAdmin } from '@/lib/supabase';
import { BookingService } from '@/lib/services/booking.service';
import { NotificationEvents, NotificationService } from '@/lib/services/notification.service';
import DisputeService, { extractDisputeEvidenceObjectPaths } from '@/lib/services/dispute.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKETS = ['listing-images', 'listings'];

// Draft expiry in days
const DRAFT_EXPIRY_DAYS = 30;

/** Dispute evidence: delete storage objects after dispute is terminal and old (see `processDisputeEvidenceRetention`). */
const DISPUTE_EVIDENCE_RETENTION_DAYS = 180;
const DISPUTE_EVIDENCE_BUCKET = 'dispute-evidence';
const TERMINAL_DISPUTE_STATUSES = ['RESOLVED', 'REJECTED', 'CLOSED'];
const PARTNER_RESPONSE_SLA_HOURS = 24;
const DEFAULT_INVOICE_EXPIRY_HOURS = 24;

/**
 * Delete images from Supabase Storage for a listing (per-URL; DB trigger also clears prefix on DELETE).
 */
async function deleteListingImages(listingId, images) {
  if (!images || images.length === 0) return { deleted: 0, errors: 0 };

  let deleted = 0;
  let errors = 0;

  for (const imageUrl of images) {
    try {
      let matched = false;
      for (const bucket of STORAGE_BUCKETS) {
        const re = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
        const match = imageUrl.match(re);
        if (!match) continue;
        matched = true;
        const filePath = match[1].split('?')[0].split('#')[0];
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        });
        if (res.ok) deleted++;
        else {
          errors++;
          console.log(`[CLEANUP] Failed to delete image: ${bucket}/${filePath}`);
        }
        break;
      }
      if (!matched) errors++;
    } catch (e) {
      errors++;
      console.error(`[CLEANUP] Error deleting image:`, e.message);
    }
  }

  return { deleted, errors };
}

function withHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function withHoursAfter(dateIso, hours) {
  const baseMs = Date.parse(String(dateIso || ''));
  if (!Number.isFinite(baseMs)) return null;
  return new Date(baseMs + hours * 60 * 60 * 1000).toISOString();
}

function resolveInvoiceExpiryIso(invoiceRow) {
  const meta = invoiceRow?.metadata && typeof invoiceRow.metadata === 'object' ? invoiceRow.metadata : {};
  const fromMeta = meta?.expires_at || meta?.invoice?.expires_at || null;
  const fallback = withHoursAfter(invoiceRow?.created_at, DEFAULT_INVOICE_EXPIRY_HOURS);
  return fromMeta || fallback || null;
}

async function notifyAutoExpiredBooking(booking) {
  const listingTitle = booking?.listing?.title || 'Listing';
  const partner = booking?.partner || {};
  const guest = booking?.renter || {};
  const partnerMessage = 'Заявка просрочена и отменена';
  const guestMessage = 'К сожалению, партнер не ответил. Попробуйте другой вариант';

  await NotificationService.dispatch(NotificationEvents.NEW_MESSAGE, {
    message: { message: partnerMessage, sender_name: 'System' },
    recipient: {
      telegram_id: partner.telegram_id || null,
      email: partner.email || null,
      name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim() || 'Partner',
    },
    sender: { name: 'System' },
    listing: { title: listingTitle },
    conversation: { listing_title: listingTitle },
  });

  await NotificationService.dispatch(NotificationEvents.NEW_MESSAGE, {
    message: { message: guestMessage, sender_name: 'System' },
    recipient: {
      telegram_id: guest.telegram_id || null,
      email: guest.email || booking?.guest_email || null,
      name:
        `${guest.first_name || ''} ${guest.last_name || ''}`.trim() ||
        booking?.guest_name ||
        'Guest',
    },
    sender: { name: 'System' },
    listing: { title: listingTitle },
    conversation: { listing_title: listingTitle },
  });
}

async function processExpiredBookingRequests() {
  const cutoffIso = withHoursAgo(PARTNER_RESPONSE_SLA_HOURS);
  const { data: staleRows, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      status,
      metadata,
      created_at,
      guest_email,
      guest_name,
      renter:renter_id(id,email,telegram_id,first_name,last_name),
      partner:partner_id(id,email,telegram_id,first_name,last_name),
      listing:listings(id,title)
      `,
    )
    .in('status', ['PENDING', 'INQUIRY'])
    .lt('created_at', cutoffIso)
    .limit(500);

  if (error) {
    return { success: false, error: error.message, scanned: 0, cancelled: 0, notifyErrors: 0 };
  }

  let cancelled = 0;
  let errors = 0;
  let notifyErrors = 0;

  for (const booking of staleRows || []) {
    const reasonCode = 'auto_expired_by_partner_sla';
    const statusResult = await BookingService.updateStatus(booking.id, 'CANCELLED', {
      reason: reasonCode,
    });
    if (!statusResult?.success) {
      errors++;
      continue;
    }

    const prevMeta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
    const nextMeta = {
      ...prevMeta,
      cancel_reason: reasonCode,
      auto_expired_by_partner_sla_at: new Date().toISOString(),
    };
    await supabaseAdmin.from('bookings').update({ metadata: nextMeta }).eq('id', booking.id);
    cancelled++;

    try {
      await notifyAutoExpiredBooking(booking);
    } catch (e) {
      notifyErrors++;
      console.warn('[CLEANUP] auto-expired notification failed', booking.id, e?.message);
    }
  }

  return {
    success: true,
    scanned: (staleRows || []).length,
    cancelled,
    errors,
    notifyErrors,
    cutoffIso,
  };
}

function disputeClosedReferenceMs(row) {
  const rMs = row?.resolved_at ? Date.parse(String(row.resolved_at)) : NaN;
  const uMs = row?.updated_at ? Date.parse(String(row.updated_at)) : NaN;
  return Number.isFinite(rMs) ? rMs : uMs;
}

/**
 * Remove dispute-evidence objects for disputes closed ≥ DISPUTE_EVIDENCE_RETENTION_DAYS.
 * Idempotent marker: disputes.metadata.dispute_evidence_storage_purged_at
 */
async function processDisputeEvidenceRetention() {
  const cutoffMs =
    Date.now() - DISPUTE_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { data: rows, error } = await supabaseAdmin
    .from('disputes')
    .select('id, status, resolved_at, updated_at, metadata')
    .in('status', TERMINAL_DISPUTE_STATUSES)
    .limit(500);

  if (error) {
    return {
      success: false,
      error: error.message,
      scanned: 0,
      disputesPurged: 0,
      filesRemoved: 0,
      removeErrors: 0,
    };
  }

  let disputesPurged = 0;
  let filesRemoved = 0;
  let removeErrors = 0;

  for (const row of rows || []) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    if (meta.dispute_evidence_storage_purged_at) continue;

    const refMs = disputeClosedReferenceMs(row);
    if (!Number.isFinite(refMs) || refMs > cutoffMs) continue;

    const urls = Array.isArray(meta.evidence_urls) ? meta.evidence_urls : [];
    const paths = extractDisputeEvidenceObjectPaths(urls);
    const nowIso = new Date().toISOString();

    if (!paths.length) {
      await supabaseAdmin
        .from('disputes')
        .update({
          metadata: {
            ...meta,
            dispute_evidence_storage_purged_at: nowIso,
          },
          updated_at: nowIso,
        })
        .eq('id', row.id);
      disputesPurged += 1;
      continue;
    }

    const { error: rmErr } = await supabaseAdmin.storage
      .from(DISPUTE_EVIDENCE_BUCKET)
      .remove(paths);
    if (rmErr) {
      removeErrors += 1;
      console.warn(
        `[CLEANUP] Dispute Evidence Retention: remove failed ${row.id}:`,
        rmErr.message,
      );
      continue;
    }

    filesRemoved += paths.length;
    await supabaseAdmin
      .from('disputes')
      .update({
        metadata: {
          ...meta,
          dispute_evidence_storage_purged_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq('id', row.id);
    disputesPurged += 1;
  }

  return {
    success: true,
    scanned: (rows || []).length,
    disputesPurged,
    filesRemoved,
    removeErrors,
    retentionDays: DISPUTE_EVIDENCE_RETENTION_DAYS,
  };
}

async function processExpiredPendingInvoices() {
  const nowMs = Date.now();
  const { data: pendingRows, error } = await supabaseAdmin
    .from('invoices')
    .select('id,status,metadata,created_at,updated_at')
    .eq('status', 'pending')
    .limit(1000);

  if (error) {
    return { success: false, error: error.message, scanned: 0, expired: 0 };
  }

  let expired = 0;
  let skipped = 0;

  for (const invoice of pendingRows || []) {
    const expiryIso = resolveInvoiceExpiryIso(invoice);
    const expiryMs = Date.parse(String(expiryIso || ''));
    if (!Number.isFinite(expiryMs) || expiryMs > nowMs) {
      skipped++;
      continue;
    }
    const { error: upErr } = await supabaseAdmin
      .from('invoices')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
        metadata: {
          ...(invoice.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {}),
          expired_at: new Date().toISOString(),
          expired_reason: 'payment_window_elapsed',
        },
      })
      .eq('id', invoice.id)
      .eq('status', 'pending');

    if (!upErr) expired++;
  }

  return {
    success: true,
    scanned: (pendingRows || []).length,
    expired,
    skipped,
  };
}

/**
 * POST /api/cron/cleanup-drafts
 * Main cleanup handler
 */
export async function POST(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  try {
    console.log('[CLEANUP] Starting draft cleanup job...');
    
    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DRAFT_EXPIRY_DAYS);
    const cutoffISO = cutoffDate.toISOString();
    
    console.log(`[CLEANUP] Looking for drafts not updated since: ${cutoffISO}`);
    
    // 1. Find abandoned drafts
    // Query: status=INACTIVE AND updated_at < cutoffDate
    // Then filter by metadata.is_draft = true (client-side)
    const listingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?status=eq.INACTIVE&updated_at=lt.${cutoffISO}&select=id,title,images,metadata,updated_at,owner_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    if (!listingsRes.ok) {
      const error = await listingsRes.text();
      console.error('[CLEANUP] Failed to fetch listings:', error);
      void notifySystemAlert(
        `⏰ <b>Cron: cleanup-drafts</b> — не удалось загрузить листинги\n<code>${escapeSystemAlertHtml(error.slice(0, 800))}</code>`,
      )
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
    }
    
    const allInactive = await listingsRes.json();
    
    // Filter for actual drafts (metadata.is_draft = true)
    const expiredDrafts = (allInactive || []).filter(listing => {
      return listing.metadata?.is_draft === true;
    });
    
    console.log(`[CLEANUP] Found ${expiredDrafts.length} expired drafts to clean up`);

    // 2. Process each expired draft (may be zero)
    let deletedCount = 0;
    let imagesDeletedCount = 0;
    let errorCount = 0;
    const deletedIds = [];
    
    for (const draft of expiredDrafts) {
      try {
        console.log(`[CLEANUP] Processing draft: ${draft.id} - "${draft.title}" (last updated: ${draft.updated_at})`);
        
        // Delete images first
        const imageResult = await deleteListingImages(draft.id, draft.images);
        imagesDeletedCount += imageResult.deleted;
        
        // Delete the listing record
        const deleteRes = await fetch(
          `${SUPABASE_URL}/rest/v1/listings?id=eq.${draft.id}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );
        
        if (deleteRes.ok) {
          deletedCount++;
          deletedIds.push(draft.id);
          console.log(`[CLEANUP] Deleted draft: ${draft.id}`);
        } else {
          errorCount++;
          console.error(`[CLEANUP] Failed to delete draft: ${draft.id}`);
        }
      } catch (e) {
        errorCount++;
        console.error(`[CLEANUP] Error processing draft ${draft.id}:`, e.message);
      }
    }
    
    const bookingSla = await processExpiredBookingRequests();
    const invoiceExpiry = await processExpiredPendingInvoices();
    const disputeEvidenceRetention = await processDisputeEvidenceRetention();
    const disputeSla72h = await DisputeService.processSlaBreaches({ limit: 300 });

    const result = {
      success: true,
      message:
        expiredDrafts.length === 0
          ? 'No expired drafts found'
          : `Cleaned up ${deletedCount} expired drafts`,
      stats: {
        scanned: allInactive?.length || 0,
        draftsFound: expiredDrafts.length,
        deleted: deletedCount,
        imagesDeleted: imagesDeletedCount,
        errors: errorCount,
        cutoffDate: cutoffISO,
        expiryDays: DRAFT_EXPIRY_DAYS,
        bookingSla24h: bookingSla,
        invoiceExpiry,
        disputeEvidenceRetention,
        disputeSla72h,
      },
      deletedIds,
    };
    
    console.log('[CLEANUP] Job completed:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[CLEANUP ERROR]', error);
    void notifySystemAlert(
      `⏰ <b>Cron: cleanup-drafts</b> (POST)\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json({ 
      error: 'Cleanup job failed', 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/cron/cleanup-drafts
 * Status endpoint - shows what would be cleaned up (dry run)
 */
export async function GET(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  try {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DRAFT_EXPIRY_DAYS);
    const cutoffISO = cutoffDate.toISOString();
    
    // Find drafts that would be cleaned up
    const listingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?status=eq.INACTIVE&updated_at=lt.${cutoffISO}&select=id,title,images,metadata,updated_at`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    const allInactive = await listingsRes.json();
    const expiredDrafts = (allInactive || []).filter(l => l.metadata?.is_draft === true);
    const bookingSlaCutoffIso = withHoursAgo(PARTNER_RESPONSE_SLA_HOURS);
    const { count: staleBookingCount } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING', 'INQUIRY'])
      .lt('created_at', bookingSlaCutoffIso);
    const { data: pendingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id,metadata,created_at,status')
      .eq('status', 'pending')
      .limit(1000);
    const expiredInvoiceCount = (pendingInvoices || []).reduce((acc, row) => {
      const expiryIso = resolveInvoiceExpiryIso(row);
      const expiryMs = Date.parse(String(expiryIso || ''));
      if (Number.isFinite(expiryMs) && expiryMs < Date.now()) return acc + 1;
      return acc;
    }, 0);

    const evidenceCutoffMs =
      Date.now() - DISPUTE_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const { data: terminalDisputes } = await supabaseAdmin
      .from('disputes')
      .select('id, resolved_at, updated_at, metadata')
      .in('status', TERMINAL_DISPUTE_STATUSES)
      .limit(500);
    const disputeEvidenceEligible = (terminalDisputes || []).filter((row) => {
      const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      if (meta.dispute_evidence_storage_purged_at) return false;
      const refMs = disputeClosedReferenceMs(row);
      return Number.isFinite(refMs) && refMs <= evidenceCutoffMs;
    }).length;
    
    // Calculate total storage that would be freed
    const totalImages = expiredDrafts.reduce((sum, d) => sum + (d.images?.length || 0), 0);
    
    return NextResponse.json({
      ok: true,
      service: 'Draft Cleanup Cron',
      dryRun: true,
      stats: {
        expiredDrafts: expiredDrafts.length,
        totalImages: totalImages,
        cutoffDate: cutoffISO,
        expiryDays: DRAFT_EXPIRY_DAYS,
        staleBookingsByPartnerSla24h: Number(staleBookingCount || 0),
        expiredPendingInvoices: expiredInvoiceCount,
        disputeEvidenceRetentionEligible: disputeEvidenceEligible,
        disputeEvidenceRetentionDays: DISPUTE_EVIDENCE_RETENTION_DAYS,
      },
      drafts: expiredDrafts.map(d => ({
        id: d.id,
        title: d.title,
        imagesCount: d.images?.length || 0,
        lastUpdated: d.updated_at
      }))
    });
    
  } catch (error) {
    void notifySystemAlert(
      `⏰ <b>Cron: cleanup-drafts</b> (GET dry-run)\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json({ 
      error: 'Failed to check drafts',
      message: error.message 
    }, { status: 500 });
  }
}
