/**
 * Stage 124.13 — форматирование Owner Digest (email + Telegram).
 */
import { escapeHtml } from '@/lib/email/premium-email-html';
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url';

function thb(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `฿${v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

function roiStr(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

/**
 * @param {Record<string, unknown>} digest
 */
export function buildOwnerDigestPlainText(digest) {
  const s = digest.summary || {};
  const lines = [
    `${getSiteDisplayName()} — еженедельный дайджест маркетинга`,
    `Период: ${digest.periodLabel || '7 дней'}`,
    '',
    `ROI программы: ${roiStr(s.roiIndex)}`,
    `CAC (средний): ${s.cacThb != null ? thb(s.cacThb) : '—'}`,
    `Привлечено гостей: ${s.guestsAcquired ?? 0}`,
    `Расход promo: ${thb(s.spendThb)}`,
    `Комиссия: ${thb(s.commissionThb)}`,
    `Чистая маржа рефералки: ${thb(s.netMarginThb)}`,
    `Остаток promo tank: ${thb(s.promoTankBalanceThb)}`,
    '',
  ];

  if (digest.campaignRankings?.top?.length) {
    lines.push('Топ кампаний (ROI):');
    for (const c of digest.campaignRankings.top) {
      lines.push(`  • ${c.campaignName}: ROI ${roiStr(c.roiIndex)}, расход ${thb(c.spendThb)}`);
    }
    lines.push('');
  }

  if (digest.campaignRankings?.worst?.length) {
    lines.push('Требуют внимания:');
    for (const c of digest.campaignRankings.worst) {
      lines.push(`  • ${c.campaignName}: ROI ${roiStr(c.roiIndex)}, расход ${thb(c.spendThb)}`);
    }
    lines.push('');
  }

  if (digest.alerts?.length) {
    lines.push('Алерты:');
    for (const a of digest.alerts) {
      lines.push(`  • ${a.message}`);
    }
    lines.push('');
  }

  if (digest.recommendations?.length) {
    lines.push('Выводы:');
    for (const r of digest.recommendations) {
      lines.push(`  • ${r}`);
    }
    lines.push('');
  }

  const base = getPublicSiteUrl();
  lines.push(`ROI-пульт: ${base}/admin/marketing/roi`);
  lines.push(`Financial Intelligence: ${base}/admin/finance/intelligence`);

  return lines.join('\n');
}

/**
 * @param {Record<string, unknown>} digest
 */
export function buildOwnerDigestHtml(digest) {
  const s = digest.summary || {};
  const base = getPublicSiteUrl();
  const brand = escapeHtml(getSiteDisplayName());

  const kpiRow = (label, value) =>
    `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">${escapeHtml(label)}</td>` +
    `<td style="padding:8px 12px;font-weight:600;font-size:14px;text-align:right;">${escapeHtml(value)}</td></tr>`;

  const campaignList = (title, rows) => {
    if (!rows?.length) return '';
    const items = rows
      .map(
        (c) =>
          `<li style="margin:6px 0;"><strong>${escapeHtml(c.campaignName)}</strong> — ROI ${roiStr(c.roiIndex)}, расход ${thb(c.spendThb)}</li>`,
      )
      .join('');
    return `<h3 style="font-size:15px;color:#0f172a;margin:20px 0 8px;">${escapeHtml(title)}</h3><ul style="margin:0;padding-left:20px;color:#334155;">${items}</ul>`;
  };

  const alertsBlock =
    digest.alerts?.length > 0
      ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#9a3412;">Алерты</p>
      <ul style="margin:0;padding-left:18px;color:#7c2d12;font-size:13px;">
        ${digest.alerts.map((a) => `<li style="margin:4px 0;">${escapeHtml(a.message)}</li>`).join('')}
      </ul></div>`
      : '';

  const recBlock =
    digest.recommendations?.length > 0
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#166534;">Рекомендации</p>
      <ul style="margin:0;padding-left:18px;color:#14532d;font-size:13px;">
        ${digest.recommendations.map((r) => `<li style="margin:4px 0;">${escapeHtml(r)}</li>`).join('')}
      </ul></div>`
      : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px 24px;color:#fff;">
      <p style="margin:0;font-size:12px;opacity:0.85;">${brand}</p>
      <h1 style="margin:8px 0 0;font-size:20px;">Еженедельный дайджест маркетинга</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.9;">${escapeHtml(digest.periodLabel || '7 дней')}</p>
    </div>
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;">
        ${kpiRow('ROI программы', roiStr(s.roiIndex))}
        ${kpiRow('CAC (средний)', s.cacThb != null ? thb(s.cacThb) : '—')}
        ${kpiRow('Привлечено гостей', String(s.guestsAcquired ?? 0))}
        ${kpiRow('Расход promo', thb(s.spendThb))}
        ${kpiRow('Комиссия', thb(s.commissionThb))}
        ${kpiRow('Чистая маржа рефералки', thb(s.netMarginThb))}
        ${kpiRow('Promo tank', thb(s.promoTankBalanceThb))}
      </table>
      ${alertsBlock}
      ${campaignList('Топ-3 кампании', digest.campaignRankings?.top)}
      ${campaignList('Анти-топ (низкий ROI)', digest.campaignRankings?.worst)}
      ${recBlock}
      <p style="margin:24px 0 0;font-size:13px;">
        <a href="${base}/admin/marketing/roi" style="color:#4f46e5;">Открыть ROI-пульт</a>
        &nbsp;·&nbsp;
        <a href="${base}/admin/finance/intelligence" style="color:#4f46e5;">Financial Intelligence</a>
      </p>
    </div>
    <p style="padding:12px 24px;background:#f8fafc;font-size:11px;color:#94a3b8;margin:0;">
      Read-only отчёт. Настройки дайджеста: админка → Маркетинг → ROI.
    </p>
  </div>
</body></html>`;
}

/**
 * @param {Record<string, unknown>} digest
 */
export function buildOwnerDigestTelegramHtml(digest) {
  const s = digest.summary || {};
  const base = getPublicSiteUrl();
  const lines = [
    `<b>📊 Дайджест маркетинга</b> (${escapeHtml(digest.periodLabel || '7д')})`,
    '',
    `ROI: <b>${roiStr(s.roiIndex)}</b> · CAC: <b>${s.cacThb != null ? thb(s.cacThb) : '—'}</b>`,
    `Гости: <b>${s.guestsAcquired ?? 0}</b> · Расход: <b>${thb(s.spendThb)}</b>`,
    `Net рефералки: <b>${thb(s.netMarginThb)}</b> · Tank: <b>${thb(s.promoTankBalanceThb)}</b>`,
  ];

  if (digest.campaignRankings?.top?.[0]) {
    const t = digest.campaignRankings.top[0];
    lines.push('', `🏆 Топ: ${escapeHtml(t.campaignName)} (ROI ${roiStr(t.roiIndex)})`);
  }
  if (digest.campaignRankings?.worst?.[0]) {
    const w = digest.campaignRankings.worst[0];
    lines.push(`⚠️ Анти-топ: ${escapeHtml(w.campaignName)} (ROI ${roiStr(w.roiIndex)})`);
  }
  if (digest.alerts?.length) {
    lines.push('', '<b>Алерты:</b>');
    for (const a of digest.alerts.slice(0, 4)) {
      lines.push(`• ${escapeHtml(a.message)}`);
    }
  }
  if (digest.recommendations?.[0]) {
    lines.push('', `💡 ${escapeHtml(digest.recommendations[0])}`);
  }
  lines.push('', `<a href="${base}/admin/marketing/roi">ROI-пульт</a>`);
  return lines.join('\n');
}
