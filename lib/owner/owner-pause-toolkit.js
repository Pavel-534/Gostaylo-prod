/**
 * Stage 106.3 — «Подготовить к паузе»: smoke, архив, памятка, Emergency Pause.
 */

import JSZip from 'jszip'
import { supabaseAdmin } from '@/lib/supabase'
import { runFinancialSmoke } from '@/lib/smoke/financial-smoke-run.js'
import { buildLegalDocumentsExportZip } from '@/lib/services/legal-documents-export.service.js'
import { setTreasuryEmergencyPause } from '@/lib/treasury/treasury-ops-config.js'
import { loadProductionPaymentReadiness } from '@/lib/payment/production-readiness.js'
import { getSiteDisplayName } from '@/lib/site-url.js'
import { createPartnerPdfDocument, drawPdfUnicodeLine } from '@/lib/services/partner-pdf-fonts'

const GENERAL_KEY = 'general'
const TOOLKIT_KEY = 'owner_pause_toolkit'

const DEFAULT_PAUSE_REASON = 'Пауза на организационные вопросы (ЮKassa, договоры)'

async function loadGeneral() {
  if (!supabaseAdmin) return {}
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', GENERAL_KEY)
    .maybeSingle()
  return data?.value && typeof data.value === 'object' ? data.value : {}
}

/**
 * @param {{ ok: boolean, steps?: object[], message?: string, ranAt?: string }} snapshot
 */
export async function saveOwnerSmokeSnapshot(snapshot) {
  if (!supabaseAdmin) return { success: false, error: 'no_db' }
  const general = await loadGeneral()
  const toolkit = {
    ...(general[TOOLKIT_KEY] && typeof general[TOOLKIT_KEY] === 'object' ? general[TOOLKIT_KEY] : {}),
    lastSmoke: {
      ok: Boolean(snapshot.ok),
      ranAt: snapshot.ranAt || new Date().toISOString(),
      message: snapshot.message || '',
      failedSteps: (snapshot.steps || []).filter((s) => !s.ok).map((s) => s.label || s.id),
      stepCount: (snapshot.steps || []).length,
    },
  }
  const merged = { ...general, [TOOLKIT_KEY]: toolkit }
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    { key: GENERAL_KEY, value: merged, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) return { success: false, error: error.message }
  return { success: true, toolkit }
}

/** @returns {Promise<object|null>} */
export async function loadOwnerSmokeSnapshot() {
  const general = await loadGeneral()
  return general[TOOLKIT_KEY]?.lastSmoke || null
}

/**
 * PDF-памятка для владельца (без технического жаргона).
 * @param {{ readiness?: object, smokeOk?: boolean }} opts
 */
