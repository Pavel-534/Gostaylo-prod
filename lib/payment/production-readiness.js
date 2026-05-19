/**
 * Stage 106.1 — aggregated «готовность к продакшену» for admin FinTech.
 */

import { getPaymentAdaptersHealth } from '@/lib/services/payment-adapters/health.js'
import { loadTreasuryOpsSettings } from '@/lib/treasury/treasury-ops-config.js'
import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'
import { runTreasuryMonitoringScan } from '@/lib/treasury/treasury-monitoring-alerts.js'
import { loadOwnerSmokeSnapshot } from '@/lib/owner/owner-pause-toolkit.js'

function statusColor(ready, severity) {
  if (ready) return 'green'
  if (severity === 'recommended') return 'yellow'
  return 'red'
}

function item(id, label, ready, detail, severity = 'required') {
  const r = Boolean(ready)
  return {
    id,
    label,
    ready: r,
    detail: detail || '',
    severity,
    status: statusColor(r, severity),
  }
}

/**
 * @returns {Promise<{
 *   generatedAt: string,
 *   productionEnvironment: boolean,
 *   allRequiredReady: boolean,
 *   items: object[],
 *   adapters: object,
 *   treasury: object,
 * }>}
 */
export async function loadProductionPaymentReadiness() {
  const adapters = getPaymentAdaptersHealth()
  const treasury = await loadTreasuryOpsSettings()
  const scan = await runTreasuryMonitoringScan()
  const driftThb = Math.abs(Number(scan.driftThb) || 0)
  const driftThreshold = Number(scan.thresholds?.ledgerDriftThbMin) ?? 0.5
  const driftOk = driftThb <= driftThreshold
  const fiscalUrl = Boolean(String(process.env.FISCAL_PROVIDER_URL || '').trim())
  const fiscalSandbox =
    String(process.env.FISCAL_SANDBOX || '').trim().toLowerCase() === 'true' ||
    process.env.FISCAL_SANDBOX === '1'
  const webhookGlobal = Boolean(String(process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET || '').trim())
  const yookassaWebhook = Boolean(String(process.env.YOOKASSA_WEBHOOK_SECRET || '').trim())
  const mandarinWebhook = Boolean(String(process.env.MANDARIN_WEBHOOK_SECRET || '').trim())
  const webhooksReady = (yookassaWebhook || webhookGlobal) && (mandarinWebhook || webhookGlobal || true)
  const yookassaKeys = adapters.adapters?.MIR_RU?.ready === true
  const mandarinKeys = adapters.adapters?.CARD_INTL?.ready === true
  const emergencyActive = Boolean(treasury.emergencyPause?.active)
  const manualMode = treasury.treasuryManualMode !== false

  const lastSmoke = await loadOwnerSmokeSnapshot()
  const smokeOk = Boolean(lastSmoke?.ok)
  const smokeNever = !lastSmoke?.ranAt
  const smokeDetail = smokeNever
    ? 'Ещё не запускали — нажмите «Запустить полный smoke»'
    : smokeOk
      ? `Последний запуск: ${new Date(lastSmoke.ranAt).toLocaleString('ru-RU')} — успех`
      : `Последний запуск: ${new Date(lastSmoke.ranAt).toLocaleString('ru-RU')} — есть ошибки`

  const items = [
    item(
      'yookassa',
      'ЮKassa (оплата MIR, Россия)',
      yookassaKeys,
      yookassaKeys
        ? 'Ключи и webhook настроены'
        : `Не хватает: ${(adapters.adapters?.MIR_RU?.missing || []).join(', ') || 'настройте в хостинге'}`,
    ),
    item(
      'mandarin',
      'Mandarin (карта, международные)',
      mandarinKeys,
      mandarinKeys
        ? 'Ключи международного эквайринга заданы'
        : 'Пока не обязательно, если принимаете только MIR',
      'recommended',
    ),
    item(
      'fiscal_provider',
      'Онлайн-касса (провайдер)',
      fiscalUrl,
      fiscalUrl ? 'Адрес кассы задан' : 'Нужен договор с провайдером кассы',
    ),
    item(
      'fiscal_sandbox',
      'Касса: без тестового режима',
      !fiscalSandbox,
      fiscalSandbox ? 'Тестовый режим кассы включён — выключите на бою' : 'Тестовый режим кассы выключен',
    ),
    item(
      'webhooks',
      'Секреты webhook (банк → сайт)',
      yookassaWebhook || webhookGlobal,
      yookassaWebhook || webhookGlobal
        ? 'Сайт сможет принять подтверждение оплаты от банка'
        : 'Без секрета оплаты не подтвердятся автоматически',
    ),
    item(
      'treasury_manual',
      'Ручной режим выплат',
      manualMode,
      manualMode
        ? 'Выплаты только вручную — безопасно для Concierge'
        : 'Включите ручной режим (TREASURY_MANUAL_MODE)',
      'recommended',
    ),
    item(
      'emergency_pause',
      'Пауза платформы',
      !emergencyActive,
      emergencyActive
        ? `Включена: ${treasury.emergencyPause?.reason || 'новые оплаты остановлены'}`
        : 'Не включена — для паузы на 1–2 недели включите',
      'recommended',
    ),
    item(
      'ledger_drift',
      'Сверка денег в учёте',
      driftOk,
      driftOk
        ? `Сходится (расхождение ฿${driftThb.toFixed(2)})`
        : `Есть расхождение ฿${driftThb.toFixed(2)} — разберитесь до live`,
    ),
    item(
      'smoke',
      'Проверка цепочки (smoke)',
      smokeOk,
      smokeDetail,
      smokeNever ? 'recommended' : 'required',
    ),
  ]

  const allRequiredReady = items
    .filter((i) => i.severity === 'required')
    .every((i) => i.ready)

  const blockingCount = items.filter((i) => i.status === 'red').length
  const warningCount = items.filter((i) => i.status === 'yellow').length

  return {
    generatedAt: new Date().toISOString(),
    productionEnvironment: isProductionPaymentEnvironment(),
    allRequiredReady,
    summary: {
      blockingCount,
      warningCount,
      readyCount: items.filter((i) => i.status === 'green').length,
    },
    ledgerDrift: { driftThb, threshold: driftThreshold, ok: driftOk },
    lastSmoke: lastSmoke || null,
    items,
    adapters,
    treasury: {
      manualMode,
      emergencyPause: treasury.emergencyPause,
      autoPool: treasury.treasuryAutoPool,
    },
    webhooks: {
      yookassa: yookassaWebhook,
      mandarin: mandarinWebhook,
      globalFallback: webhookGlobal,
      webhooksReady,
    },
  }
}
