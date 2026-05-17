/** Admin FinTech console — business-facing Russian labels (Stage 100.1) */

export const BREAKDOWN_ROWS = [
  { key: 'subtotal_thb', label: 'Базовая цена хозяина' },
  { key: 'guest_service_fee_thb', label: 'Сервисный сбор с гостя' },
  { key: 'ru_fee_thb', label: 'Доля РФ (ИП)' },
  { key: 'kr_fee_thb', label: 'Доля КР (ОсОО — ИТ-услуги)' },
  { key: 'fx_markup_thb', label: 'Курсовой спред' },
  { key: 'total_partner_netto_thb', label: 'К выплате партнёру (Таиланд)' },
  { key: 'total_guest_payable_thb', label: 'Итог для гостя (точно)' },
  { key: 'total_guest_payable_rounded_thb', label: 'Цена на сайте (после округления)' },
  { key: 'rounding_pot_thb', label: 'Округление в пользу платформы' },
]

export const PROFILE_FIELD_LABELS = {
  id: 'Код профиля',
  name: 'Название тарифа',
  guest_fee_pct: 'Комиссия с гостя (%)',
  ru_agent_share_pct: 'Доля РФ (ИП, %)',
  kr_service_share_pct: 'Доля КР (ОсОО, %)',
  fx_markup_pct: 'Курсовая наценка (%)',
  host_fee_pct: 'Комиссия с хозяина (%)',
  insurance_fund_pct: 'Страховой фонд (%)',
  tax_rate_pct: 'Налог (%)',
}

export const PROFILE_FORM_KEYS = [
  'id',
  'name',
  'guest_fee_pct',
  'ru_agent_share_pct',
  'kr_service_share_pct',
  'fx_markup_pct',
  'host_fee_pct',
]

export const BATCH_STATUS_RU = {
  DRAFT: 'Черновик',
  LOCKED: 'Зафиксирован',
  EXPORTED: 'Выгружен',
  SETTLED: 'Закрыт',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
}

export const POOL_MESSAGES_RU = {
  no_ready_bookings: 'Нет бронирований, готовых к выплате',
  all_already_batched: 'Все готовые брони уже включены в предыдущие пулы',
  not_pool_day: 'Сегодня не день пула (обычно понедельник и четверг). Используйте «Вне расписания».',
}
