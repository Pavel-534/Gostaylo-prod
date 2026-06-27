'use client'

/** Teal A mark — compact icon for toasts, favicons, inline badges. */
export function AirentoMark({ size = 32, className = '', teal = '#006666', steel = '#8b97a7' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 78 L47 13 L84 78" stroke={teal} strokeWidth="11" />
        <path d="M36 79 L50 44 L64 79" stroke={teal} strokeWidth="8" />
        <path d="M7 61 C 18 42, 34 43, 49 60 S 81 77, 93 57" stroke={steel} strokeWidth="12" />
      </g>
    </svg>
  )
}
