'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Home } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getCategoryName, getUIText } from '@/lib/translations'
import { CATEGORY_CARD_IMAGES, HOME_CATEGORY_ICONS } from './home-constants'

export function CategoryBar({ language, categories, mediaFallback, onCategorySelect, markMediaFailed }) {
  return (
    <section className="py-14 sm:py-[5rem] bg-[#f7f9fb]">
      <div className="container mx-auto px-6">
        <h2 className="text-[32px] leading-10 tracking-[-0.01em] font-semibold text-slate-900 mb-8 text-center sm:text-left">
          {getUIText('categories', language)}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {categories.map((cat, idx) => {
            const Icon = HOME_CATEGORY_ICONS[cat.slug] || Home
            const cardImage = CATEGORY_CARD_IMAGES[idx % CATEGORY_CARD_IMAGES.length]
            return (
              <Link
                key={cat.id}
                href={`/listings?category=${cat.slug}`}
                onClick={() => onCategorySelect?.(cat)}
                className="block"
              >
                <Card
                  className="group cursor-pointer overflow-hidden rounded-2xl transition-all border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05),0_2px_6px_rgba(0,102,102,0.07)] hover:shadow-[0_24px_50px_rgba(0,102,102,0.16),0_10px_24px_rgba(15,23,42,0.1)] hover:border-[#006666] hover:-translate-y-1"
                >
                  <div className="relative h-32 sm:h-44 overflow-hidden">
                    <Image
                      src={mediaFallback[`cat-${cat.id}`] ? '/placeholder.svg' : cardImage}
                      alt={getCategoryName(cat.slug, language, cat.name)}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 25vw"
                      priority={idx < 4}
                      className="object-cover group-hover:scale-110 transition-transform duration-500 will-change-transform"
                      onError={() => markMediaFailed(`cat-${cat.id}`)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/78 via-slate-900/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center gap-1.5 text-white">
                        <Icon className="h-4 w-4 text-[#a2f0ef]" />
                        <h3 className="text-[15px] sm:text-base font-semibold leading-tight tracking-[-0.01em]">
                          {getCategoryName(cat.slug, language, cat.name)}
                        </h3>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
