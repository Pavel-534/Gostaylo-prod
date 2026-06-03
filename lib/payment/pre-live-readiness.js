/**
 * Stage 125.8 — Pre-Live Readiness: Фаза 1 hardening (125.0–125.7) + операционные проверки.
 * Данные для карточки «Pre-Live Readiness» на /admin/settings/finances.
 */

import { loadProductionPaymentReadiness } from '@/lib/payment/production-readiness.js'
import { loadFinancialCronHealth } from '@/lib/admin/financial-cron-health.js'
import { runTreasuryMonitoringScan } from '@/lib/treasury/treasury-monitoring-alerts.js'

function statusColor(ready, severity) {
  if (ready) return 'green'
  if (severity === 'info') return 'green'
  if (severity === 'recommended') return 'yellow'
  return 'red'
}

/**
 * @param {string} id
 * @param {string} label
 * @param {boolean} ready
 * @param {string} detail
 * @param {'required'|'recommended'|'info'} [severity]
 * @param {string} [docHref]
 */
function item(id, label, ready, detail, severity = 'required', docHref = '') {
  const r = Boolean(ready)
  return {
    id,
    label,
    ready: r,
    detail: detail || '',
    severity,
    status: statusColor(r, severity),
    docHref: docHref || null,
  }
}

/** Защиты Фазы 1 — всегда в коде после деплоя Stage 125.7. */
const PHASE1_CODE_ITEMS = Object.freeze([
  {
    id: '125_0',
    label: 'Escrow: повтор без двойного списания',
    detail: 'moveToEscrow idempotent + reconcile side-effects (promo, fiscal, уведомления)',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_1',
    label: 'Webhook оплаты: безопасный повтор',
    detail: 'payments/confirm → 2xx на PAID_ESCROW+ без повторного capture',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_2',
    label: 'submit-txid: защита от отката',
    detail: '409 после escrow / finalized payment — нельзя «откатить» оплату',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_3',
    label: 'FSM: PAID_ESCROW только через escrow',
    detail: 'Прямой переход статуса заблокирован — только RPC moveToEscrow',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_4',
    label: 'Crypto webhook: безопасный повтор',
    detail: 'crypto/confirm → 2xx post-escrow без повторной верификации Tron',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_5',
    label: 'Treasury alerts: без потери данных',
    detail: 'Алерты в critical_signal_events (не перезапись system_settings)',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_6',
    label: 'Fiscal: без повторных чеков',
    detail: 'PENDING_FISCAL + attempts>0 — kassa не вызывается на reconcile',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
  {
    id: '125_7',
    label: 'Pre-Live Readiness + owner sign-off',
    detail: 'FinTech-карточка, чек-лист PRE_REAL_PAYMENTS, smoke/cron actions',
    docHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#фаза-1--что-сделано-12501257',
  },
])

/**
 * @param {{
 *   productionReadiness?: Awaited<ReturnType<typeof loadProductionPaymentReadiness>>,
 *   cronHealth?: Awaited<ReturnType<typeof loadFinancialCronHealth>>,
 *   scan?: Awaited<ReturnType<typeof runTreasuryMonitoringScan>>,
 * }} [deps]
 */
export async function loadPreLiveReadiness(deps = {}) {
  const productionReadiness = deps.productionReadiness || (await loadProductionPaymentReadiness())
  const cronHealth = deps.cronHealth || (await loadFinancialCronHealth(false))
  const scan = deps.scan || (await runTreasuryMonitoringScan())

  const phase1Items = PHASE1_CODE_ITEMS.map((def) =>
    item(def.id, def.label, true, def.detail, 'info', def.docHref),
  )

  const cronJobs = cronHealth?.jobs || []
  const criticalCronNames = new Set(['escrow-thaw', 'promote-ready-for-payout', 'financial-health-monitor'])
  const criticalCrons = cronJobs.filter((j) => criticalCronNames.has(j.jobName))
  const cronTableMissing = Boolean(cronHealth?.opsTableMissing)
  const cronStale = criticalCrons.filter((j) => j.stale || j.lastStatus === 'error')
  const cronOk =
    !cronTableMissing && criticalCrons.length > 0 && cronStale.length === 0

  const smokeOk = Boolean(productionReadiness?.lastSmoke?.ok)
  const smokeNever = !productionReadiness?.lastSmoke?.ranAt
  const smokeDetail = smokeNever
    ? 'Ещё не запускали — кнопка «Запустить полный smoke» в этой карточке'
    : smokeOk
      ? `PASS (${productionReadiness.lastSmoke.stepsPassed ?? '?'}/${productionReadiness.lastSmoke.stepsTotal ?? '?'} шагов)`
      : 'Последний smoke с ошибками — покажите разработчику'

  const driftOk = productionReadiness?.ledgerDrift?.ok !== false
  const fiscalUrl = Boolean(String(process.env.FISCAL_PROVIDER_URL || '').trim())
  const webhookOk = Boolean(
    productionReadiness?.webhooks?.yookassa || productionReadiness?.webhooks?.globalFallback,
  )
  const yookassaOk = productionReadiness?.adapters?.adapters?.MIR_RU?.ready === true
  const emergencyActive = Boolean(productionReadiness?.treasury?.emergencyPause?.active)
  const pendingFiscal = Number(scan.pendingFiscalCount) || 0

  const opsItems = [
    item(
      'ops_smoke',
      'Smoke 25/25 (полная цепочка)',
      smokeOk,
      smokeDetail,
      smokeNever ? 'recommended' : 'required',
      'docs/PRE_REAL_PAYMENTS_CHECKLIST.md#что-проверить-вручную-на-staging',
    ),
    item(
      'ops_cron',
      'Cron: escrow-thaw, promote, мониторинг',
      cronOk,
      cronTableMissing
        ? 'Таблица ops_job_runs не найдена — проверьте миграции'
        : cronStale.length
          ? `Проблемы: ${cronStale.map((j) => j.label).join('; ')}`
          : 'Критичные задачи запускались недавно',
      'docs/CRON_EXTERNAL_FINANCIAL.md',
    ),
    item(
      'ops_webhooks',
      'Webhook-секрет (банк → сайт)',
      webhookOk,
      webhookOk
        ? 'Сайт примет повторное подтверждение оплаты без сбоя'
        : 'Задайте YOOKASSA_WEBHOOK_SECRET или PAYMENT_ACQUIRING_WEBHOOK_SECRET',
    ),
    item(
      'ops_yookassa',
      'ЮKassa (боевые ключи)',
      yookassaOk,
      yookassaOk ? 'MIR/RUB эквайринг настроен' : 'Нужны ключи и webhook на prod',
    ),
    item(
      'ops_fiscal',
      'Онлайн-касса (боевой URL)',
      fiscalUrl,
      fiscalUrl ? 'FISCAL_PROVIDER_URL задан' : 'Без кассы новые live-оплаты блокируются',
    ),
    item(
      'ops_drift',
      'Сверка ledger (drift)',
      driftOk,
      driftOk
        ? `Расхождение ฿${Math.abs(Number(scan.driftThb) || 0).toFixed(2)} — в норме`
        : `Drift ฿${Math.abs(Number(scan.driftThb) || 0).toFixed(2)} — разберитесь до live`,
    ),
    item(
      'ops_pause',
      'Emergency Pause выключен',
      !emergencyActive,
      emergencyActive
        ? 'Пауза активна — новые оплаты остановлены (ожидаемо до запуска)'
        : 'Приём оплат не заблокирован паузой',
      'recommended',
    ),
    item(
      'ops_fiscal_backlog',
      'Fiscal backlog',
      pendingFiscal === 0,
      pendingFiscal === 0
        ? 'Нет зависших PENDING_FISCAL'
        : `${pendingFiscal} броней с PENDING_FISCAL — проверьте кассу`,
      pendingFiscal === 0 ? 'recommended' : 'required',
    ),
  ]

  const phase1CodeReady = phase1Items.every((i) => i.ready)
  const opsRequiredReady = opsItems.filter((i) => i.severity === 'required').every((i) => i.ready)
  const allReady = phase1CodeReady && opsRequiredReady

  return {
    generatedAt: new Date().toISOString(),
    phase: '1',
    phaseLabel: 'Pre-Live Hardening (125.0–125.7)',
    phase1Closed: true,
    phase1ClosedAt: '2026-06-03',
    phase1CodeReady,
    opsRequiredReady,
    allReady,
    summary: {
      phase1Count: phase1Items.length,
      opsGreen: opsItems.filter((i) => i.status === 'green').length,
      opsYellow: opsItems.filter((i) => i.status === 'yellow').length,
      opsRed: opsItems.filter((i) => i.status === 'red').length,
    },
    sections: [
      {
        id: 'phase1_code',
        title: 'Фаза 1 — защита в коде (125.0–125.7)',
        description:
          'Закрыто в репозитории (Stage 125.8). Защита от двойных списаний, повторных webhook и лишних чеков.',
        items: phase1Items,
      },
      {
        id: 'ops_runtime',
        title: 'Операционная готовность (env + staging)',
        description:
          'Зависит от настроек хостинга, cron-job.org и ручных проверок перед первым live-платежом.',
        items: opsItems,
      },
    ],
    checklistHref: 'docs/PRE_REAL_PAYMENTS_CHECKLIST.md',
    goNoGoHref: 'docs/GO_NO_GO_FIRST_REAL_PAYMENT.md',
  }
}

export default { loadPreLiveReadiness }
