'use client'

import { useI18n } from '@/contexts/i18n-context'

/** RU = binding legal SSOT; any other UI language → EN convenience text. */
export function useLegalDocLocale() {
  const { language, setLanguage } = useI18n()
  const isRu = language === 'ru'
  return {
    language,
    isRu,
    showRussian: () => setLanguage('ru'),
  }
}
