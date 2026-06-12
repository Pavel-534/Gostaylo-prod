import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import { referralStatsCalendarMonthStartUtcIso } from '@/lib/referral/resolve-referral-stats-timezone';
import { recordCriticalSignal } from '@/lib/critical-telemetry.js';
import { makeId } from '@/lib/services/marketing/referral-calculation.js';
import { resolveReferrerByVanityCode, normalizeVanityCode } from '@/lib/services/marketing/referral-vanity.service.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function normalizeFingerprint(value) {
  const fp = String(value || '').trim();
  if (!fp) return null;
  return fp.slice(0, 160);
}

function normalizeNameLike(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё]/gi, '')
    .slice(0, 32);
}

export function resolveClientIpFromRequest(request) {
  const forwarded = request?.headers?.get('x-forwarded-for');
  const realIp = request?.headers?.get('x-real-ip');
  return String(forwarded || realIp || '')
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

export class ReferralGuardService {
  static async listFraudQueue({ status = 'open', limit = 100 } = {}) {
    let q = supabaseAdmin
      .from('referral_fraud_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(500, Number(limit) || 100)));
    if (status && status !== 'all') q = q.eq('status', String(status).trim().toLowerCase());
    const { data, error } = await q;
    if (error) {
      if (String(error.message || '').includes('does not exist')) return [];
      throw new Error(error.message || 'FRAUD_QUEUE_LIST_FAILED');
    }
    return Array.isArray(data) ? data : [];
  }

  static async reviewFraudQueueItem({
    id,
    action,
    adminUserId = null,
    note = null,
  } = {}) {
    const safeId = String(id || '').trim();
    const safeAction = String(action || '').trim().toLowerCase();
    if (!safeId) throw new Error('FRAUD_QUEUE_ID_REQUIRED');
    if (!['approved', 'blocked', 'flagged'].includes(safeAction)) {
      throw new Error('FRAUD_QUEUE_ACTION_INVALID');
    }
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('referral_fraud_queue')
      .update({
        status: safeAction,
        reviewed_by: adminUserId ? String(adminUserId) : null,
        reviewed_at: nowIso,
        review_note: String(note || '').trim() || null,
        updated_at: nowIso,
      })
      .eq('id', safeId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message || 'FRAUD_QUEUE_REVIEW_FAILED');
    return data || null;
  }

  static async enqueueFraudQueue({
    severity = 'review',
    source = 'register',
    ruleCodes = [],
    reason = '',
    referrerId = null,
    candidateUserId = null,
    candidateEmail = null,
    referralCode = null,
    campaignSlug = null,
    metadata = {},
  } = {}) {
    try {
      await supabaseAdmin.from('referral_fraud_queue').insert({
        id: makeId('rfq'),
        status: severity === 'block' ? 'blocked' : 'open',
        severity: severity === 'block' ? 'block' : 'review',
        source,
        referral_code: referralCode || null,
        referrer_id: referrerId || null,
        candidate_user_id: candidateUserId || null,
        candidate_email: candidateEmail || null,
        campaign_slug: campaignSlug || null,
        rule_codes: Array.isArray(ruleCodes) ? ruleCodes : [],
        reason: String(reason || '').slice(0, 500) || null,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      });
    } catch {
      // table may be absent before migration
    }
    recordCriticalSignal('REFERRAL_FRAUD_SIGNAL', {
      threshold: 1,
      windowMs: 60_000,
      tag: '[REFERRAL_FRAUD]',
      detailLines: [
        `severity: ${severity}`,
        `source: ${source}`,
        `rules: ${(ruleCodes || []).join(',') || '-'}`,
        `referrer: ${String(referrerId || '-')}`,
        `candidate: ${String(candidateUserId || candidateEmail || '-')}`,
      ],
    });
  }

  static async runFraudChecksV2({
    source = 'register',
    referrerId,
    candidateUserId = null,
    candidateEmail = null,
    request = null,
    fingerprint = null,
    referrerProfile = null,
  } = {}) {
    const rulesTriggered = [];
    const fp = normalizeFingerprint(fingerprint);
    const clientIp = resolveClientIpFromRequest(request);
    const ipHash = clientIp
      ? Buffer.from(clientIp).toString('base64').slice(0, 48)
      : null;
    const deviceClusterKey = [fp || '', ipHash || ''].filter(Boolean).join('|');

    const referrerIdSafe = String(referrerId || '').trim();
    const candidateId = String(candidateUserId || '').trim();
    const candidateEmailNorm = normalizeEmail(candidateEmail);

    // Self-referral chain and direct checks.
    if (candidateId && referrerIdSafe && candidateId === referrerIdSafe) {
      rulesTriggered.push('SELF_BY_ID');
      return { severity: 'block', rulesTriggered, reason: 'REFERRAL_SELF_BY_ID' };
    }

    if (candidateId && referrerIdSafe) {
      const { data: refChain } = await supabaseAdmin
        .from('referral_relations')
        .select('ancestor_path')
        .eq('referee_id', referrerIdSafe)
        .maybeSingle();
      const ancestors = Array.isArray(refChain?.ancestor_path) ? refChain.ancestor_path.map(String) : [];
      if (ancestors.includes(candidateId)) {
        rulesTriggered.push('SELF_CHAIN_LOOP');
        return { severity: 'block', rulesTriggered, reason: 'REFERRAL_SELF_CHAIN_LOOP' };
      }
    }

    // Device/IP velocity: converted attributions per short windows.
    if (fp) {
      const since10m = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: fpRecent } = await supabaseAdmin
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', fp)
        .gte('created_at', since10m);
      if (Number(fpRecent || 0) >= 6) rulesTriggered.push('VELOCITY_DEVICE_10M');
    }
    if (clientIp) {
      const since60m = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const ipToken = Buffer.from(clientIp).toString('base64').slice(0, 48);
      const { count: ipRecent } = await supabaseAdmin
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .contains('metadata', { ip_token: ipToken })
        .gte('created_at', since60m);
      if (Number(ipRecent || 0) >= 18) rulesTriggered.push('VELOCITY_IP_60M');
    }

    // Pattern checks: throwaway domains and look-alike names under same domain.
    if (candidateEmailNorm) {
      const domain = candidateEmailNorm.split('@')[1] || '';
      if (/(mailinator|guerrillamail|temp-mail|10minutemail|yopmail)/.test(domain)) {
        rulesTriggered.push('THROWAWAY_DOMAIN');
      }
      if (domain) {
        const { data: sameDomainRows } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name')
          .ilike('email', `%@${domain}`)
          .limit(60);
        if (Array.isArray(sameDomainRows) && sameDomainRows.length >= 20) {
          rulesTriggered.push('DOMAIN_CLUSTER');
          const targetName = normalizeNameLike(
            `${referrerProfile?.first_name || ''}${referrerProfile?.last_name || ''}`,
          );
          if (targetName) {
            const sameNameCount = sameDomainRows.filter((r) => {
              const n = normalizeNameLike(`${r.first_name || ''}${r.last_name || ''}`);
              return n && n === targetName;
            }).length;
            if (sameNameCount >= 3) rulesTriggered.push('LOOKALIKE_NAME_CLUSTER');
          }
        }
      }
    }

    // Cluster re-use across referrers.
    if (fp || clientIp) {
      let q = supabaseAdmin
        .from('referral_relations')
        .select('referrer_id, metadata')
        .limit(120);
      if (fp) q = q.contains('metadata', { device_fingerprint: fp });
      const { data: clusterRows } = await q;
      const differentReferrers = new Set(
        (clusterRows || [])
          .map((r) => String(r.referrer_id || '').trim())
          .filter((id) => id && id !== referrerIdSafe),
      );
      if (differentReferrers.size >= 2) rulesTriggered.push('DEVICE_GRAPH_MULTI_REFERRER');
    }

    const severity = rulesTriggered.some((x) => x.startsWith('SELF_') || x.includes('MULTI_REFERRER'))
      ? 'block'
      : rulesTriggered.length
        ? 'review'
        : 'allow';
    return {
      severity,
      rulesTriggered,
      reason: rulesTriggered.join(',') || null,
      metadata: {
        source,
        ip: clientIp || null,
        fingerprint: fp,
        ip_token: ipHash,
        device_cluster_key: deviceClusterKey || null,
      },
    };
  }

  static async getMonthlyReferralsLimit() {
    const general = await PricingService.getGeneralPricingSettings();
    const raw = Number(
      general?.referral_monthly_limit_per_user ?? general?.referralMonthlyLimitPerUser,
    );
    if (!Number.isFinite(raw) || raw < 1) return 30;
    return Math.min(500, Math.floor(raw));
  }

  static async resolveReferrerByCode(codeRaw) {
    const raw = String(codeRaw || '').trim();
    if (!raw) return { error: 'REFERRAL_CODE_REQUIRED', status: 400 };

    // Vanity slug: lowercase + hyphens (e.g. phuket-pasha)
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeVanityCode(raw))) {
      const vanity = await resolveReferrerByVanityCode(raw);
      if (vanity.data) return vanity;
      if (vanity.error === 'VANITY_CODE_NOT_FOUND') {
        // fall through to standard code lookup
      } else if (vanity.error) {
        return vanity;
      }
    }

    const code = normalizeCode(codeRaw);

    const { data: byNewTable } = await supabaseAdmin
      .from('referral_codes')
      .select('id, user_id, code, is_active, campaign_slug, metadata')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    if (byNewTable?.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id,email,referral_code,iana_timezone')
        .eq('id', byNewTable.user_id)
        .maybeSingle();
      if (!profile?.id) return { error: 'REFERRAL_REFERRER_NOT_FOUND', status: 404 };
      const campaignSlug =
        String(byNewTable?.campaign_slug || byNewTable?.metadata?.campaign_slug || '').trim() || null
      return { data: { referrerProfile: profile, referralCodeRow: byNewTable, code, campaignSlug } };
    }

    const { data: legacy } = await supabaseAdmin
      .from('profiles')
      .select('id,email,referral_code,iana_timezone')
      .eq('referral_code', code)
      .maybeSingle();
    if (!legacy?.id) return { error: 'REFERRAL_CODE_NOT_FOUND', status: 404 };
    return { data: { referrerProfile: legacy, referralCodeRow: null, code, campaignSlug: null } };
  }

  static async validateActivation({
    code,
    candidateUserId = null,
    candidateEmail = null,
    request = null,
    fingerprint = null,
  }) {
    const resolved = await this.resolveReferrerByCode(code);
    if (resolved.error) return { success: false, error: resolved.error, status: resolved.status };
    const { referrerProfile, referralCodeRow, code: normalizedCode } = resolved.data;

    const referrerId = String(referrerProfile.id || '').trim();
    const candidateId = String(candidateUserId || '').trim();
    const candidateEmailNorm = normalizeEmail(candidateEmail);
    const referrerEmailNorm = normalizeEmail(referrerProfile.email);
    const clientIp = resolveClientIpFromRequest(request);
    const fp = normalizeFingerprint(fingerprint);

    if (candidateId && candidateId === referrerId) {
      return { success: false, error: 'REFERRAL_SELF_BY_ID', status: 400 };
    }
    if (candidateEmailNorm && referrerEmailNorm && candidateEmailNorm === referrerEmailNorm) {
      return { success: false, error: 'REFERRAL_SELF_BY_EMAIL', status: 400 };
    }

    const ownerIp = String(referralCodeRow?.metadata?.owner_ip || '').trim();
    if (ownerIp && clientIp && ownerIp === clientIp) {
      return { success: false, error: 'REFERRAL_SELF_BY_IP', status: 400 };
    }

    if (fp) {
      const { data: fpRows } = await supabaseAdmin
        .from('referral_relations')
        .select('id, referrer_id, metadata')
        .contains('metadata', { device_fingerprint: fp })
        .limit(5);
      const fpLinkedToOtherReferrer = (fpRows || []).some(
        (row) => String(row.referrer_id || '') && String(row.referrer_id || '') !== referrerId,
      );
      if (fpLinkedToOtherReferrer) {
        return { success: false, error: 'REFERRAL_DEVICE_ALREADY_USED', status: 429 };
      }
    }

    const fraud = await this.runFraudChecksV2({
      source: 'register',
      referrerId,
      candidateUserId,
      candidateEmail,
      request,
      fingerprint,
      referrerProfile,
    });
    if (fraud.severity === 'block') {
      await this.enqueueFraudQueue({
        severity: 'block',
        source: 'register',
        ruleCodes: fraud.rulesTriggered,
        reason: fraud.reason,
        referrerId,
        candidateUserId,
        candidateEmail: candidateEmailNorm || null,
        referralCode: normalizedCode,
        campaignSlug: resolved.data.campaignSlug || null,
        metadata: fraud.metadata,
      });
      return { success: false, error: 'REFERRAL_FRAUD_BLOCKED', status: 429 };
    }
    if (fraud.severity === 'review') {
      await this.enqueueFraudQueue({
        severity: 'review',
        source: 'register',
        ruleCodes: fraud.rulesTriggered,
        reason: fraud.reason,
        referrerId,
        candidateUserId,
        candidateEmail: candidateEmailNorm || null,
        referralCode: normalizedCode,
        campaignSlug: resolved.data.campaignSlug || null,
        metadata: fraud.metadata,
      });
    }

    const limit = await this.getMonthlyReferralsLimit();
    const monthStartIso = referralStatsCalendarMonthStartUtcIso(referrerProfile);
    const { count } = await supabaseAdmin
      .from('referral_relations')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .gte('referred_at', monthStartIso);
    if (Number(count || 0) >= limit) {
      return {
        success: false,
        error: 'REFERRAL_MONTHLY_LIMIT_REACHED',
        status: 429,
        data: { limit, currentCount: Number(count || 0) },
      };
    }

    return {
      success: true,
      data: {
        code: normalizedCode,
        referrerId,
        referrerEmail: referrerProfile.email || null,
        referralCodeId: referralCodeRow?.id || null,
        clientIp,
        fingerprint: fp,
        monthlyLimit: limit,
        fraud: {
          suspicious: fraud.severity !== 'allow',
          severity: fraud.severity,
          rulesTriggered: fraud.rulesTriggered,
          reason: fraud.reason,
          metadata: fraud.metadata,
        },
      },
    };
  }
}

export default ReferralGuardService;

