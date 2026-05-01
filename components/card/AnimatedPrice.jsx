'use client'

/**
 * AnimatedPrice — плавная смена цены при переключении валюты.
 *
 * Анимация: при изменении currency делает мягкий fade-out (translateY(-6px) + opacity 0),
 * затем обновляет значение и делает fade-in (translateY(0) + opacity 1).
 * Длительность: 240ms — заметно, но не раздражающе.
 *
 * Используется в CardPriceDisplay.jsx как drop-in замена для прямого вывода цены.
 * SSOT: currency из useCurrency() — единственный источник истины.
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function AnimatedPrice({ value, className }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [phase, setPhase] = useState('idle') // 'idle' | 'exit' | 'enter'
  const prevValueRef = useRef(value)
  const timerRef = useRef(null)

  useEffect(() => {
    if (value === prevValueRef.current) return
    prevValueRef.current = value

    // Phase 1: exit (fade up)
    setPhase('exit')
    clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      // Phase 2: swap value while invisible + enter (fade down)
      setDisplayValue(value)
      setPhase('enter')

      timerRef.current = setTimeout(() => {
        setPhase('idle')
      }, 160)
    }, 160)

    return () => clearTimeout(timerRef.current)
  }, [value])

  return (
    <span
      className={cn(
        'inline-block transition-all duration-[160ms] ease-in-out will-change-transform',
        phase === 'exit' && 'opacity-0 -translate-y-1.5 scale-95',
        phase === 'enter' && 'opacity-0 translate-y-1.5 scale-95',
        phase === 'idle' && 'opacity-100 translate-y-0 scale-100',
        className,
      )}
    >
      {displayValue}
    </span>
  )
}
