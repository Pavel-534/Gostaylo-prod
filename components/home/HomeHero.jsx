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
      className="relative isolate overflow-hidden pt-20 min-h-[640px] sm:min-h-[760px] bg-slate-900 bg-cover bg-center"
      style={{ backgroundImage: `url(${HERO_BACKGROUND_IMAGE})` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_110%_at_50%_4%,rgba(162,240,239,0.24)_0%,rgba(0,102,102,0.16)_26%,rgba(0,26,31,0.72)_66%,rgba(2,6,23,0.84)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/18 via-[#022d33]/42 to-slate-950/64" />
      <div className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#79e6d8]/20 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent via-[#f7f9fb]/48 to-[#f7f9fb]" />
      <div className="relative container mx-auto min-h-[590px] min-w-0 max-w-full px-4 sm:min-h-[690px] sm:px-6 flex flex-col justify-center">
        <div className="mx-auto w-full min-w-0 max-w-5xl sm:mx-0">
          <h1 className="text-4xl sm:text-[56px] md:text-[68px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white mb-6 text-center sm:text-left drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {getUIText('heroTitle', language)}
            <span className="block text-[#a2f0ef]">{getUIText('heroTitleHighlight', language)}</span>
          </h1>
          <p className="max-w-3xl text-lg sm:text-[21px] leading-8 text-slate-100/95 mb-10 sm:mb-12 text-center sm:text-left">
            {getUIText('heroSubtitle', language)}
          </p>
          <div className="rounded-[30px] border border-white/70 bg-white/96 p-1.5 sm:p-2 shadow-[0_55px_120px_rgba(0,34,34,0.32),0_24px_56px_rgba(0,102,102,0.2),0_8px_24px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <UnifiedSearchBar variant="hero" language={language} {...searchBarRest} />
          </div>
        </div>
      </div>
    </section>
  )
}
