'use client'

import Image from 'next/image'
import { Home } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getCategoryName, getUIText } from '@/lib/translations'
import { CATEGORY_CARD_IMAGES, HOME_CATEGORY_ICONS } from './home-constants'

export function CategoryBar({ language, categories, mediaFallback, onCategorySelect, markMediaFailed }) {
  return (
    <section className="py-10 sm:py-14 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6 text-center sm:text-left">
          {getUIText('categories', language)}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((cat, idx) => {
            const Icon = HOME_CATEGORY_ICONS[cat.slug] || Home
            const cardImage = CATEGORY_CARD_IMAGES[idx % CATEGORY_CARD_IMAGES.length]
            return (
              <Card
                key={cat.id}
                className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all border hover:border-teal-500"
                onClick={() => onCategorySelect(cat)}
              >
                <div className="relative h-28 sm:h-40 overflow-hidden">
                  <Image
                    src={mediaFallback[`cat-${cat.id}`] ? '/placeholder.svg' : cardImage}
                    alt={cat.name}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 25vw"
                    priority={idx < 4}
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={() => markMediaFailed(`cat-${cat.id}`)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="flex items-center gap-1.5 text-white">
                      <Icon className="h-4 w-4" />
                      <h3 className="text-sm sm:text-base font-bold">
                        {getCategoryName(cat.slug, language, cat.name)}
                      </h3>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
