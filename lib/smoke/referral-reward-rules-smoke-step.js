import { supabaseAdmin } from '@/lib/supabase';

export async function runReferralRewardRulesSmokeStep() {
  try {
    const { error: tableErr } = await supabaseAdmin
      .from('referral_reward_rules')
      .select('id')
      .limit(1);
    if (tableErr && String(tableErr.message || '').includes('does not exist')) {
      return { ok: true, detail: 'skipped: referral_reward_rules table missing (apply stage123_0/123_1)' };
    }

    const fromIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, rule_version, reward_rule_id, metadata, created_at')
      .gte('created_at', fromIso)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      if (String(error.message || '').includes('rule_version')) {
        return { ok: true, detail: 'skipped: referral_ledger.rule_version missing (apply stage123_1)' };
      }
      return { ok: false, detail: error.message || 'REWARD_RULE_SMOKE_LEDGER_FAILED' };
    }

    const rows = Array.isArray(data) ? data : [];
    const matched = rows.filter((row) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      return (
        row?.rule_version != null ||
        row?.reward_rule_id != null ||
        meta.reward_rule_version != null ||
        meta.reward_rule_id != null
      );
    });
    if (!matched.length) {
      return { ok: false, detail: 'no ledger rows with reward rule markers in last 24h' };
    }

    const withColumn = matched.filter((row) => row?.rule_version != null);
    return {
      ok: true,
      detail: `ledger markers=${matched.length}; column rule_version=${withColumn.length}`,
    };
  } catch (e) {
    return { ok: false, detail: e?.message || String(e) };
  }
}
