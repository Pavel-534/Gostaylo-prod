'use client'

/**
 * BentoGallery - Airbnb-style Image Grid
 * 
 * Features:
 * - 1 large image + 4 small images in Bento layout
 * - Click to open full-screen gallery modal
 * - Hover zoom effects
 * - Responsive: Single image on mobile, 5-image grid on desktop
 * 
 * @component
 */

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export function BentoGallery({ images, title, language = 'en', onImageClick }) {
  if (!images || images.length === 0) {
    return null
  }

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[50vh] min-h-[400px] max-h-[600px] rounded-2xl overflow-hidden mb-12 cursor-pointer"
      onClick={onImageClick}
    >
      {/* Main large image */}
      {images[0] && (
        <div className="relative md:col-span-2 md:row-span-2 bg-slate-100">
          <Image
            src={images[0]}
            alt={title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>
      )}
      
      {/* 4 smaller images */}
      {images.slice(1, 5).map((img, idx) => (
        <div key={idx} className="relative hidden md:block bg-slate-100">
          <Image
            src={img}
            alt={`${title} ${idx + 2}`}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="25vw"
          />
          {idx === 3 && images.length > 5 && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Button variant="secondary" size="sm">
                +{images.length - 5} {language === 'ru' ? 'фото' : 'more'}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
