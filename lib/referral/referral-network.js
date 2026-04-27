/**
 * Stage 72.2 — Invite tree helpers: ancestor_path + network_depth at registration time.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} directReferrerId profiles.id of the owner's referral code used at signup
 * @returns {Promise<{ network_depth: number, ancestor_path: string[] }>}
 */
export async function computeInviteTreeFields(supabase, directReferrerId) {
  const uid = String(directReferrerId || '').trim();
  if (!uid) return { network_depth: 1, ancestor_path: [] };

  const { data: referrerAsReferee, error } = await supabase
    .from('referral_relations')
    .select('ancestor_path, referrer_id')
    .eq('referee_id', uid)
    .maybeSingle();

  if (error || !referrerAsReferee) {
    return { network_depth: 1, ancestor_path: [uid] };
  }

  let base = referrerAsReferee.ancestor_path;
  if (!Array.isArray(base) || base.length === 0) {
    const fallback = String(referrerAsReferee.referrer_id || '').trim();
    base = fallback ? [fallback] : [];
  }

  const chain = [...base];
  if (!chain.includes(uid)) chain.push(uid);

  return {
    network_depth: chain.length,
    ancestor_path: chain,
  };
}

export default { computeInviteTreeFields };
