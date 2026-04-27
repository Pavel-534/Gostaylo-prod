import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';

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

export function resolveClientIpFromRequest(request) {
  const forwarded = request?.headers?.get('x-forwarded-for');
  const realIp = request?.headers?.get('x-real-ip');
  return String(forwarded || realIp || '')
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

function monthStartIso() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return d.toISOString();
}

export class ReferralGuardService {
  static async getMonthlyReferralsLimit() {
    const general = await PricingService.getGeneralPricingSettings();
    const raw = Number(
      general?.referral_monthly_limit_per_user ?? general?.referralMonthlyLimitPerUser,
    );
    if (!Number.isFinite(raw) || raw < 1) return 30;
    return Math.min(500, Math.floor(raw));
  }

  static async resolveReferrerByCode(codeRaw) {
    const code = normalizeCode(codeRaw);
    if (!code) return { error: 'REFERRAL_CODE_REQUIRED', status: 400 };

    const { data: byNewTable } = await supabaseAdmin
      .from('referral_codes')
      .select('id, user_id, code, is_active, metadata')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    if (byNewTable?.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id,email,referral_code')
        .eq('id', byNewTable.user_id)
        .maybeSingle();
      if (!profile?.id) return { error: 'REFERRAL_REFERRER_NOT_FOUND', status: 404 };
      return { data: { referrerProfile: profile, referralCodeRow: byNewTable, code } };
    }

    const { data: legacy } = await supabaseAdmin
      .from('profiles')
      .select('id,email,referral_code')
      .eq('referral_code', code)
      .maybeSingle();
    if (!legacy?.id) return { error: 'REFERRAL_CODE_NOT_FOUND', status: 404 };
    return { data: { referrerProfile: legacy, referralCodeRow: null, code } };
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

    const limit = await this.getMonthlyReferralsLimit();
    const { count } = await supabaseAdmin
      .from('referral_relations')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .gte('referred_at', monthStartIso());
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
      },
    };
  }
}

export default ReferralGuardService;

