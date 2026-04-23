'use client'

import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar'
import { getUIText } from '@/lib/translations'
import { HERO_BACKGROUND_IMAGE } from './home-constants'

/**
 * @param {string} language
 * @param {import('react').ComponentProps<typeof UnifiedSearchBar>} searchBarRest — hero search bar (filters + handlers)
 */
export function HomeHero({ language, searchBarRest }) {
  return (
    <section
      className="relative pt-14 min-h-[500px] sm:min-h-[580px] bg-slate-900 bg-cover bg-center"
      style={{ backgroundImage: `url(${HERO_BACKGROUND_IMAGE})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40" />
      <div className="relative container mx-auto min-h-[440px] min-w-0 max-w-full px-3 sm:min-h-[510px] sm:px-4 flex flex-col justify-center">
        <div className="mx-auto w-full min-w-0 max-w-3xl sm:mx-0">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 text-center sm:text-left">
            {getUIText('heroTitle', language)}
            <span className="block text-teal-400">{getUIText('heroTitleHighlight', language)}</span>
          </h1>
          <p className="text-base sm:text-xl text-slate-200 mb-6 sm:mb-8 text-center sm:text-left">
            {getUIText('heroSubtitle', language)}
          </p>
          <UnifiedSearchBar variant="hero" language={language} {...searchBarRest} />
        </div>
      </div>
    </section>
  )
}
