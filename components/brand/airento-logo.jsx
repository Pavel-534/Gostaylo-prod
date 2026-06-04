'use client'

export function AirentoLogo({ compact = false, className = '', label = '', scrolled = false, hideLabelOnMobile = false }) {
  const showLabel = Boolean(String(label || '').trim())
  const teal = '#006666'
  const steel = '#8b97a7'
  const markSize = compact ? 32 : 38
  const boxSize = compact ? 'h-10 w-10' : 'h-12 w-12'
  const markOpacity = scrolled ? 0.9 : 1
  const labelOpacity = scrolled ? 0.86 : 1

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`grid ${boxSize} place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_10px_24px_rgba(0,102,102,0.16)] transition-all duration-300`}
      >
        <svg
          width={markSize}
          height={markSize}
          viewBox="0 0 100 100"
          aria-hidden
          style={{ opacity: markOpacity }}
        >
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Outer A-frame */}
            <path d="M16 78 L47 13 L84 78" stroke={teal} strokeWidth="11" />
            {/* Inner A-frame */}
            <path d="M36 79 L50 44 L64 79" stroke={teal} strokeWidth="8" />
            {/* Infinity ribbon crossing mark */}
            <path d="M7 61 C 18 42, 34 43, 49 60 S 81 77, 93 57" stroke={steel} strokeWidth="12" />
          </g>
        </svg>
      </div>
      {showLabel ? (
        <div className={`flex flex-col ${hideLabelOnMobile ? 'hidden sm:flex' : ''}`}>
          <span
            className={`font-black ${compact ? 'text-lg' : 'text-xl'} leading-none tracking-[0.08em] text-brand transition-opacity duration-300`}
            style={{ opacity: labelOpacity }}
          >
            {label}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500/90">
            rentals
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default AirentoLogo
