/**
 * Sync Supabase Auth user → public.profiles (SSOT: profiles row by email / auth_user_id).
 * Stage 79.0 — OAuth (Google в UI); Stage 78.0 legal_terms_accepted_at.
 */
import { PricingService } from '@/lib/services/pricing.service';
import ReferralGuardService, {
  resolveClientIpFromRequest,
} from '@/lib/services/marketing/referral-guard.service';
import WalletService from '@/lib/services/finance/wallet.service';
import { computeInviteTreeFields } from '@/lib/referral/referral-network.js';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeReferralCode(profileId) {
  const clean = String(profileId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `AIR-${clean || Math.floor(100000 + Math.random() * 900000)}`;
}

function displayNameParts(meta) {
  const m = meta || {};
  if (typeof m.full_name === 'string' && m.full_name.trim()) {
    const p = m.full_name.trim().split(/\s+/);
    return { first: p[0] || '', last: p.slice(1).join(' ') || null };
  }
  if (typeof m.name === 'string' && m.name.trim()) {
    const p = m.name.trim().split(/\s+/);
    return { first: p[0] || '', last: p.slice(1).join(' ') || null };
  }
  if (m.name && typeof m.name === 'object') {
    const first = String(m.name.firstName || m.name.first_name || '').trim();
    const last = String(m.name.lastName || m.name.last_name || '').trim();
    return { first: first || '', last: last || null };
  }
  const given = typeof m.given_name === 'string' ? m.given_name.trim() : '';
  const family = typeof m.family_name === 'string' ? m.family_name.trim() : '';
  return { first: given || '', last: family || null };
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabaseAdmin — service role
 * @param {import('@supabase/supabase-js').User} opts.authUser
 * @param {boolean} opts.legalAcceptedFromRegisterFlow — пользователь ставил галочку до OAuth (cookie)
 * @param {Request} [opts.request] — referral IP / fingerprint
 */
export async function upsertOAuthProfile({ supabaseAdmin, authUser, legalAcceptedFromRegisterFlow, request }) {
  const authUid = authUser?.id ? String(authUser.id).trim() : '';
  const emailRaw = authUser?.email ? String(authUser.email).trim() : '';
  if (!authUid) {
    return { ok: false, error: 'NO_AUTH_UID', profile: null, created: false };
  }
  if (!emailRaw) {
    return { ok: false, error: 'NO_EMAIL_FROM_PROVIDER', profile: null, created: false };
  }
  const normalizedEmail = emailRaw.toLowerCase();

  /** @type {string | undefined} */
  let cookieReferralRaw = '';
  try {
    cookieReferralRaw = request?.cookies?.get?.('gostaylo_pending_ref')?.value || '';
  } catch {
    cookieReferralRaw = '';
  }
  let mergedReferral = '';
  try {
    mergedReferral = decodeURIComponent(String(cookieReferralRaw || '').trim()).trim().toUpperCase();
  } catch {
    mergedReferral = String(cookieReferralRaw || '').trim().toUpperCase();
  }
  if (!mergedReferral && request) {
    try {
      const fromAttribution = await ReferralAttributionService.resolveCodeForSignup({
        request,
        fingerprint: null,
      });
      if (fromAttribution?.code) mergedReferral = fromAttribution.code;
    } catch {
      /* ignore */
    }
  }

  const { data: byAuthId } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUid)
    .maybeSingle();

  let profile = byAuthId;

  if (!profile) {
    const { data: byEmailExact } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', emailRaw)
      .maybeSingle();
    if (byEmailExact) profile = byEmailExact;
  }
  if (!profile) {
    const { data: byEmailLc } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();
    profile = byEmailLc;
  }

  if (profile) {
    const existingAuth = profile.auth_user_id ? String(profile.auth_user_id).trim() : '';
    if (existingAuth && existingAuth !== authUid) {
      return { ok: false, error: 'AUTH_PROFILE_AUTH_CONFLICT', profile: null, created: false };
    }
  }

  if (profile?.is_banned === true) {
    return { ok: false, error: 'ACCOUNT_SUSPENDED', profile: null, created: false };
  }

  const meta = authUser.user_metadata || {};
  const avatarUrl =
    typeof meta.avatar_url === 'string'
      ? meta.avatar_url.trim()
      : typeof meta.picture === 'string'
        ? meta.picture.trim()
        : null;
  const { first: gnFirst, last: gnLast } = displayNameParts(meta);

  if (profile) {
    const hasAcceptedTerms =
      profile.terms_accepted === true ||
      Boolean(profile.terms_accepted_at || profile.legal_terms_accepted_at);
    const updates = {
      updated_at: new Date().toISOString(),
      auth_user_id: authUid,
      is_verified: true,
    };
    const role = String(profile.role || 'RENTER').toUpperCase();
    const staff = role === 'ADMIN' || role === 'MODERATOR';
    if (!profile.avatar && avatarUrl) {
      updates.avatar = avatarUrl;
    }
    if (!staff) {
      if (!profile.first_name && gnFirst) updates.first_name = gnFirst;
      if (!profile.last_name && gnLast) updates.last_name = gnLast;
    }

    let legalAcceptedAt = profile.legal_terms_accepted_at || profile.terms_accepted_at || null;
    if (legalAcceptedFromRegisterFlow && !hasAcceptedTerms) {
      legalAcceptedAt = new Date().toISOString();
      updates.terms_accepted = true;
      updates.terms_accepted_at = legalAcceptedAt;
      updates.legal_terms_accepted_at = legalAcceptedAt;
    }

    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    if (upErr) {
      console.error('[OAUTH PROFILE] merge update:', upErr.message);
      return { ok: false, error: upErr.message || 'MERGE_FAILED', profile: null, created: false };
    }

    const { data: fresh } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single();

    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', profile.id);

    const outLegal =
      fresh?.terms_accepted_at ??
      fresh?.legal_terms_accepted_at ??
      updates.terms_accepted_at ??
      updates.legal_terms_accepted_at ??
      profile.terms_accepted_at ??
      profile.legal_terms_accepted_at;
    const outAccepted =
      fresh?.terms_accepted === true ||
      updates.terms_accepted === true ||
      profile.terms_accepted === true ||
      Boolean(outLegal);

    return {
      ok: true,
      profile: fresh || { ...profile, ...updates },
      created: false,
      needsLegalCompletion: !outAccepted,
    };
  }

  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const refCode = makeReferralCode(profileId);

  let prevalidatedReferral = null;
  if (mergedReferral) {
    const guard = await ReferralGuardService.validateActivation({
      code: mergedReferral,
      candidateEmail: normalizedEmail,
      request: request || null,
      fingerprint: null,
    });
    if (guard.success) {
      prevalidatedReferral = guard.data;
    } else {
      mergedReferral = '';
    }
  }

  const legalAcceptedAtIso =
    legalAcceptedFromRegisterFlow ? new Date().toISOString() : null;

  const insertRow = {
    id: profileId,
    email: normalizedEmail,
    password_hash: null,
    auth_user_id: authUid,
    role: 'RENTER',
    first_name: gnFirst || null,
    last_name: gnLast || null,
    referral_code: refCode,
    referred_by: prevalidatedReferral?.code || mergedReferral || null,
    is_verified: true,
    verification_status: 'VERIFIED',
    preferred_currency: 'THB',
    preferred_payout_currency: 'THB',
    language: 'ru',
    terms_accepted: Boolean(legalAcceptedAtIso),
    terms_accepted_at: legalAcceptedAtIso,
    legal_terms_accepted_at: legalAcceptedAtIso,
    avatar: avatarUrl || null,
  };

  const { data: created, error: insErr } = await supabaseAdmin
    .from('profiles')
    .insert(insertRow)
    .select('*')
    .single();

  if (insErr) {
    if (insErr.code === '23505' || String(insErr.message || '').includes('unique')) {
      const { data: race } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (race) {
        if (race.is_banned === true) {
          return { ok: false, error: 'ACCOUNT_SUSPENDED', profile: null, created: false };
        }
        const raceAuth = race.auth_user_id ? String(race.auth_user_id).trim() : '';
        if (raceAuth && raceAuth !== authUid) {
          return { ok: false, error: 'AUTH_PROFILE_AUTH_CONFLICT', profile: null, created: false };
        }
        const { data: mergedRow, error: mergeErr } = await supabaseAdmin
          .from('profiles')
          .update({
            auth_user_id: authUid,
            is_verified: true,
            updated_at: new Date().toISOString(),
            ...(legalAcceptedFromRegisterFlow &&
            !(race.terms_accepted === true || race.terms_accepted_at || race.legal_terms_accepted_at)
              ? {
                  terms_accepted: true,
                  terms_accepted_at: new Date().toISOString(),
                  legal_terms_accepted_at: new Date().toISOString(),
                }
              : {}),
            ...(!race.avatar && avatarUrl ? { avatar: avatarUrl } : {}),
          })
          .eq('id', race.id)
          .select('*')
          .single();
        if (mergeErr) {
          console.error('[OAUTH PROFILE] race-merge:', mergeErr.message);
          return { ok: false, error: mergeErr.message || 'MERGE_FAILED', profile: null, created: false };
        }
        await supabaseAdmin
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', race.id);
        const out = mergedRow || race;
        return {
          ok: true,
          profile: out,
          created: false,
          needsLegalCompletion:
            !(out.terms_accepted === true || out.terms_accepted_at || out.legal_terms_accepted_at),
        };
      }
    }
    console.error('[OAUTH PROFILE] insert:', insErr.message);
    return { ok: false, error: insErr.message || 'INSERT_FAILED', profile: null, created: false };
  }

  try {
    const ownerIp = request ? resolveClientIpFromRequest(request) : '';
    await supabaseAdmin.from('referral_codes').upsert(
      {
        id: makeId('rfc'),
        user_id: created.id,
        code: refCode,
        is_active: true,
        metadata: { owner_ip: ownerIp || null, source: 'auth_oauth' },
      },
      { onConflict: 'user_id', ignoreDuplicates: false },
    );
  } catch (e) {
    console.warn('[OAUTH PROFILE] referral_codes:', e?.message || e);
  }

  const oauthRefereeAlreadyReferred = await ReferralAttributionService.refereeAlreadyReferred(created.id);
  let oauthConvertAllowed = true;
  if (mergedReferral && prevalidatedReferral?.referrerId && !oauthRefereeAlreadyReferred) {
    const convertGate = await ReferralAttributionService.assertConvertAllowed({ request, fingerprint: null });
    oauthConvertAllowed = convertGate.allowed === true;
  }
  if (
    mergedReferral &&
    prevalidatedReferral?.referrerId &&
    !oauthRefereeAlreadyReferred &&
    oauthConvertAllowed
  ) {
    try {
      const nowIso = new Date().toISOString();
      const tree = await computeInviteTreeFields(supabaseAdmin, prevalidatedReferral.referrerId);
      await supabaseAdmin.from('referral_relations').upsert(
        {
          id: makeId('rfr'),
          referrer_id: prevalidatedReferral.referrerId,
          referee_id: created.id,
          referral_code_id: prevalidatedReferral.referralCodeId || null,
          referred_at: nowIso,
          created_at: nowIso,
          network_depth: tree.network_depth,
          ancestor_path: tree.ancestor_path,
          metadata: {
            referral_code: prevalidatedReferral.code,
            referee_email: normalizedEmail,
            referee_ip: request ? resolveClientIpFromRequest(request) || null : null,
            device_fingerprint: null,
            trigger: 'oauth_register',
          },
        },
        { onConflict: 'referee_id', ignoreDuplicates: false },
      );
      const { notifyTeammateJoined } = await import(
        '@/lib/services/marketing/referral-notification.service.js'
      );
      void notifyTeammateJoined({
        referrerId: prevalidatedReferral.referrerId,
        refereeId: created.id,
      });
      void ReferralAttributionService.markConvertedOnSignup({
        profileId: created.id,
        request: request || null,
        fingerprint: null,
      });
    } catch (e) {
      console.warn('[OAUTH PROFILE] referral relation:', e?.message || e);
    }
  }

  if (mergedReferral && prevalidatedReferral?.referrerId && !oauthRefereeAlreadyReferred) {
    try {
      const general = await PricingService.getGeneralPricingSettings();
      const welcomeBonusAmount = Number(general?.welcome_bonus_amount ?? general?.welcomeBonusAmount ?? 0);
      if (Number.isFinite(welcomeBonusAmount) && welcomeBonusAmount > 0) {
        const welcomeExpiresAtIso = new Date(Date.now() + 30 * 86400000).toISOString();
        const credit = await WalletService.addFunds(
          created.id,
          welcomeBonusAmount,
          'welcome_bonus',
          `welcome_bonus:${String(created.id)}`,
          {
            trigger: 'oauth_register_referred',
            referralCode: mergedReferral,
            referrerId: prevalidatedReferral.referrerId,
          },
          welcomeExpiresAtIso,
        );
        if (credit.success) {
          await WalletService.syncWelcomeBonusGrant(
            created.id,
            welcomeBonusAmount,
            welcomeExpiresAtIso,
          );
        }
      }
    } catch (e) {
      console.warn('[OAUTH PROFILE] welcome bonus:', e?.message || e);
    }
  }

  await supabaseAdmin.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', created.id);

  const needsLegalCompletion = !Boolean(legalAcceptedAtIso);

  return {
    ok: true,
    profile: created,
    created: true,
    needsLegalCompletion,
  };
}
