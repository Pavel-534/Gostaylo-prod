/**
 * Stage 116.4 — SSOT чек-листа «Готовность к запуску» для владельца (/admin).
 */

import { getContactSafetyMode } from '@/lib/contact-safety-mode.js'
import { getChatSafetySettings } from '@/lib/chat-safety-settings.js'
import { loadOwnerSmokeSnapshot } from '@/lib/owner/owner-pause-toolkit.js'
import { loadProductionPaymentReadiness } from '@/lib/payment/production-readiness.js'
import {
  LISTING_QUALITY_MIN_DESCRIPTION,
  LISTING_QUALITY_MIN_PHOTOS,
} from '@/lib/partner/listing-quality-gates.js'

/**
 * @typedef {'green'|'yellow'|'red'} LaunchCheckStatus
 */

/**
 * @param {LaunchCheckStatus} status
 * @param {string} id
 * @param {string} label
 * @param {string} detail
 * @param {{ href?: string, external?: boolean }} [link]
 */
function check(status, id, label, detail, link) {
  return { id, label, detail, status, link: link || null }
}

/**
 * @param {object[]} items
 */
function overallFromItems(items) {
  if (items.some((i) => i.status === 'red')) return 'red'
  if (items.some((i) => i.status === 'yellow')) return 'yellow'
  return 'green'
}

/**
 * @param {object} [ownerOps]
 * @returns {Promise<{ generatedAt: string, overallStatus: LaunchCheckStatus, items: object[] }>}
 */
export async function buildOwnerLaunchReadiness(ownerOps = {}) {
  const mode = getContactSafetyMode()
  const chatSafety = await getChatSafetySettings()
  const lastSmoke = await loadOwnerSmokeSnapshot()
  const payment = await loadProductionPaymentReadiness()

  const pending = Number(ownerOps.pendingModeration) || 0
  const yookassaItem = payment.items?.find((i) => i.id === 'yookassa')
  const fiscalItem = payment.items?.find((i) => i.id === 'fiscal_provider')

  let contactStatus = 'green'
  let contactDetail = `В чате предупреждаем, если партнёр пытается увести гостя с платформы. После ${chatSafety.strikeThreshold} нарушений — ограничения.`
  if (mode === 'REDACT') {
    contactStatus = 'yellow'
    contactDetail = 'Контакты в сообщениях скрываются автоматически. Для мягкого старта обычно достаточно предупреждений.'
  }

  let moderationStatus = 'green'
  let moderationDetail = 'Новые объявления ждут вашего одобрения — очередь пуста.'
  if (pending > 0 && pending <= 10) {
    moderationStatus = 'yellow'
    moderationDetail = `${pending} объявлений ждут проверки — одобрите до открытия трафика.`
  } else if (pending > 10) {
    moderationStatus = 'red'
    moderationDetail = `${pending} объявлений в очереди — разберите модерацию в первую очередь.`
  }

  let smokeStatus = 'yellow'
  let smokeDetail = 'Запустите проверку платёжного контура в FinTech-пульте.'
  if (lastSmoke?.ranAt) {
    if (lastSmoke.ok) {
      smokeStatus = 'green'
      smokeDetail = `Последний прогон: ${new Date(lastSmoke.ranAt).toLocaleString('ru-RU')} — успех.`
    } else {
      smokeStatus = 'red'
      smokeDetail = `Последний прогон: ${new Date(lastSmoke.ranAt).toLocaleString('ru-RU')} — есть ошибки.`
    }
  }

  let paymentsStatus = 'yellow'
  let paymentsDetail = 'Подключите ЮKassa и онлайн-кассу на стороне провайдера (см. FinTech).'
  if (yookassaItem?.ready && fiscalItem?.ready) {
    paymentsStatus = 'green'
    paymentsDetail = 'ЮKassa и фискализация отмечены как настроенные в FinTech.'
  } else if (yookassaItem?.ready && !fiscalItem?.ready) {
    paymentsStatus = 'yellow'
    paymentsDetail = `ЮKassa OK; касса: ${fiscalItem?.detail || 'проверьте FISCAL_PROVIDER_URL'}.`
  } else if (!yookassaItem?.ready) {
    paymentsStatus = 'red'
    paymentsDetail = yookassaItem?.detail || 'Нет ключей ЮKassa — реальные платежи RU недоступны.'
  }

  const items = [
    check(
      contactStatus,
      'contact_safety',
      'Контакты защищены',
      contactDetail,
      { href: '/admin/security' },
    ),
    check(
      'green',
      'quality_gates',
      'Проверка объявлений включена',
      `Перед публикацией нужны минимум ${LISTING_QUALITY_MIN_PHOTOS} фото, описание от ${LISTING_QUALITY_MIN_DESCRIPTION} символов и точка на карте (для жилья и транспорта).`,
      { href: '/admin/moderation' },
    ),
    check(moderationStatus, 'moderation', 'Модерация настроена', moderationDetail, {
      href: '/admin/moderation',
    }),
    check(smokeStatus, 'smoke', 'Smoke-тест пройден', smokeDetail, {
      href: '/admin/settings/finances',
    }),
    check(paymentsStatus, 'payments_external', 'ЮKassa и касса подключены', paymentsDetail, {
      href: '/admin/settings/finances',
      external: false,
    }),
  ]

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: overallFromItems(items),
    items,
    lastSmoke: lastSmoke || null,
  }
}
