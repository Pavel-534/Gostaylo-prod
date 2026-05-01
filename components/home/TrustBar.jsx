'use client'

/**
 * TrustBar — узкая полоса «social proof» под Hero-секцией.
 * Показывает три ключевых доверительных сигнала платформы.
 *
 * SSOT: переводы через getUIText, статистика передаётся как props (готово к динамике).
 * При желании подключить к /api/v2/public/stats — достаточно передать stats из родителя.
 */

import { Home, Star, ShieldCheck } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { useEffect, useRef, useState } from 'react'

// ---------- Animated counter ----------
function AnimatedCounter({ target, duration = 1400, suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState('0')
  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    const numericTarget = typeof target === 'number' ? target : parseFloat(target) || 0
    if (numericTarget === 0) { setDisplay('0'); return }

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = eased * numericTarget
      const formatted = decimals > 0
        ? current.toFixed(decimals)
        : Math.floor(current) >= 1000
          ? Math.floor(current).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
          : String(Math.floor(current))
      setDisplay(formatted)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
      else setDisplay(
        decimals > 0
          ? numericTarget.toFixed(decimals)
          : numericTarget >= 1000
            ? numericTarget.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
            : String(numericTarget)
      )
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, decimals])

  return <span>{display}{suffix}</span>
}

// ---------- Main TrustBar ----------
export function TrustBar({ language = 'ru', stats }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  // Trigger counter when bar enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const ITEMS = [
    {
      icon: Home,
      value: stats?.listingsCount ?? 1200,
      suffix: '+',
      decimals: 0,
      label: getUIText('trustListingsLabel', language),
      ariaLabel: `${stats?.listingsCount ?? '1 200+'} ${getUIText('trustListingsLabel', language)}`,
    },
    {
      icon: Star,
      value: stats?.avgRating ?? 4.9,
      suffix: '★',
      decimals: 1,
      isStar: true,
      label: getUIText('trustRatingLabel', language),
      ariaLabel: `${stats?.avgRating ?? 4.9} ${getUIText('trustRatingLabel', language)}`,
    },
    {
      icon: ShieldCheck,
      value: 100,
      suffix: '%',
      decimals: 0,
      label: getUIText('trustSecurityLabel', language),
      sublabel: getUIText('trustEscrowLabel', language),
      ariaLabel: `100% ${getUIText('trustSecurityLabel', language)}`,
    },
  ]

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Platform trust signals"
      className="relative border-y border-teal-100/80 bg-gradient-to-r from-teal-50/60 via-white to-teal-50/60 py-0"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-stretch justify-center divide-x divide-teal-100">
          {ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                aria-label={item.ariaLabel}
                className="flex flex-1 items-center justify-center gap-3 px-6 py-4 sm:gap-4 sm:px-10 sm:py-5"
              >
                {/* Icon bubble */}
                <div className="hidden shrink-0 items-center justify-center rounded-xl bg-teal-100/80 p-2 sm:flex">
                  <Icon className="h-4 w-4 text-teal-600" aria-hidden />
                </div>

                {/* Value + label */}
                <div className="text-center sm:text-left">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black leading-none tracking-tight text-teal-700 sm:text-3xl">
                      {visible ? (
                        <AnimatedCounter
                          target={item.value}
                          duration={item.isStar ? 900 : 1400}
                          suffix={item.suffix}
                          decimals={item.decimals}
                        />
                      ) : (
                        <span className="opacity-0">0</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                    {item.label}
                    {item.sublabel && (
                      <span className="ml-1 text-teal-600 opacity-70">· {item.sublabel}</span>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
