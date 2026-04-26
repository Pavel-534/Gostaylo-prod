/**
 * CSV registry for T-Bank (Т-Банк) bulk payouts — RU bank rail.
 * Columns: ФИО; Номер счета; БИК; ИНН; Назначение платежа; Сумма (semicolon, UTF-8 BOM for Excel).
 * Уточните порядок/имена колонок по шаблону из личного кабинета Т-Банка при необходимости.
 */

import { supabaseAdmin } from '@/lib/supabase';
import iconv from 'iconv-lite';
import { getSiteDisplayName } from '@/lib/site-url';

/** Canonical method id from migration 029 */
export const TBANK_REGISTRY_METHOD_ID = 'pm-bank-ru';

/**
 * Переключение кодировки выгрузки (UTF-8 по умолчанию; Windows-1251 для старых шлюзов Т-Банка).
 * @param {string} csvUtf8
 * @param {'utf-8' | 'windows-1251' | 'cp1251'} encoding
 * @returns {Buffer}
 */
export function encodeTbankCsvForDownload(csvUtf8, encoding = 'utf-8') {
  const enc = String(encoding || 'utf-8').toLowerCase();
  if (enc === 'windows-1251' || enc === 'cp1251') {
    const body = csvUtf8.startsWith('\uFEFF') ? csvUtf8.slice(1) : csvUtf8;
    return Buffer.from(iconv.encode(body, 'win1251'));
  }
  return Buffer.from(csvUtf8, 'utf-8');
}

function escapeCsvField(value) {
  const s = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatAmountRub(value) {
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  return n.toFixed(2);
}

export function payoutRowToTbankRegistryLine(row, partnerNameFallback = '') {
  const data = row.payout_profile?.data || {};
  const recipient =
    String(data.recipientName || data.fullName || '').trim() || partnerNameFallback;
  const accountNumber = String(data.accountNumber || '').replace(/\s/g, '');
  const bik = String(data.bik || '').replace(/\s/g, '');
  const inn = String(data.inn || '').replace(/\s/g, '');
  const amountRub = formatAmountRub(row.final_amount ?? row.amount);
  const purpose = `Выплата партнеру ${getSiteDisplayName()} payout ${row.id}${row.booking_id ? ` booking ${row.booking_id}` : ''}`;
  return {
    recipientName: recipient,
    accountNumber,
    bik,
    inn,
    purpose,
    amountRub,
    payoutId: row.id,
    partnerId: row.partner_id,
    profileId: row.payout_profile_id,
  };
}

export function buildTbankRegistryCsv(lines) {
  // TODO: T-Bank API Integration — replace CSV row materialization with a call to T-Bank Business API
  // (bulk payment / registry endpoint) when credentials and idempotency contract are available.
  const header = ['ФИО', 'Номер счета', 'БИК', 'ИНН', 'Назначение платежа', 'Сумма'];
  const out = [`\uFEFF${header.join(';')}`];
  for (const L of lines) {
    out.push(
      [
        escapeCsvField(L.recipientName),
        escapeCsvField(L.accountNumber),
        escapeCsvField(L.bik),
        escapeCsvField(L.inn),
        escapeCsvField(L.purpose),
        escapeCsvField(L.amountRub),
      ].join(';'),
    );
  }
  return out.join('\r\n');
}

export class TbankPayoutRegistryService {
  /**
   * PENDING payouts for RU bank method; profile must be verified.
   */
  static async listPendingRuBankPayoutsForRegistry() {
    const { data: payouts, error } = await supabaseAdmin
      .from('payouts')
      .select(
        `
        *,
        payout_method:payout_methods(id,channel,currency,name),
        payout_profile:partner_payout_profiles(id,data,is_verified,is_default,partner_id)
      `,
      )
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const exportable = [];
    const skippedUnverified = [];

    for (const p of payouts || []) {
      const method = p.payout_method;
      const isRuBank =
        method?.id === TBANK_REGISTRY_METHOD_ID ||
        (String(method?.channel || '').toUpperCase() === 'BANK' &&
          String(method?.currency || '').toUpperCase() === 'RUB');
      if (!isRuBank) continue;

      const profile = p.payout_profile;
      if (!profile?.id) {
        skippedUnverified.push({ payoutId: p.id, reason: 'NO_PROFILE' });
        continue;
      }
      if (!profile.is_verified) {
        skippedUnverified.push({ payoutId: p.id, partnerId: p.partner_id, reason: 'PROFILE_NOT_VERIFIED' });
        continue;
      }

      const data = profile.data || {};
      if (!data.accountNumber || !data.bik || !data.inn) {
        skippedUnverified.push({ payoutId: p.id, partnerId: p.partner_id, reason: 'INCOMPLETE_BANK_DETAILS' });
        continue;
      }

      exportable.push(p);
    }

    return { exportable, skippedUnverified };
  }

  static async enrichPartnerNames(payoutRows) {
    const ids = [...new Set((payoutRows || []).map((p) => p.partner_id).filter(Boolean))];
    if (!ids.length) return new Map();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,first_name,last_name,email')
      .in('id', ids);
    if (error) throw new Error(error.message);
    const map = new Map();
    for (const r of data || []) {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email || '';
      map.set(r.id, name);
    }
    return map;
  }

  /**
   * Build CSV and mark included payouts PROCESSING.
   */
  static async exportRegistryAndMarkProcessing() {
    // TODO: T-Bank API Integration — after API payout initiation succeeds, update payouts metadata / status
    // here instead of (or in addition to) CSV generation in buildTbankRegistryCsv + file handoff to ops.
    const { exportable, skippedUnverified } = await this.listPendingRuBankPayoutsForRegistry();
    const stillSkipped = [...skippedUnverified];

    if (!exportable.length) {
      return { csv: buildTbankRegistryCsv([]), exportedIds: [], skippedUnverified: stillSkipped };
    }

    const names = await this.enrichPartnerNames(exportable);
    const lines = [];
    for (const p of exportable) {
      const fallback = names.get(p.partner_id) || '';
      const parsed = payoutRowToTbankRegistryLine(p, fallback);
      if (!parsed.recipientName) {
        stillSkipped.push({ payoutId: p.id, partnerId: p.partner_id, reason: 'MISSING_RECIPIENT_NAME' });
        continue;
      }
      lines.push(parsed);
    }

    const now = new Date().toISOString();
    const exportedIds = [];
    const successfulLines = [];

    for (const L of lines) {
      const p = exportable.find((r) => r.id === L.payoutId);
      const prevMeta = p?.metadata && typeof p.metadata === 'object' ? { ...p.metadata } : {};
      const { error: upErr } = await supabaseAdmin
        .from('payouts')
        .update({
          status: 'PROCESSING',
          metadata: { ...prevMeta, tbank_registry_exported_at: now },
        })
        .eq('id', L.payoutId);
      if (upErr) {
        stillSkipped.push({ payoutId: L.payoutId, reason: `UPDATE_FAILED:${upErr.message}` });
        continue;
      }
      exportedIds.push(L.payoutId);
      successfulLines.push(L);
    }

    return {
      csv: buildTbankRegistryCsv(successfulLines),
      exportedIds,
      skippedUnverified: stillSkipped,
    };
  }
}

export default TbankPayoutRegistryService;
