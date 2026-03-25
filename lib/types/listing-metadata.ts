/**
 * Canonical JSON shape for `listings.metadata` (extends legacy flat keys).
 * Keep backward-compatible: existing code may still read metadata.bedrooms, metadata.city, etc.
 */

/** Недвижимость и аналоги (комнаты, спальные места, площадь) */
export interface ListingPropertyInfo {
  rooms?: number | null
  bedrooms?: number | null
  beds?: number | null
  bathrooms?: number | null
  square_meters?: number | null
  floor?: number | null
  max_guests?: number | null
}

/**
 * Удобства: строки или коды (например "wifi", "kitchen", "pool").
 * Рекомендуется хранить нормализованные коды + опционально исходные подписи в raw.
 */
export interface ListingAmenitiesBlock {
  codes?: string[]
  /** Исходные названия с площадки (для отладки / отображения) */
  labels?: string[]
}

export interface ListingRules {
  check_in_from?: string | null
  check_in_until?: string | null
  check_out_until?: string | null
  pets_allowed?: boolean | null
  smoking_allowed?: boolean | null
  events_allowed?: boolean | null
  quiet_hours?: string | null
  /** Произвольные пункты с площадки */
  additional?: string[]
}

/**
 * Категорийные поля (байки, яхты, няни, туры — без жёсткой схемы на уровне БД).
 * Ключи — стабильные snake_case коды внутри продукта.
 */
export type ListingCategorySpecific = {
  /** Пример: мото / авто */
  engine_size_cc?: number | null
  gear_type?: 'manual' | 'automatic' | 'cvt' | string | null
  /** Пример: яхты */
  length_meters?: number | null
  berths?: number | null
  /** Пример: няни / услуги */
  languages?: string[]
  experience_years?: number | null
  /** Любые будущие поля */
  [key: string]: unknown
}

/**
 * Верхний уровень metadata: сочетает структурированные блоки и legacy-плоские поля.
 */
export interface ListingMetadata extends Record<string, unknown> {
  property_info?: ListingPropertyInfo
  amenities?: ListingAmenitiesBlock
  rules?: ListingRules
  category_specific?: ListingCategorySpecific

  /** Импорт: черновик до проверки партнёром */
  import_draft?: boolean
  /** Версия схемы metadata (для миграций приложения) */
  metadata_schema_version?: number

  /**
   * Мультиязычные SEO-теги, сгенерированные при импорте.
   * Ключи — код языка (ru/en/zh/th). Приоритет в generateMetadata выше шаблонных.
   */
  seo?: Partial<Record<'ru' | 'en' | 'zh' | 'th', { title: string; description: string }>>

  /** @deprecated Используйте metadata.seo[lang]. Оставлено для обратной совместимости. */
  seo_title?: string
  /** @deprecated Используйте metadata.seo[lang]. Оставлено для обратной совместимости. */
  seo_description?: string

  /** Подходит для удалённой работы (быстрый интернет в описании) */
  is_workation_ready?: boolean
}

/** Подмножество sync_settings JSONB */
export interface ListingSyncSettings extends Record<string, unknown> {
  platform?: string
  external_listing_id?: string
  external_listing_url?: string
  last_import_at?: string
  last_sync_status?: 'ok' | 'partial' | 'error' | 'stale'
  field_mapping_version?: number
  /** Ключ в Storage / внешний ref, если сырой JSON не кладём в БД */
  raw_payload_storage_key?: string
  /** Короткие сообщения об ошибках маппинга */
  last_error_messages?: string[]
}

export type ExternalImportPlatform = 'airbnb' | 'booking' | 'vrbo' | 'other'

/** Сырой объект от парсера / коннектора (намеренно слабо типизирован) */
export type ExternalListingPayload = Record<string, unknown>
