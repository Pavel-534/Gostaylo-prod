/**
 * Stage 124.16 — Owner-facing guide for Referral & Marketing Intelligence (Phase D).
 * SSOT copy for UI card and documentation.
 */

/** @typedef {{ title: string, steps: string[], controls: string[] }} OwnerGuideBlock */

/** @type {OwnerGuideBlock} */
export const REFERRAL_ROI_OWNER_GUIDE = Object.freeze({
  title: 'Что я теперь могу контролировать',
  subtitle:
    'Phase D (Stages 124.11–124.16): read-only аналитика рефералки и кампаний. Все цифры из ledger и Financial Intelligence.',
  steps: [
    'Financial Intelligence — общая картина: оборот, чистая прибыль, эскроу, реферальный долг. Виджет Referral Economics ведёт сюда на ROI-пульт.',
    'Referral ROI-пульт — окупаемость программы: ROI, CAC, расход promo vs комиссия, алерты бюджета, график по дням/неделям, fraud-adjusted.',
    'Кампания (клик по строке) — детали одной кампании: LTV, удержание гостей, список броней.',
    'P&L брони (клик по брони) — полный money-flow одной сделки в Financial Intelligence.',
  ],
  controls: [
    'Окупается ли реферальная программа (ROI ≥ 1 — комиссия покрывает бонусы).',
    'Сколько стоит привлечение гостя (CAC) и какие кампании сильные/слабые.',
    'Не выходит ли кампания за бюджет и не пустеет ли promo tank.',
    'Есть ли подозрительные брони (fraud-adjusted ROI и очередь /admin/marketing/fraud-queue).',
    'Возвращаются ли гости повторно (LTV и retention на странице кампании).',
  ],
  weekly: [
    'Понедельник 07:00 UTC — Owner Digest на email/Telegram (настройки внизу ROI-пульта).',
    'Раз в неделю — откройте ROI за 7 дней, прочитайте блок «Что это значит для бизнеса».',
    'При критическом алерте — drill-down кампания → бронь → P&L.',
  ],
  routes: Object.freeze({
    fi: '/admin/finance/intelligence',
    roi: '/admin/marketing/roi',
    fraudQueue: '/admin/marketing/fraud-queue',
    budget: '/admin/marketing/budget',
  }),
});

export default REFERRAL_ROI_OWNER_GUIDE;