export function renderOwnerReturnMemoPdf(opts = {}) {
  const readiness = opts.readiness || {}
  const site = getSiteDisplayName()
  const date = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })

  return new Promise((resolve, reject) => {
    const { doc, font } = createPartnerPdfDocument({ margin: 48, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.font(font).fontSize(18).fillColor('#111').text(`${site} — памятка при возвращении`)
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#444').text(`Сформировано: ${date}`)

    const blocks = [
      {
        title: '1. Что вы уже сделали перед паузой',
        lines: [
          '• Включена пауза платформы — новые оплаты и брони остановлены.',
          '• Сохранён архив юридических документов (в ZIP).',
          opts.smokeOk
            ? '• Проверка цепочки денег (smoke) пройдена на тестовых данных.'
            : '• Проверка цепочки денег (smoke) — см. файл smoke-report.txt в архиве.',
        ],
      },
      {
        title: '2. Пока вы занимаетесь ЮKassa и договорами',
        lines: [
          '• Не снимайте паузу на сайте, пока не готовы ключи оплаты и онлайн-касса.',
          '• Раз в 2–3 дня заглядывайте в финансовый пульт → вкладка «Мониторинг» (2 минуты).',
          '• Выплаты партнёрам — только вручную, как в инструкции Concierge.',
        ],
      },
      {
        title: '3. Когда вернулись (порядок действий)',
        lines: [
          '1) Подписали договор с ЮKassa, получили ключи, настроили webhook.',
          '2) Подключили боевую онлайн-кассу (без тестового режима).',
          '3) Открыли /admin/settings/finances — все пункты «готовности» зелёные.',
          '4) Снова нажали «Запустить полный smoke» — всё зелёное.',
          '5) Одна тестовая оплата на минимальную сумму → проверили, что деньги в escrow.',
          '6) Сняли паузу (Emergency Pause) в финансовом пульте.',
          '7) Чеклист: docs/PRE_REAL_PAYMENTS_CHECKLIST.md',
        ],
      },
      {
        title: '4. Кому звонить',
        lines: [
          '• Технические вопросы по сайту — ваш разработчик / поддержка проекта.',
          '• ЮKassa, банк, касса — ваши менеджеры по договорам.',
        ],
      },
    ]

    doc.moveDown(1)
    for (const block of blocks) {
      doc.font(font).fontSize(12).fillColor('#000').text(block.title)
      doc.moveDown(0.3)
      doc.fontSize(10).fillColor('#333')
      for (const line of block.lines) {
        drawPdfUnicodeLine(doc, line, 48, doc.y, { fontSize: 10 })
        doc.y += 14
      }
      doc.moveDown(0.6)
    }

    if (readiness.items?.length) {
      doc.fontSize(11).fillColor('#000').text('Снимок статусов на момент паузы')
      doc.moveDown(0.3)
      doc.fontSize(9)
      for (const it of readiness.items) {
        const mark = it.status === 'green' ? '✓' : it.status === 'yellow' ? '!' : '✗'
        drawPdfUnicodeLine(doc, `${mark} ${it.label}: ${it.detail}`, 48, doc.y, { fontSize: 9 })
        doc.y += 12
      }
    }

    doc.end()
  })
}

function smokeReportText(smoke) {
  const lines = [
    `Дата: ${smoke?.ranAt || new Date().toISOString()}`,
    `Результат: ${smoke?.ok ? 'УСПЕХ' : 'ЕСТЬ ОШИБКИ'}`,
    '',
  ]
  for (const s of smoke?.steps || []) {
    lines.push(`${s.ok ? '[OK]' : '[FAIL]'} ${s.label || s.id}${s.detail ? ` — ${s.detail}` : ''}`)
  }
  return lines.join('\n')
}

/**
 * @param {{
 *   reason?: string,
 *   pausedBy?: string | null,
 *   enablePause?: boolean,
 * }} opts
 */
export async function runOwnerPreparePauseWorkflow(opts = {}) {
  const reason = String(opts.reason || DEFAULT_PAUSE_REASON).trim() || DEFAULT_PAUSE_REASON
  const enablePause = opts.enablePause !== false

  const smoke = await runFinancialSmoke({ skipCleanup: false, rail: 'all' })
  const ranAt = new Date().toISOString()
  await saveOwnerSmokeSnapshot({
    ok: smoke.ok,
    steps: smoke.steps,
    message: smoke.message,
    ranAt,
  })

  const readiness = await loadProductionPaymentReadiness()
  const legal = await buildLegalDocumentsExportZip()
  if (!legal.success || !legal.buffer?.length) {
    return { success: false, error: legal.error || 'legal_zip_failed', smoke, readiness }
  }

  const memoPdf = await renderOwnerReturnMemoPdf({ readiness, smokeOk: smoke.ok })

  const zip = new JSZip()
  zip.file('README.txt', [
    `${getSiteDisplayName()} — пакет «перед паузой»`,
    `Дата: ${ranAt}`,
    '',
    'Содержимое:',
    '• legal-documents/ — юридические документы',
    '• pamyatka-pri-vozvraschenii.pdf — что делать после возвращения',
    '• smoke-report.txt — результат проверки цепочки',
    '',
    'Пауза платформы включена — новые оплаты остановлены.',
  ].join('\n'))

  const legalInner = await JSZip.loadAsync(legal.buffer)
  const legalFolder = zip.folder('legal-documents')
  for (const [path, file] of Object.entries(legalInner.files)) {
    if (file.dir) continue
    const content = await file.async('nodebuffer')
    legalFolder.file(path, content)
  }

  zip.file('pamyatka-pri-vozvraschenii.pdf', memoPdf)
  zip.file('smoke-report.txt', smokeReportText({ ...smoke, ranAt }))

  let pauseResult = null
  if (enablePause) {
    pauseResult = await setTreasuryEmergencyPause({
      active: true,
      reason,
      pausedBy: opts.pausedBy || null,
    })
    if (!pauseResult.success) {
      return {
        success: false,
        error: pauseResult.error || 'pause_failed',
        smoke,
        readiness,
      }
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const stamp = ranAt.slice(0, 10)

  return {
    success: true,
    smoke,
    readiness,
    pauseEnabled: enablePause,
    pauseReason: reason,
    buffer,
    filename: `gostaylo-pause-package-${stamp}.zip`,
  }
}
