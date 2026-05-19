/** Admin FinTech console — business-facing Russian labels (Stage 100.2) */

export const BREAKDOWN_ROWS = [
  { key: 'subtotal_thb', label: 'Базовая цена хозяина' },
  { key: 'guest_service_fee_thb', label: 'Сервисный сбор с гостя' },
  { key: 'ru_fee_thb', label: 'Доля РФ (ИП)' },
  { key: 'kr_fee_thb', label: 'Доля КР (ОсОО — ИТ-услуги)' },
  { key: 'fx_markup_thb', label: 'Курсовой спред' },
  { key: 'total_partner_netto_thb', label: 'К выплате партнёру' },
  { key: 'total_guest_payable_thb', label: 'Итог для гостя (до округления)' },
  { key: 'total_guest_payable_rounded_thb', label: 'Цена на сайте (после округления)' },
  { key: 'rounding_pot_thb', label: 'Округление в пользу платформы' },
]

export const PROFILE_FIELD_LABELS = {
  name: 'Название профиля (например, «Базовый Таиланд»)',
  guest_fee_pct: 'Комиссия с гостя (%)',
  ru_agent_share_pct: 'Доля РФ (ИП, %)',
  kr_service_share_pct: 'Доля КР (ОсОО, %)',
  fx_markup_pct: 'Курсовая наценка (%)',
  host_fee_pct: 'Комиссия с хозяина (%)',
}

/** Поля формы создания/редактирования (без системного id) */
export const PROFILE_FORM_KEYS = [
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
  no_ready_bookings: 'Нет броней, готовых к выплате хостам',
  all_already_batched: 'Все готовые брони уже включены в предыдущие пулы',
  not_pool_day: 'Сегодня не день пула (обычно понедельник и четверг). Используйте «Вне расписания».',
}

/** Статусы брони в очереди кассы (админ-пульт). */
export const FISCAL_QUEUE_STATUS_RU = {
  PAID_ESCROW: 'Оплачено, в эскроу',
  THAWED: 'Разморожено',
  READY_FOR_PAYOUT: 'Готово к выплате',
  COMPLETED: 'Завершено',
  CONFIRMED: 'Подтверждено',
  PENDING: 'Ожидает оплаты',
}

export const PAYOUT_RAIL_LABELS = {
  TBANK_RU: 'RUB Direct',
  KG_CRYPTO: 'KG / USDT',
}

export const TREASURY_DAILY_STEPS = [
  'Сверка книги',
  'Сформировать пул',
  'Зафиксировать пул',
  'CSV для банка',
  'Перевод в банке',
  'Отметить как оплаченный',
]
