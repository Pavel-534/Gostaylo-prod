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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKETS = ['listing-images', 'listings'];

// Draft expiry in days
const DRAFT_EXPIRY_DAYS = 30;

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
    
    if (expiredDrafts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired drafts found',
        stats: {
          scanned: allInactive?.length || 0,
          deleted: 0,
          imagesDeleted: 0,
          cutoffDate: cutoffISO
        }
      });
    }
    
    // 2. Process each expired draft
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
    
    const result = {
      success: true,
      message: `Cleaned up ${deletedCount} expired drafts`,
      stats: {
        scanned: allInactive?.length || 0,
        draftsFound: expiredDrafts.length,
        deleted: deletedCount,
        imagesDeleted: imagesDeletedCount,
        errors: errorCount,
        cutoffDate: cutoffISO,
        expiryDays: DRAFT_EXPIRY_DAYS
      },
      deletedIds
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
        expiryDays: DRAFT_EXPIRY_DAYS
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
